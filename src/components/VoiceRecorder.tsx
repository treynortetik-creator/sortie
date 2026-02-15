'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, duration?: number) => void;
  onCancel?: () => void;
}

const MAX_DURATION = 60;

export default function VoiceRecorder({ onRecordingComplete, onCancel }: VoiceRecorderProps): React.ReactNode {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        onRecordingComplete(blob, duration);
      };

      startTimeRef.current = Date.now();
      setElapsed(0);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        const currentElapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        setElapsed(currentElapsed);
        if (currentElapsed >= MAX_DURATION) {
          stopRecording();
        }
      }, 250);

      mediaRecorder.start(500);
    } catch (err) {
      setError('Could not access microphone. Please check permissions.');
      console.error('Recording error:', err);
    }
  }, [onRecordingComplete, stopRecording]);

  // Start recording on mount
  const startRecordingRef = useRef(startRecording);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  });

  useEffect(() => {
    startRecordingRef.current();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleCancel = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    onCancel?.();
  };

  if (error) {
    return (
      <div role="alert" className="bg-olive-800 border border-olive-700 rounded-lg p-6 text-center">
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button
          onClick={onCancel}
          aria-label="Cancel recording"
          className="px-4 py-2 bg-olive-900 border border-olive-700 text-olive-text rounded-lg text-sm hover:bg-olive-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="bg-olive-800 border border-olive-700 rounded-xl p-5">
      {/* Large stop button with pulsing ring */}
      <div className="flex justify-center mb-5">
        <button
          onClick={stopRecording}
          disabled={!isRecording}
          aria-label="Stop recording"
          className="relative w-[80px] h-[80px] rounded-full flex items-center justify-center disabled:opacity-50 active:scale-90 transition-transform"
        >
          {/* Pulsing ring */}
          {isRecording && (
            <span className="absolute inset-0 rounded-full border-[3px] border-red-500 animate-pulse-recording" />
          )}
          {/* Outer ring */}
          <span className="absolute inset-1 rounded-full border-[4px] border-red-500" />
          {/* Stop square */}
          <span className="w-[28px] h-[28px] rounded-sm bg-red-500" />
        </button>
      </div>

      {/* Timer */}
      <div className="flex items-center justify-center gap-2 mb-3">
        {isRecording && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        )}
        <span className="text-olive-text text-3xl font-mono font-bold tabular-nums">
          {formatTime(elapsed)}
        </span>
        <span className="text-olive-muted text-sm">/ {formatTime(MAX_DURATION)}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-olive-900 rounded-full h-2 mb-4">
        <div
          className="bg-red-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(elapsed / MAX_DURATION) * 100}%` }}
        />
      </div>

      {/* Cancel */}
      <div className="flex justify-center">
        <button
          onClick={handleCancel}
          aria-label="Cancel recording"
          className="px-6 py-3 bg-olive-900 border border-olive-700 text-olive-muted rounded-lg text-sm font-medium active:scale-95 transition-transform"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
