'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { EventProvider } from '@/contexts/EventContext';
import { ConnectionProvider } from '@/contexts/ConnectionContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider>
      <AuthProvider>
        <EventProvider>
          {children}
        </EventProvider>
      </AuthProvider>
    </ConnectionProvider>
  );
}
