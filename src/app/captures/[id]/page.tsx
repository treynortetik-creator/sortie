'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { db, type LocalCapture } from '@/lib/db';
import { syncCapture } from '@/lib/sync';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';

const VoiceRecorder = dynamic(() => import('@/components/VoiceRecorder'), {
  ssr: false,
  loading: () => <div className="bg-olive-800 border border-olive-700 rounded-xl p-5 text-center text-olive-muted text-sm">Loading recorder...</div>,
});

export default function CaptureDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const captureId = Number(params.id);

  const [capture, setCapture] = useState<LocalCapture | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadCapture = useCallback(async () => {
    try {
      const record = await db.captures.get(captureId);
      if (!record) {
        router.push('/captures');
        return;
      }
      setCapture(record);
      setName(record.name || '');
      setCompany(record.company || '');
      setEmail(record.email || '');
      setPhone(record.phone || '');
      setNotes(record.notes || '');
      setEmailDraft(record.emailDraft || '');

      if (record.imageBlob) {
        setImageUrl(URL.createObjectURL(record.imageBlob));
      }
      if (record.audioBlob) {
        setAudioUrl(URL.createObjectURL(record.audioBlob));
      }
    } catch (err) {
      console.error('Failed to load capture:', err);
      router.push('/captures');
    } finally {
      setLoading(false);
    }
  }, [captureId, router]);

  useEffect(() => {
    loadCapture();

    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCapture]);

  const handleSave = async () => {
    if (!capture?.id) return;
    setSaving(true);
    try {
      await db.captures.update(capture.id, {
        name,
        company,
        email,
        phone,
        notes,
        emailDraft,
      });
      setSaved(true);
      toast('Changes saved', 'success');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
      toast('Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleVoiceRecordingComplete = async (blob: Blob) => {
    if (!capture?.id) return;
    await db.captures.update(capture.id, { audioBlob: blob });
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(blob));
    setShowVoiceRecorder(false);
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(emailDraft);
      toast('Email copied to clipboard', 'success');
    } catch (err) {
      console.error('Clipboard write failed:', err);
      toast('Failed to copy email', 'error');
    }
  };

  const handleOpenMail = () => {
    const subject = encodeURIComponent(
      `Great connecting${name ? ` ${name}` : ''}${capture?.event ? ` at ${capture.event}` : ''}`
    );
    const body = encodeURIComponent(emailDraft);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self');
  };

  const handleReSync = async () => {
    if (!capture?.id) return;
    setSyncing(true);
    try {
      await syncCapture(capture.id);
      await loadCapture();
      toast('Re-sync complete', 'success');
    } catch (err) {
      console.error('Re-sync failed:', err);
      toast('Re-sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-olive-900 flex items-center justify-center">
        <p className="text-olive-muted">Loading...</p>
      </div>
    );
  }

  if (!capture) return null;

  return (
    <div className="min-h-screen bg-olive-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-olive-900 border-b border-olive-700 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/captures')}
          className="text-olive-muted hover:text-olive-text text-sm flex items-center gap-1 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </button>
        <StatusBadge status={capture.status} />
      </div>

      <div className="px-4 py-4 space-y-6 max-w-lg mx-auto">
        {/* Error / Needs Review banner */}
        {(capture.status === 'error' || capture.status === 'needs_review') && (
          <div className={`rounded-lg p-4 flex items-start gap-3 ${
            capture.status === 'error'
              ? 'bg-red-900/20 border border-red-800/40'
              : 'bg-orange-900/20 border border-orange-800/40'
          }`}>
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                capture.status === 'error' ? 'text-red-400' : 'text-orange-400'
              }`}>
                {capture.status === 'error' ? 'Sync Failed' : 'Needs Review'}
              </p>
              {capture.processingError && (
                <p className="text-xs text-olive-muted mt-1 line-clamp-3">
                  {capture.processingError}
                </p>
              )}
            </div>
            <button
              onClick={handleReSync}
              disabled={syncing}
              className="flex-shrink-0 bg-olive-600 hover:bg-olive-500 disabled:opacity-50 text-olive-text text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              {syncing ? 'Syncing...' : 'Retry'}
            </button>
          </div>
        )}

        {/* Photo */}
        {imageUrl && (
          <div className="rounded-lg overflow-hidden border border-olive-700">
            <img
              src={imageUrl}
              alt="Captured lead"
              className="w-full object-contain"
            />
          </div>
        )}

        {/* Extracted Data */}
        <div className="bg-olive-800 border border-olive-700 rounded-lg p-4 space-y-4">
          <h2 className="text-gold text-xs uppercase tracking-wider font-semibold">
            Contact Information
          </h2>

          <div>
            <label className="block text-olive-muted text-xs uppercase tracking-wider mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-olive-900 border border-olive-700 rounded px-3 py-2 text-olive-text text-sm focus:outline-none focus:border-olive-600"
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="block text-olive-muted text-xs uppercase tracking-wider mb-1">
              Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full bg-olive-900 border border-olive-700 rounded px-3 py-2 text-olive-text text-sm focus:outline-none focus:border-olive-600"
              placeholder="Company name"
            />
          </div>

          <div>
            <label className="block text-olive-muted text-xs uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-olive-900 border border-olive-700 rounded px-3 py-2 text-olive-text text-sm focus:outline-none focus:border-olive-600"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-olive-muted text-xs uppercase tracking-wider mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-olive-900 border border-olive-700 rounded px-3 py-2 text-olive-text text-sm focus:outline-none focus:border-olive-600"
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="bg-olive-800 border border-olive-700 rounded-lg p-4 space-y-3">
          <h2 className="text-gold text-xs uppercase tracking-wider font-semibold">
            Notes
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-olive-900 border border-olive-700 rounded px-3 py-2 text-olive-text text-sm focus:outline-none focus:border-olive-600 resize-none"
            placeholder="Notes about this contact..."
          />
        </div>

        {/* Audio */}
        <div className="bg-olive-800 border border-olive-700 rounded-lg p-4 space-y-3">
          <h2 className="text-gold text-xs uppercase tracking-wider font-semibold">
            Voice Note
          </h2>
          {audioUrl ? (
            <audio controls src={audioUrl} className="w-full" />
          ) : (
            <p className="text-olive-muted text-sm">No voice note recorded</p>
          )}
          <button
            onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
            className="text-sm bg-olive-900 border border-olive-700 text-olive-muted hover:text-olive-text px-3 py-2 rounded transition-colors"
          >
            {showVoiceRecorder ? 'Cancel' : audioUrl ? 'Re-record Notes' : 'Record Voice Note'}
          </button>
          {showVoiceRecorder && (
            <VoiceRecorder onRecordingComplete={handleVoiceRecordingComplete} />
          )}
        </div>

        {/* Email Draft */}
        <div className="bg-olive-800 border border-olive-700 rounded-lg p-4 space-y-3">
          <h2 className="text-gold text-xs uppercase tracking-wider font-semibold">
            Email Draft
          </h2>
          <textarea
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            rows={6}
            className="w-full bg-olive-900 border border-olive-700 rounded px-3 py-2 text-olive-text text-sm focus:outline-none focus:border-olive-600 resize-none"
            placeholder="Email draft will appear here after processing..."
          />
          <div className="flex gap-3">
            <button
              onClick={handleCopyEmail}
              disabled={!emailDraft}
              className="flex-1 bg-olive-900 border border-olive-700 text-olive-muted hover:text-olive-text disabled:opacity-40 text-sm py-2 rounded transition-colors"
            >
              Copy Email
            </button>
            <button
              onClick={handleOpenMail}
              disabled={!emailDraft || !email}
              className="flex-1 bg-olive-600 hover:bg-olive-500 text-olive-text disabled:opacity-40 text-sm py-2 rounded transition-colors"
            >
              Open in Mail
            </button>
          </div>
        </div>

        {/* Save / Meta */}
        <div className="space-y-3 pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-olive-600 hover:bg-olive-500 disabled:opacity-50 text-olive-text font-semibold uppercase tracking-wider text-sm py-3 rounded transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>

          <div className="text-center text-olive-muted/50 text-xs space-y-1">
            <p>Event: {capture.event}</p>
            <p>
              Captured: {new Date(capture.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
