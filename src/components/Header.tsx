'use client';

import { useConnection } from '@/contexts/ConnectionContext';
import { useEvent } from '@/contexts/EventContext';

export default function Header() {
  const { isOnline } = useConnection();
  const { currentEvent } = useEvent();

  return (
    <header className="bg-[#1a1f16] border-b border-[#3d4a2a] px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-[#c8d5a3] text-xl font-bold uppercase tracking-[0.3em] select-none">
          SORTIE
        </h1>
        {currentEvent && (
          <span className="text-[#e8c547] text-sm font-medium truncate max-w-[160px]">
            {currentEvent}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isOnline ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-[#8b956d] text-xs font-medium uppercase tracking-wider">
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
    </header>
  );
}
