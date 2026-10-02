'use client';

import { useEffect, useRef, useState } from 'react';
import { MAX_VOICE_SECONDS } from '@/lib/config';
import type { LeadRecord } from '@/lib/db';
import { attachVoiceNote, editField, removeVoiceNote } from '@/lib/leads';
import { canRecord, speechRecognitionCtor, startRecording, type ActiveRecorder } from '@/lib/recorder';
import { db, getQueue, haptic, kickQueue, useBlobUrl, useSettings } from '@/lib/runtime';
import { MicIcon, PlayIcon, RefreshIcon, StopIcon, TrashIcon } from './icons';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** One-tap voice note. Records locally, so it works with no signal; transcription happens through the queue. */
export function VoiceRecorder({ lead }: { lead: LeadRecord }) {
  const [settings] = useSettings();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const rec = useRef<ActiveRecorder | null>(null);
  const speech = useRef<{ stop(): void } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const audioUrl = useBlobUrl(lead.audio);
  const device = settings.speech === 'device' && !!speechRecognitionCtor();

  useEffect(
    () => () => {
      window.clearInterval(timer.current);
      rec.current?.cancel();
      speech.current?.stop();
    },
    [],
  );

  async function stop() {
    window.clearInterval(timer.current);
    setRecording(false);
    haptic(20);
    if (device) {
      speech.current?.stop();
      speech.current = null;
      return;
    }
    try {
      const r = await rec.current?.stop();
      rec.current = null;
      if (r) {
        await attachVoiceNote(db(), lead.id, r.blob, r.mime, r.seconds);
        kickQueue();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recording failed');
    }
  }

  async function start() {
    setError('');
    haptic(30);
    try {
      if (device) {
        const Ctor = speechRecognitionCtor();
        if (!Ctor) throw new Error('Speech recognition is not available');
        const sr = new Ctor();
        sr.continuous = true;
        sr.interimResults = false;
        sr.lang = navigator.language || 'en-US';
        let text = '';
        sr.onresult = (e) => {
          text = Array.from(e.results).map((r) => r[0].transcript).join(' ').trim();
        };
        sr.onend = () => {
          if (text) void editField(db(), lead.id, 'transcript', [lead.transcript, text].filter(Boolean).join(' '));
        };
        sr.onerror = (e) => setError(`Speech recognition: ${e.error}`);
        sr.start();
        speech.current = sr;
      } else {
        rec.current = await startRecording();
      }
      setRecording(true);
      setElapsed(0);
      const t0 = Date.now();
      timer.current = window.setInterval(() => {
        const s = Math.round((Date.now() - t0) / 1000);
        setElapsed(s);
        if (s >= MAX_VOICE_SECONDS) void stop();
      }, 250);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      setError(name === 'NotAllowedError' ? 'Microphone is blocked. Allow it in Settings > Safari (or the app).' : e instanceof Error ? e.message : 'Could not start recording');
    }
  }

  if (!canRecord() && !device) {
    return <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">Voice notes need a browser with microphone recording. Type notes below instead.</p>;
  }

  const hasAudio = !!lead.audio;
  const step = lead.voice;

  return (
    <div className="card p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={recording ? stop : start}
          aria-label={recording ? 'Stop recording' : hasAudio ? 'Record again' : 'Record voice note'}
          className={`grid h-16 w-16 shrink-0 place-items-center rounded-full ${recording ? 'rec-pulse bg-bad text-white' : 'bg-accent text-accent-ink'}`}
        >
          {recording ? <StopIcon width={28} height={28} /> : <MicIcon width={30} height={30} />}
        </button>
        <div className="min-w-0 flex-1">
          {recording ? (
            <p className="text-[17px] font-bold tabular-nums">Recording {mmss(elapsed)}</p>
          ) : hasAudio ? (
            <>
              <p className="text-[17px] font-bold">Voice note · {mmss(lead.audioSeconds ?? 0)}</p>
              <p className="truncate text-sm text-muted">
                {step.status === 'done' && 'Transcribed'}
                {step.status === 'queued' && (step.attempts ? 'Retrying shortly…' : 'Saved. Transcribes when online.')}
                {step.status === 'running' && 'Transcribing…'}
                {step.status === 'error' && `Couldn't transcribe: ${step.error ?? ''}`}
                {step.status === 'blocked' && (step.error ?? 'Needs setup')}
              </p>
            </>
          ) : (
            <>
              <p className="text-[17px] font-bold">Add a voice note</p>
              <p className="text-sm text-muted">Tap, say what matters, tap again.</p>
            </>
          )}
        </div>
        {hasAudio && !recording && (
          <div className="flex items-center gap-1">
            {audioUrl && (
              <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-surface-2" aria-label="Play voice note" onClick={() => void new Audio(audioUrl).play()}>
                <PlayIcon width={20} height={20} />
              </button>
            )}
            {(step.status === 'error' || step.status === 'blocked') && (
              <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-surface-2" aria-label="Retry transcription" onClick={() => void getQueue().retry(lead.id).then(kickQueue)}>
                <RefreshIcon width={20} height={20} />
              </button>
            )}
            <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-bad" aria-label="Delete voice note" onClick={() => void removeVoiceNote(db(), lead.id)}>
              <TrashIcon width={20} height={20} />
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      {(lead.transcript || step.status === 'done' || device) && (
        <div className="mt-3">
          <label className="label" htmlFor={`tr-${lead.id}`}>Transcript</label>
          <TranscriptField lead={lead} />
        </div>
      )}
    </div>
  );
}

function TranscriptField({ lead }: { lead: LeadRecord }) {
  const [text, setText] = useState(lead.transcript);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setText(lead.transcript);
  }, [lead.transcript]);
  return (
    <textarea
      id={`tr-${lead.id}`}
      className="field"
      value={text}
      rows={3}
      onChange={(e) => {
        dirty.current = true;
        setText(e.target.value);
      }}
      onBlur={() => dirty.current && void editField(db(), lead.id, 'transcript', text)}
    />
  );
}
