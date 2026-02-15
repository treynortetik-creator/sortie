'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useEvent } from '@/contexts/EventContext';
import { useConnection } from '@/contexts/ConnectionContext';
import { db, type LocalCapture } from '@/lib/db';
import { syncCapture } from '@/lib/sync';
import StatusBadge from '@/components/StatusBadge';
import BottomNav from '@/components/BottomNav';

export default function CapturePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { currentEvent } = useEvent();
  const { isOnline } = useConnection();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captures, setCaptures] = useState<LocalCapture[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({});
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [captureFlash, setCaptureFlash] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!currentEvent) {
      router.push('/event-select');
    }
  }, [user, currentEvent, router]);

  const startCamera = useCallback(async () => {
    setCameraError('');
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(true);
      }
    } catch (err) {
      console.error('Camera access failed:', err);
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setCameraError('Camera permission denied. Please allow camera access in your browser settings and try again.');
        } else if (err.name === 'NotFoundError') {
          setCameraError('No camera found on this device.');
        } else if (err.name === 'NotReadableError') {
          setCameraError('Camera is in use by another application. Close other apps using the camera and try again.');
        } else {
          setCameraError(`Camera error: ${err.message}`);
        }
      } else {
        setCameraError('Failed to access camera. Please check your device settings.');
      }
    }
  }, []);

  useEffect(() => {
    startCamera(); // eslint-disable-line react-hooks/set-state-in-effect -- initializing camera on mount

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

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

    // Resize to max 1280px on longest side to reduce storage and upload size
    const MAX_DIM = 1280;
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > MAX_DIM || h > MAX_DIM) {
      const scale = MAX_DIM / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
    );
    if (!blob) return;

    // Flash feedback
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 150);

    const id = await db.captures.add({
      userId: user.id,
      submitterEmail: user.email ?? undefined,
      event: currentEvent,
      imageBlob: blob,
      status: 'captured',
      createdAt: new Date().toISOString(),
    });

    // Navigate directly to capture detail for editing
    router.push(`/captures/${id}`);

    // Fire-and-forget sync in background
    if (isOnline) {
      syncCapture(id as number).catch((err) => {
        console.error('Sync failed:', err);
      });
    }
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-olive-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-olive-700 border-t-olive-muted rounded-full animate-spin" />
          <p className="text-olive-muted text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user || !currentEvent) return null;

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
      <canvas ref={canvasRef} className="hidden" />

      {/* Compact Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/60 to-transparent" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div>
          <h1 className="text-olive-text font-semibold text-xs uppercase tracking-wider">CAPTURE</h1>
          <p className="text-gold text-xs truncate max-w-[200px]">{currentEvent}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-white/70 text-xs">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Full-screen Viewfinder */}
      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div role="alert" className="absolute inset-0 bg-olive-900 flex flex-col items-center justify-center p-6 gap-4">
            <p className="text-olive-muted text-center text-sm">{cameraError}</p>
            <button
              onClick={startCamera}
              className="bg-olive-600 hover:bg-olive-500 text-olive-text text-sm font-semibold px-5 py-2.5 rounded-lg active:scale-95 transition-all"
            >
              Try Again
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {captureFlash && (
          <div className="absolute inset-0 bg-white z-20 pointer-events-none animate-[fadeOut_150ms_ease-out_forwards]" />
        )}
      </div>

      {/* Bottom Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Recent Captures Strip */}
        <div className="px-4 pb-3">
          {captures.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
              {captures.slice(0, 20).map((cap) => (
                <Link
                  key={cap.id}
                  href={`/captures/${cap.id}`}
                  aria-label={`View capture ${cap.id}`}
                  className="flex-shrink-0 relative active:scale-95 transition-transform"
                >
                  <div className="w-[48px] h-[48px] rounded-lg border-2 border-white/20 overflow-hidden bg-olive-800">
                    {cap.id && thumbnailUrls[cap.id] && (
                      /* eslint-disable-next-line @next/next/no-img-element -- blob URL from IndexedDB */
                      <img
                        src={thumbnailUrls[cap.id]}
                        alt="Capture"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="absolute -bottom-1 left-0 right-0 flex justify-center">
                    <StatusBadge status={cap.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Capture Button + Process All */}
        <div className="flex items-center justify-center gap-6 pb-4">
          {/* Process All (left) */}
          <div className="w-20 flex justify-center">
            {hasCaptured && (
              <button
                onClick={handleProcessAll}
                aria-label="Process all unsynced captures"
                className="bg-gold/20 text-gold text-[10px] uppercase tracking-wider font-semibold px-3 py-2 rounded-lg active:scale-95 transition-transform"
              >
                Process
              </button>
            )}
          </div>

          {/* Shutter Button (center) */}
          <button
            aria-label="Take photo"
            onClick={handleCapture}
            disabled={!cameraReady}
            className="w-[84px] h-[84px] rounded-full border-[6px] border-white/90 flex items-center justify-center disabled:opacity-30 transition-transform active:scale-90 shadow-lg shadow-black/30"
          >
            <div className="w-[64px] h-[64px] rounded-full bg-white" />
          </button>

          {/* Capture count (right) */}
          <div className="w-20 flex justify-center">
            {captures.length > 0 && (
              <Link
                href="/captures"
                className="text-white/70 text-xs text-center active:scale-95 transition-transform"
              >
                <span className="block text-white text-lg font-bold">{captures.length}</span>
                <span className="text-[10px] uppercase tracking-wider">Captures</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
