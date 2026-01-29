'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, duration?: number, transcription?: string) => void;
  onCancel?: () => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
    SpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

const MAX_DURATION = 60;

export default function VoiceRecorder({ onRecordingComplete, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptionRef = useRef('');
  const streamRef = useRef<MediaStream | null>(null);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
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
      transcriptionRef.current = '';
      setTranscription('');

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
        const finalTranscription = transcriptionRef.current.trim() || undefined;
        onRecordingComplete(blob, duration, finalTranscription);
      };

      // Start speech recognition if available
      const SpeechRecognitionClass =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalText = '';
          let interimText = '';
          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalText += result[0].transcript;
            } else {
              interimText += result[0].transcript;
            }
          }
          transcriptionRef.current = finalText;
          setTranscription(finalText + interimText);
        };

        recognition.onerror = () => {
          // Speech recognition error is non-fatal; recording continues
        };

        recognition.onend = () => {
          // Recognition may auto-stop; don't restart
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

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
  useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (recognitionRef.current) {
      recognitionRef.current.stop();
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
      <div className="bg-[#2d331f] border border-[#3d4a2a] rounded-lg p-6 text-center">
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-[#1a1f16] border border-[#3d4a2a] text-[#c8d5a3] rounded-lg text-sm hover:bg-[#2d331f] transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#2d331f] border border-[#3d4a2a] rounded-lg p-6">
      {/* Recording indicator and timer */}
      <div className="flex items-center justify-center gap-3 mb-4">
        {isRecording && (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
        )}
        <span className="text-[#c8d5a3] text-2xl font-mono font-bold tabular-nums">
          {formatTime(elapsed)}
        </span>
        <span className="text-[#8b956d] text-xs">/ {formatTime(MAX_DURATION)}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[#1a1f16] rounded-full h-1.5 mb-4">
        <div
          className="bg-red-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(elapsed / MAX_DURATION) * 100}%` }}
        />
      </div>

      {/* Live transcription */}
      {transcription && (
        <div className="mb-4 p-3 bg-[#1a1f16] rounded border border-[#3d4a2a] max-h-24 overflow-y-auto">
          <p className="text-[#c8d5a3] text-sm leading-relaxed">{transcription}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handleCancel}
          className="px-5 py-2.5 bg-[#1a1f16] border border-[#3d4a2a] text-[#8b956d] rounded-lg text-sm font-medium hover:text-[#c8d5a3] hover:border-[#4a5d23] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={stopRecording}
          disabled={!isRecording}
          className="px-5 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          Stop Recording
        </button>
      </div>
    </div>
  );
}
