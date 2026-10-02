'use client';

import { useEffect, useState } from 'react';
import { SyncPill } from '@/components/SyncPill';
import { deliverFile } from '@/components/ExportSheet';
import { toast } from '@/components/Toast';
import { escapeCell } from '@/lib/csv';
import { db, formatUsd, getQueue, kickQueue, useLive, useServerStatus, useSettings } from '@/lib/runtime';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-4">
      <h2 className="text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const [s, update] = useSettings();
  const server = useServerStatus();
  const [key, setKey] = useState(s.byoKey);
  const [code, setCode] = useState(s.accessCode);
  const [storage, setStorage] = useState('');
  const costs = useLive(async () => (await db().leads.toArray()).flatMap((l) => l.costs.map((c) => ({ ...c, leadId: l.id }))), []) ?? [];
  const leadCount = useLive(() => db().leads.count(), []) ?? 0;

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.usage && setStorage(`${(e.usage / 1_048_576).toFixed(1)} MB used on this device`)).catch(() => {});
  }, [leadCount]);

  const total = costs.reduce((n, c) => n + (c.costUsd ?? 0), 0);
  const extractCount = costs.filter((c) => c.kind === 'extract').length;
  const perCapture = extractCount ? total / extractCount : 0;

  function applyAccess() {
    update({ byoKey: key.trim(), accessCode: code.trim() });
    void getQueue().onSettingsChanged().then(kickQueue);
    toast('Saved');
  }

  async function costLog() {
    const rows = ['kind,model,cost_usd,prompt_tokens,completion_tokens,time_utc', ...costs.sort((a, b) => a.at - b.at).map((c) => [c.kind, c.model, c.costUsd ?? '', c.promptTokens, c.completionTokens, new Date(c.at).toISOString()].map((v) => escapeCell(String(v))).join(','))];
    await deliverFile('sortie-cost-log.csv', rows.join('\r\n') + '\r\n');
  }

  async function slimDown() {
    const n = await db().leads.filter((l) => l.extract.status === 'done' && (l.voice.status === 'done' || l.voice.status === 'none')).modify((l) => {
      delete l.image;
      delete l.audio;
    });
    toast(`Removed photos and audio from ${n} lead${n === 1 ? '' : 's'}`);
  }

  async function wipe() {
    if (!window.confirm('Delete ALL events and leads from this device? Export first. This cannot be undone.')) return;
    await db().transaction('rw', db().events, db().leads, async () => {
      await db().leads.clear();
      await db().events.clear();
    });
    toast('Everything deleted');
  }

  return (
    <main className="page">
      <header className="safe-top flex items-center justify-between px-4 pb-3">
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <SyncPill />
      </header>
      <div className="space-y-4 px-4">
        <Section title="AI reading">
          <p className="text-sm text-muted">
            {server === null
              ? 'Checking this server…'
              : server.serverKey
                ? `This server has an OpenRouter key${server.needsCode ? ' and asks for an access code' : ''}. Reading: ${server.extractModel}. Speech: ${server.sttModel}.`
                : 'This server has no OpenRouter key. Paste your own below (stored only on this device).'}
          </p>
          {(server?.needsCode ?? false) && (
            <div>
              <label className="label" htmlFor="code">Access code</label>
              <input id="code" className="field" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="none" autoCorrect="off" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="key">Your OpenRouter API key (optional)</label>
            <input id="key" className="field" type="password" placeholder="sk-or-…" value={key} onChange={(e) => setKey(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <p className="mt-1 text-xs text-muted">Sent with each request over HTTPS and never stored on the server. Anyone with access to this phone can read it, so use a key with a low spending limit.</p>
          </div>
          <button type="button" className="btn btn-primary w-full" onClick={applyAccess}>Save</button>
        </Section>

        <Section title="Voice notes">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Transcription method">
            {([['server', 'Whisper (server)'], ['device', 'On this phone']] as const).map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={s.speech === v} className={`btn ${s.speech === v ? '!border-accent ring-2 ring-accent' : ''}`} onClick={() => update({ speech: v })}>{label}</button>
            ))}
          </div>
          <p className="text-xs text-muted">Whisper is the accurate default and works from a saved recording when you regain signal. &quot;On this phone&quot; uses the browser&apos;s built-in speech recognition (no audio leaves the device, experimental, English-leaning, needs a connection on some browsers).</p>
        </Section>

        <Section title="Cost on this device">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">Total</dt><dd className="text-lg font-extrabold">{formatUsd(total)}</dd></div>
            <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">Per capture</dt><dd className="text-lg font-extrabold">{formatUsd(perCapture)}</dd></div>
            <div className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">API calls</dt><dd className="text-lg font-extrabold">{costs.length}</dd></div>
          </dl>
          <button type="button" className="btn w-full" disabled={costs.length === 0} onClick={() => void costLog()}>Download cost log (CSV)</button>
        </Section>

        <Section title="Models (advanced)">
          <p className="text-xs text-muted">Only applies when you use your own key{server?.serverKey ? ' (this server pins its own models)' : ''}. Leave blank for the defaults.</p>
          <div>
            <label className="label" htmlFor="xm">Photo model</label>
            <input id="xm" className="field" placeholder={server?.extractModel ?? 'google/gemini-3.1-flash-lite'} value={s.extractModel} onChange={(e) => update({ extractModel: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </div>
          <div>
            <label className="label" htmlFor="sm">Speech model</label>
            <input id="sm" className="field" placeholder={server?.sttModel ?? 'openai/whisper-large-v3-turbo'} value={s.sttModel} onChange={(e) => update({ sttModel: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </div>
        </Section>

        <Section title="Install on iPhone">
          <ol className="list-decimal space-y-1 pl-5 text-[15px]">
            <li>Open this page in <b>Safari</b>.</li>
            <li>Tap the Share button, then <b>Add to Home Screen</b>.</li>
            <li>Open Sortie from the Home Screen. It runs full screen and works offline.</li>
          </ol>
        </Section>

        <Section title="Storage and privacy">
          <p className="text-sm text-muted">Leads, photos and voice notes live in this browser&apos;s storage ({storage || 'size unknown'}). A photo goes to the server only to be read, then it is dropped; nothing is saved server-side. Export regularly: clearing Safari data erases leads.</p>
          <button type="button" className="btn w-full" onClick={() => void slimDown()}>Free space: remove photos and audio from finished leads</button>
          <button type="button" className="btn btn-danger w-full" onClick={() => void wipe()}>Delete all data on this device</button>
        </Section>

        <p className="pb-4 text-center text-xs text-muted">Sortie 2.0 · open source · MIT</p>
      </div>
    </main>
  );
}
