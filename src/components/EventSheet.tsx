'use client';

import { useState } from 'react';
import type { ActiveEvent } from '@/lib/useEvents';
import { CheckIcon, PlusIcon, XIcon } from './icons';

/** Switch or create an event from the event chip. */
export function EventSheet({ ctx, onClose }: { ctx: ActiveEvent; onClose: () => void }) {
  const [name, setName] = useState('');
  async function add() {
    if (!name.trim()) return;
    await ctx.create(name);
    setName('');
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" role="dialog" aria-modal="true" aria-label="Choose event">
      <div className="sheet-in safe-bottom max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-bg p-4 text-ink">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Switch event</h2>
          <button type="button" aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-surface-2" onClick={onClose}>
            <XIcon width={20} height={20} />
          </button>
        </div>
        {ctx.events.length > 0 && (
          <ul className="mb-4 space-y-2">
            {ctx.events.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="card flex min-h-[56px] w-full items-center justify-between px-4 text-left text-[17px] font-semibold"
                  onClick={() => {
                    ctx.setActive(e.id);
                    onClose();
                  }}
                >
                  {e.name}
                  {ctx.event?.id === e.id && <CheckIcon width={22} height={22} className="text-ok" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="label" htmlFor="new-event">New event</label>
        <div className="flex gap-2">
          <input id="new-event" className="field" placeholder="e.g. FieldCon 2026" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add()} />
          <button type="button" className="btn btn-primary shrink-0" onClick={() => void add()} disabled={!name.trim()}>
            <PlusIcon width={20} height={20} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
