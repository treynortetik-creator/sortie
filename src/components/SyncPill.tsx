'use client';

import Link from 'next/link';
import { isPending, needsAttention } from '@/lib/db';
import { db, getQueue, kickQueue, useLive, useOnline } from '@/lib/runtime';
import { AlertIcon, CloudOffIcon, RefreshIcon } from './icons';

/** The always-visible truth about the queue: offline, working, stuck, or all caught up. */
export function SyncPill({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const online = useOnline();
  const counts = useLive(async () => {
    const leads = await db().leads.toArray();
    return {
      pending: leads.filter(isPending).length,
      running: leads.filter((l) => l.extract.status === 'running' || l.voice.status === 'running').length,
      attention: leads.filter(needsAttention).length,
      blocked: leads.filter((l) => l.extract.status === 'blocked' || l.voice.status === 'blocked').length,
      // Waiting for a retry after a failed request: the phone thinks it is online but the server is not answering.
      retrying: leads.filter((l) => (l.extract.status === 'queued' && l.extract.attempts > 0) || (l.voice.status === 'queued' && l.voice.attempts > 0)).length,
    };
  }, []);
  if (!counts) return null;

  const base = `inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-[13px] font-bold ${dark ? 'bg-black/55 text-white backdrop-blur' : 'bg-surface-2 text-ink'} ${className}`;

  if (counts.blocked > 0) {
    return (
      <Link href="/settings" className={`${base} !text-warn`}>
        <AlertIcon width={16} height={16} /> Setup needed · {counts.blocked}
      </Link>
    );
  }
  if (!online) {
    return (
      <span className={`${base} !text-warn`}>
        <CloudOffIcon width={16} height={16} /> Offline{counts.pending ? ` · ${counts.pending} waiting` : ''}
      </span>
    );
  }
  if (counts.retrying > 0) {
    return (
      <span className={`${base} !text-warn`}>
        <CloudOffIcon width={16} height={16} /> No connection · {counts.retrying} waiting
      </span>
    );
  }
  if (counts.attention > 0) {
    return (
      <button type="button" className={`${base} !text-bad`} onClick={() => getQueue().retry().then(kickQueue)}>
        <RefreshIcon width={16} height={16} /> {counts.attention} failed · retry
      </button>
    );
  }
  if (counts.pending > 0) {
    return (
      <span className={base}>
        <RefreshIcon width={16} height={16} className="spin" /> Reading {counts.pending}…
      </span>
    );
  }
  return (
    <span className={base}>
      <span className="h-2 w-2 rounded-full bg-ok" /> Synced
    </span>
  );
}
