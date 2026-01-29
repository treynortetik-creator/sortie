import { db } from './db';
import { supabase } from './supabase';

export async function syncCapture(captureId: number): Promise<void> {
  const capture = await db.captures.get(captureId);
  if (!capture || !capture.id) return;

  try {
    await db.captures.update(capture.id, { status: 'processing', updatedAt: new Date().toISOString() });

    // Upload photo
    let photoUrl = capture.photoUrl;
    if (!photoUrl && capture.imageBlob) {
      const fileName = `captures/${capture.userId}/${Date.now()}_photo.jpg`;
      const { error: photoError } = await supabase.storage
        .from('captures')
        .upload(fileName, capture.imageBlob, { contentType: 'image/jpeg' });
      if (photoError) throw photoError;
      const { data: publicData } = supabase.storage.from('captures').getPublicUrl(fileName);
      photoUrl = publicData.publicUrl;
    }

    // Upload audio if present
    let audioUrl = capture.audioUrl;
    if (!audioUrl && capture.audioBlob) {
      const fileName = `captures/${capture.userId}/${Date.now()}_audio.webm`;
      const { error: audioError } = await supabase.storage
        .from('captures')
        .upload(fileName, capture.audioBlob, { contentType: 'audio/webm' });
      if (audioError) throw audioError;
      const { data: publicData } = supabase.storage.from('captures').getPublicUrl(fileName);
      audioUrl = publicData.publicUrl;
    }

    // Extract text from photo via Claude Vision
    let extractedData: { name?: string; company?: string; email?: string; phone?: string } = {};
    if (photoUrl) {
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoUrl }),
        });
        if (res.ok) {
          extractedData = await res.json();
        }
      } catch {
        // extraction failed, continue
      }
    }

    // Transcribe audio via Whisper
    let audioTranscription = capture.audioTranscription;
    let transcriptionSource = capture.transcriptionSource;
    if (audioUrl && !audioTranscription) {
      try {
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          audioTranscription = data.transcription;
          transcriptionSource = 'whisper';
        }
      } catch {
        // transcription failed, continue
      }
    }

    // Draft follow-up email
    let emailDraft = capture.emailDraft;
    const contactName = extractedData.name || capture.name;
    const contactEmail = extractedData.email || capture.email;
    if (!emailDraft && (contactName || contactEmail)) {
      try {
        const res = await fetch('/api/draft-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: contactName,
            company: extractedData.company || capture.company,
            email: contactEmail,
            notes: audioTranscription || capture.notes,
            eventName: capture.event,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          emailDraft = data.emailDraft;
        }
      } catch {
        // email draft failed, continue
      }
    }

    // Save to Supabase
    const { data: inserted, error: dbError } = await supabase.from('captures').insert({
      user_id: capture.userId,
      event_name: capture.event,
      photo_url: photoUrl,
      audio_url: audioUrl,
      audio_duration: capture.audioDuration,
      extracted_name: extractedData.name || capture.name,
      extracted_company: extractedData.company || capture.company,
      extracted_email: extractedData.email || capture.email,
      extracted_phone: extractedData.phone || capture.phone,
      notes: capture.notes,
      audio_transcription: audioTranscription,
      transcription_source: transcriptionSource,
      email_draft: emailDraft,
      status: 'ready',
      created_at: capture.createdAt,
    }).select().single();

    if (dbError) throw dbError;

    // Update local record
    await db.captures.update(capture.id, {
      remoteId: inserted?.id,
      photoUrl,
      audioUrl,
      name: extractedData.name || capture.name,
      company: extractedData.company || capture.company,
      email: extractedData.email || capture.email,
      phone: extractedData.phone || capture.phone,
      audioTranscription,
      transcriptionSource,
      emailDraft,
      status: 'ready',
      syncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown sync error';
    await db.captures.update(captureId, {
      status: 'error',
      processingError: errorMsg,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function syncAllCaptures(): Promise<void> {
  const unsynced = await db.captures
    .where('status')
    .anyOf(['captured', 'error'])
    .toArray();

  for (const capture of unsynced) {
    if (capture.id) {
      await syncCapture(capture.id);
    }
  }
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
