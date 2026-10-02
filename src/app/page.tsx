'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EventSheet } from '@/components/EventSheet';
import { CameraIcon, CheckIcon, ChevronIcon, ImageIcon, XIcon } from '@/components/icons';
import { LeadForm } from '@/components/LeadForm';
import { SyncPill } from '@/components/SyncPill';
import { toast } from '@/components/Toast';
import { fileToJpeg, toJpeg } from '@/lib/image';
import { createLeadFromPhoto, deleteLeads, leadHasContact } from '@/lib/leads';
import { db, haptic, kickQueue, useBlobUrl, useLive } from '@/lib/runtime';
import { useActiveEvent } from '@/lib/useEvents';

type CamState = 'starting' | 'ready' | 'denied' | 'unavailable';

function Welcome({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 pb-[calc(var(--tabbar-h)+24px)] text-ink">
      <div className="w-full max-w-sm space-y-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={72} height={72} className="rounded-[18px]" />
        <div>
          <h1 className="text-3xl font-extrabold">Sortie</h1>
          <p className="mt-1 text-muted">Snap a badge or card, say a quick note, move on. Leads land in a CSV for Salesforce or HubSpot.</p>
        </div>
        <div>
          <label className="label" htmlFor="new-event">Name your first event</label>
          <input id="new-event" className="field" placeholder="e.g. FieldCon 2026" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && onCreate(name)} />
        </div>
        <button type="button" className="btn btn-primary w-full !min-h-[58px]" disabled={!name.trim()} onClick={() => onCreate(name)}>
          Start capturing
        </button>
      </div>
    </main>
  );
}

