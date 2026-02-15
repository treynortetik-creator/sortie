'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { EventProvider } from '@/contexts/EventContext';
import { ConnectionProvider } from '@/contexts/ConnectionContext';
import { ToastProvider } from '@/components/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider>
      <AuthProvider>
        <EventProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </EventProvider>
      </AuthProvider>
    </ConnectionProvider>
  );
}
