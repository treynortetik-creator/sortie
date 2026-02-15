import { db } from './db';
import { supabase } from './supabase';

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1000;

/** In-flight sync lock — prevents concurrent syncs of the same capture. */
const syncing = new Set<number>();

/** Get the current user's access token for authenticated API calls. */
async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    // Retry on 5xx or 429 (rate limit), not on 4xx client errors
    if (res.ok || res.status < 500 && res.status !== 429) {
      return res;
    }
    if (attempt < retries) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    } else {
      return res; // return last failed response
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error('fetchWithRetry: unexpected exit');
}

export async function syncCapture(captureId: number): Promise<void> {
  // Prevent concurrent sync of the same capture
  if (syncing.has(captureId)) return;
  syncing.add(captureId);

  const capture = await db.captures.get(captureId);
  if (!capture || !capture.id) {
    syncing.delete(captureId);
    return;
  }

  const errors: string[] = [];

  try {
    // Get auth token for API calls
    const token = await getAccessToken();
    const authHeaders: Record<string, string> = token
      ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      : { 'Content-Type': 'application/json' };

    await db.captures.update(capture.id, {
      status: 'processing',
      updatedAt: new Date().toISOString(),
    });

    // --- Step 1: Upload photo ---
    let photoUrl = capture.photoUrl;
    if (!photoUrl && capture.imageBlob) {
      const fileName = `captures/${capture.userId}/${Date.now()}_photo.jpg`;
      const { error: photoError } = await supabase.storage
        .from('captures')
        .upload(fileName, capture.imageBlob, { contentType: 'image/jpeg' });
      if (photoError) throw photoError;
      const { data: publicData } = supabase.storage
        .from('captures')
        .getPublicUrl(fileName);
      photoUrl = publicData.publicUrl;

      // Save partial progress — photo URL persisted even if later steps fail
      await db.captures.update(capture.id, {
        photoUrl,
        updatedAt: new Date().toISOString(),
      });
    }

    // --- Step 2: Upload audio if present ---
    let audioUrl = capture.audioUrl;
    if (!audioUrl && capture.audioBlob) {
      const fileName = `captures/${capture.userId}/${Date.now()}_audio.webm`;
      const { error: audioError } = await supabase.storage
        .from('captures')
        .upload(fileName, capture.audioBlob, { contentType: 'audio/webm' });
      if (audioError) throw audioError;
      const { data: publicData } = supabase.storage
        .from('captures')
        .getPublicUrl(fileName);
      audioUrl = publicData.publicUrl;

      // Save partial progress
      await db.captures.update(capture.id, {
        audioUrl,
        updatedAt: new Date().toISOString(),
      });
    }

    // --- Step 3: Extract contact info from photo ---
    let extractedData: {
      name?: string;
      title?: string;
      company?: string;
      email?: string;
      phone?: string;
      notes?: string;
    } = {};
    if (photoUrl) {
      try {
        const res = await fetchWithRetry('/api/extract', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ photoUrl }),
        });
        if (res.ok) {
          extractedData = await res.json();
        } else {
          const body = await res.text().catch(() => '');
          errors.push(`Extraction failed (${res.status}): ${body.slice(0, 200)}`);
        }
      } catch (err) {
        errors.push(`Extraction error: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    // --- Step 4: Transcribe audio ---
    let audioTranscription = capture.audioTranscription;
    let transcriptionSource = capture.transcriptionSource;
    if (audioUrl && !audioTranscription) {
      try {
        const res = await fetchWithRetry('/api/transcribe', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ audioUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          audioTranscription = data.transcription;
          transcriptionSource = 'whisper';
        } else {
          const body = await res.text().catch(() => '');
          errors.push(`Transcription failed (${res.status}): ${body.slice(0, 200)}`);
        }
      } catch (err) {
        errors.push(`Transcription error: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    // --- Step 5: Save to Supabase (upsert by remoteId) ---
    // Merge extracted notes with any user-written notes
    const mergedNotes = [capture.notes, extractedData.notes]
      .filter(Boolean)
      .join('\n')
      .trim() || undefined;

    const capturePayload = {
      user_id: capture.userId,
      submitter_email: capture.submitterEmail,
      event_name: capture.event,
      photo_url: photoUrl,
      audio_url: audioUrl,
      audio_duration: capture.audioDuration,
      extracted_name: extractedData.name || capture.name,
      extracted_title: extractedData.title || capture.title,
      extracted_company: extractedData.company || capture.company,
      extracted_email: extractedData.email || capture.email,
      extracted_phone: extractedData.phone || capture.phone,
      notes: mergedNotes,
      audio_transcription: audioTranscription,
      transcription_source: transcriptionSource,
      status: errors.length > 0 ? 'needs_review' : 'ready',
      processing_error: errors.length > 0 ? errors.join(' | ') : null,
      created_at: capture.createdAt,
      updated_at: new Date().toISOString(),
    };

    let remoteId = capture.remoteId;
    if (remoteId) {
      // Update existing remote record
      const { error: dbError } = await supabase
        .from('captures')
        .update(capturePayload)
        .eq('id', remoteId);
      if (dbError) throw dbError;
    } else {
      // Insert new remote record
      const { data: inserted, error: dbError } = await supabase
        .from('captures')
        .insert(capturePayload)
        .select('id')
        .single();
      if (dbError) throw dbError;
      remoteId = inserted?.id;
    }

    // --- Step 6: Update local record ---
    const finalStatus = errors.length > 0 ? 'needs_review' as const : 'ready' as const;
    const localUpdate: Record<string, unknown> = {
      remoteId,
      photoUrl,
      audioUrl,
      name: extractedData.name || capture.name,
      title: extractedData.title || capture.title,
      company: extractedData.company || capture.company,
      email: extractedData.email || capture.email,
      phone: extractedData.phone || capture.phone,
      notes: mergedNotes,
      audioTranscription,
      transcriptionSource,
      status: finalStatus,
      processingError: errors.length > 0 ? errors.join(' | ') : undefined,
      syncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Free up IndexedDB space — remove large blobs once safely uploaded
    if (photoUrl && capture.imageBlob) {
      localUpdate.imageBlob = undefined;
    }
    if (audioUrl && capture.audioBlob) {
      localUpdate.audioBlob = undefined;
    }

    await db.captures.update(capture.id, localUpdate);
  } catch (err) {
    // Hard failure — upload or DB insert failed
    const errorMsg = err instanceof Error ? err.message : 'Unknown sync error';
    await db.captures.update(captureId, {
      status: 'error',
      processingError: errorMsg,
      updatedAt: new Date().toISOString(),
    });
  } finally {
    syncing.delete(captureId);
  }
}

export async function syncAllCaptures(): Promise<void> {
  const unsynced = await db.captures
    .where('status')
    .anyOf(['captured', 'error', 'needs_review'])
    .toArray();

  for (const capture of unsynced) {
    if (capture.id) {
      await syncCapture(capture.id);
    }
  }
}
