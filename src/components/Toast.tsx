'use client';

import { useEffect, useState } from 'react';

type Listener = (msg: string) => void;
const listeners = new Set<Listener>();

export function toast(message: string): void {
  listeners.forEach((l) => l(message));
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const l: Listener = (m) => {
      setMsg(m);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(null), 2200);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
      window.clearTimeout(timer);
    };
  }, []);
  if (!msg) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 84px)' }}>
      <div className="rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-bg shadow-lg">{msg}</div>
    </div>
  );
}