export default function CapturePage() {
  const ev = useActiveEvent();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState<CamState>('starting');
  const [flash, setFlash] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const eventId = ev.event?.id;
  const leads = useLive(() => (eventId ? db().leads.where('eventId').equals(eventId).sortBy('createdAt') : []), [eventId]) ?? [];
  const lead = leads.find((l) => l.id === openId) ?? null;
  const last = leads[leads.length - 1];
  const lastThumb = useBlobUrl(last?.image);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    await Promise.resolve();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam('unavailable');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      setCam('ready');
    } catch (e) {
      setCam(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
  }, []);

  // Camera runs only while the capture screen is visible and no sheet is covering it.
  useEffect(() => {
    if (!ev.event || openId) {
      stopCamera();
      return;
    }
    void startCamera(); // eslint-disable-line react-hooks/set-state-in-effect -- starts the camera hardware; state is set after awaiting it
    const onVis = () => (document.hidden ? stopCamera() : void startCamera());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stopCamera();
    };
  }, [ev.event, openId, startCamera, stopCamera]);

  async function save(blob: Blob) {
    if (!eventId) return;
    const l = await createLeadFromPhoto(db(), eventId, blob);
    haptic(30);
    setOpenId(l.id);
    kickQueue();
  }

  async function snap() {
    const v = videoRef.current;
    if (!v || busy || cam !== 'ready') return;
    setBusy(true);
    try {
      const blob = await toJpeg(v);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 140);
      await save(blob);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not take the photo');
    } finally {
      setBusy(false);
    }
  }

  async function onPicked(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await save(await fileToJpeg(file));
    } catch {
      toast('Could not read that photo');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function done() {
    if (lead) toast(`Saved · ${leads.length} lead${leads.length === 1 ? '' : 's'} at ${ev.event?.name}`);
    setOpenId(null);
  }

  async function discard() {
    if (!lead) return;
    if (leadHasContact(lead) || lead.audio || lead.notes) {
      if (!window.confirm('Delete this capture?')) return;
    }
    await deleteLeads(db(), [lead.id]);
    setOpenId(null);
  }

  if (ev.loading) return <main className="grid h-dvh place-items-center bg-black text-white/70">Loading…</main>;
  if (!ev.event) {
    return (
      <Welcome onCreate={(name) => void ev.create(name)} />
    );
  }

  return (
    <main className="fixed inset-0 z-50 bg-black text-white" style={{ bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom))' }}>
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" aria-label="Camera preview" />
      {flash && <div className="absolute inset-0 bg-white/80" />}

      {cam !== 'ready' && (
        <div className="absolute inset-0 grid place-items-center bg-neutral-900 p-8 text-center">
          <div className="max-w-xs space-y-4">
            <CameraIcon width={48} height={48} className="mx-auto text-white/60" />
            <p className="text-lg font-bold">
              {cam === 'starting' && 'Starting camera…'}
              {cam === 'denied' && 'Camera is blocked'}
              {cam === 'unavailable' && 'No live camera here'}
            </p>
            {cam === 'denied' && <p className="text-white/70">Allow camera access in your browser settings, then reopen. Or use the photo button.</p>}
            {cam === 'unavailable' && <p className="text-white/70">Use the button below to take or choose a photo.</p>}
            {cam !== 'starting' && (
              <button type="button" className="btn btn-primary w-full" onClick={() => fileRef.current?.click()}>
                <CameraIcon width={22} height={22} /> Take or choose photo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Framing guide */}
      {cam === 'ready' && !lead && (
        <div className="pointer-events-none absolute inset-x-6 top-[22%] bottom-[30%] rounded-3xl border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]">
          <p className="absolute -top-8 inset-x-0 text-center text-sm font-semibold text-white/90">Fit the badge or card in the frame</p>
        </div>
      )}

      <header className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-3 safe-top">
        <button type="button" onClick={() => setPicker(true)} className="inline-flex min-h-[40px] max-w-[60%] items-center gap-1 rounded-full bg-black/55 pl-4 pr-2 text-[15px] font-bold backdrop-blur">
          <span className="truncate">{ev.event.name}</span>
          <span className="rounded-full bg-white/20 px-2 text-[13px] tabular-nums">{leads.length}</span>
          <ChevronIcon width={18} height={18} className="rotate-90" />
        </button>
        <SyncPill dark />
      </header>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-8 pb-5 pt-10" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.65))' }}>
        <button type="button" className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl border-2 border-white/60 bg-white/10" aria-label={last ? 'Review last capture' : 'Choose a photo'} onClick={() => (last ? setOpenId(last.id) : fileRef.current?.click())}>
          {lastThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lastThumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon width={24} height={24} />
          )}
        </button>
        <button type="button" onClick={snap} disabled={cam !== 'ready' || busy} aria-label="Take photo" className="grid h-[84px] w-[84px] place-items-center rounded-full border-4 border-white bg-white/20 active:scale-95 disabled:opacity-40">
          <span className="block h-[64px] w-[64px] rounded-full bg-white" />
        </button>
        <button type="button" className="grid h-14 w-14 place-items-center rounded-full bg-white/15" aria-label="Choose photo from library" onClick={() => fileRef.current?.click()}>
          <ImageIcon width={26} height={26} />
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onPicked(e.target.files?.[0])} />

      {lead && (
        <div className="sheet-in fixed inset-0 z-50 flex flex-col bg-bg text-ink" role="dialog" aria-modal="true" aria-label="New lead">
          <div className="safe-top flex items-center justify-between px-4 pb-2">
            <h2 className="text-xl font-extrabold">New lead</h2>
            <SyncPill />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <LeadForm lead={lead} siblings={leads} onMerged={() => setOpenId(null)} />
          </div>
          <div className="safe-bottom grid grid-cols-[auto_1fr] gap-3 border-t border-line bg-bg px-4 pt-3">
            <button type="button" className="btn btn-danger !px-4" aria-label="Discard this capture" onClick={discard}>
              <XIcon width={22} height={22} />
            </button>
            <button type="button" className="btn btn-primary !min-h-[60px] !text-[19px]" onClick={done}>
              <CheckIcon width={24} height={24} /> Save &amp; next
            </button>
          </div>
        </div>
      )}

      {picker && <EventSheet ctx={ev} onClose={() => setPicker(false)} />}
    </main>
  );
}
