'use client';

import { useConnection } from '@/contexts/ConnectionContext';
import { useEvent } from '@/contexts/EventContext';

export default function Header() {
  const { isOnline } = useConnection();
  const { currentEvent } = useEvent();

  return (
    <header className="bg-olive-900 border-b border-olive-700 px-4 py-2.5 pt-safe flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-2.5 min-w-0">
        <h1 className="text-olive-text text-lg font-bold uppercase tracking-[0.3em] select-none flex-shrink-0">
          SORTIE
        </h1>
        {currentEvent && (
          <span className="text-gold text-xs font-medium truncate max-w-[140px] bg-gold/10 px-2 py-0.5 rounded">
            {currentEvent}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          aria-label={isOnline ? 'Online' : 'Offline'}
          className={`inline-block w-2 h-2 rounded-full ${
            isOnline ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-olive-muted text-[0.625rem] font-medium uppercase tracking-wider">
          {isOnline ? 'ON' : 'OFF'}
        </span>
      </div>
    </header>
  );
}
