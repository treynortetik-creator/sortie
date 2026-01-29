'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { useConnection } from '@/contexts/ConnectionContext';
import { db, type LocalCapture } from '@/lib/db';
import { syncCapture } from '@/lib/sync';
import VoiceRecorder from '@/components/VoiceRecorder';
import StatusBadge from '@/components/StatusBadge';
import BottomNav from '@/components/BottomNav';

function QuickNoteModal({
  onSave,
  onSkip,
}: {
  onSave: (notes: string, audioBlob?: Blob) => void;
  onSkip: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | undefined>();
  const [showVoice, setShowVoice] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSkip();
    }, 10000);
  }, [onSkip]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  const handleInteraction = () => {
    resetTimer();
  };

  const handleSave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onSave(notes, audioBlob);
  };

  const handleSkip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onSkip();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
      onClick={handleInteraction}
    >
      <div className="w-full max-w-lg bg-[#2d331f] border-t border-[#3d4a2a] rounded-t-2xl p-6 space-y-4">
        <h3 className="text-[#c8d5a3] font-semibold text-lg">Quick Note</h3>

        <input
          type="text"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            handleInteraction();
          }}
          placeholder="Add a note about this contact..."
          className="w-full bg-[#1a1f16] border border-[#3d4a2a] rounded px-4 py-3 text-[#c8d5a3] placeholder-[#8b956d]/50 focus:outline-none focus:border-[#4a5d23] focus:ring-1 focus:ring-[#4a5d23]"
          autoFocus
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setShowVoice(!showVoice);
              handleInteraction();
            }}
            aria-label="Toggle voice recorder"
            className="flex items-center gap-2 bg-[#1a1f16] border border-[#3d4a2a] text-[#8b956d] hover:text-[#c8d5a3] px-4 py-2 rounded transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                clipRule="evenodd"
              />
            </svg>
            {showVoice ? 'Hide Recorder' : 'Voice Note'}
          </button>
          {audioBlob && (
            <span className="text-[#4a5d23] text-sm">Audio recorded</span>
          )}
        </div>

        {showVoice && (
          <VoiceRecorder
            onRecordingComplete={(blob: Blob) => {
              setAudioBlob(blob);
              setShowVoice(false);
              handleInteraction();
            }}
          />
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            className="flex-1 bg-[#4a5d23] hover:bg-[#5a7028] text-[#c8d5a3] font-semibold uppercase tracking-wider text-sm py-3 rounded transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleSkip}
            className="flex-1 bg-[#1a1f16] border border-[#3d4a2a] text-[#8b956d] hover:text-[#c8d5a3] font-semibold uppercase tracking-wider text-sm py-3 rounded transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CapturePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentEvent } = useEvent();
  const { isOnline } = useConnection();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captures, setCaptures] = useState<LocalCapture[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({});
  const [showModal, setShowModal] = useState(false);
  const [lastCaptureId, setLastCaptureId] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!currentEvent) {
      router.push('/event-select');
    }
  }, [user, currentEvent, router]);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
        }
      } catch (err) {
        console.error('Camera access failed:', err);
        setCameraError('Camera access denied. Please grant permission to use the camera.');
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const loadCaptures = useCallback(async () => {
    if (!user || !currentEvent) return;
    const all = await db.captures
      .where({ userId: user.id, event: currentEvent })
      .reverse()
      .sortBy('createdAt');
    setCaptures(all);

    const urls: Record<number, string> = {};
    for (const cap of all) {
      if (cap.id && cap.imageBlob) {
        urls[cap.id] = URL.createObjectURL(cap.imageBlob);
      }
    }
    setThumbnailUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return urls;
    });
  }, [user, currentEvent]);

  useEffect(() => {
    loadCaptures(); // eslint-disable-line react-hooks/set-state-in-effect -- loading data from IndexedDB
  }, [loadCaptures]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || !user || !currentEvent) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
    );
    if (!blob) return;

    const id = await db.captures.add({
      userId: user.id,
      event: currentEvent,
      imageBlob: blob,
      status: 'captured',
      createdAt: new Date().toISOString(),
    });

    setLastCaptureId(id as number);
    setShowModal(true);
    await loadCaptures();

    if (isOnline) {
      try {
        await syncCapture(id as number);
      } catch (err) {
        console.error('Sync failed:', err);
      }
    }
  };

  const handleNoteSave = async (notes: string, audioBlob?: Blob) => {
    if (lastCaptureId == null) return;
    const update: Partial<Pick<LocalCapture, 'notes' | 'audioBlob'>> = {};
    if (notes) update.notes = notes;
    if (audioBlob) update.audioBlob = audioBlob;
    if (Object.keys(update).length > 0) {
      await db.captures.update(lastCaptureId, update);
    }
    setShowModal(false);
    setLastCaptureId(null);
    await loadCaptures();
  };

  const handleNoteSkip = () => {
    setShowModal(false);
    setLastCaptureId(null);
  };

  const handleProcessAll = async () => {
    const unsynced = captures.filter((c) => c.status === 'captured');
    for (const cap of unsynced) {
      if (cap.id) {
        try {
          await syncCapture(cap.id);
        } catch (err) {
          console.error(`Failed to sync capture ${cap.id}:`, err);
        }
      }
    }
    await loadCaptures();
  };

  const hasCaptured = captures.some((c) => c.status === 'captured');

  if (!user || !currentEvent) return null;

  return (
    <div className="min-h-screen bg-[#1a1f16] flex flex-col pb-16">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3d4a2a]">
        <div>
          <h1 className="text-[#c8d5a3] font-semibold text-sm">CAPTURE</h1>
          <p className="text-[#8b956d] text-xs">{currentEvent}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-[#8b956d] text-xs">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Viewfinder */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4">
        {cameraError ? (
          <div role="alert" className="w-full aspect-[3/4] max-w-md bg-[#2d331f] border border-[#3d4a2a] rounded-lg flex items-center justify-center p-6">
            <p className="text-[#8b956d] text-center text-sm">{cameraError}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-w-md aspect-[3/4] object-cover rounded-lg border border-[#3d4a2a] bg-black"
          />
        )}

        {/* Capture Button */}
        <div className="mt-6 mb-4">
          <button
            aria-label="Take photo"
            onClick={handleCapture}
            disabled={!cameraReady}
            className="w-20 h-20 rounded-full border-4 border-[#c8d5a3] flex items-center justify-center disabled:opacity-30 transition-transform active:scale-95"
          >
            <div className="w-14 h-14 rounded-full bg-[#c8d5a3]" />
          </button>
        </div>

        {/* Process All */}
        {hasCaptured && (
          <button
            onClick={handleProcessAll}
            className="mb-4 bg-[#e8c547]/20 text-[#e8c547] text-xs uppercase tracking-wider font-semibold px-4 py-2 rounded hover:bg-[#e8c547]/30 transition-colors"
          >
            Process All
          </button>
        )}
      </div>

      {/* Recent Captures */}
      {captures.length > 0 && (
        <div className="border-t border-[#3d4a2a] px-4 py-3">
          <p className="text-[#8b956d] text-xs uppercase tracking-wider mb-2">
            Recent Captures
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {captures.slice(0, 20).map((cap) => (
              <Link
                key={cap.id}
                href={`/captures/${cap.id}`}
                className="flex-shrink-0 relative"
              >
                <div className="w-16 h-16 rounded border border-[#3d4a2a] overflow-hidden bg-[#2d331f]">
                  {cap.id && thumbnailUrls[cap.id] && (
                    /* eslint-disable-next-line @next/next/no-img-element -- blob URL from IndexedDB */
                    <img
                      src={thumbnailUrls[cap.id]}
                      alt="Capture"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-0.5">
                  <StatusBadge status={cap.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Note Modal */}
      {showModal && (
        <QuickNoteModal onSave={handleNoteSave} onSkip={handleNoteSkip} />
      )}

      <BottomNav />
    </div>
  );
}
