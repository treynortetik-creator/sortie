'use client';

import { useState, useEffect, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'sortie_install_dismissed';

function detectIsIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function shouldShowPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem(DISMISSED_KEY)) return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return false;
  if ('standalone' in navigator && (navigator as Record<string, unknown>).standalone) return false;
  if (window.innerWidth > 768) return false;
  return true;
}

export function InstallPrompt(): React.ReactNode {
  const isIOS = detectIsIOS();
  const [show, setShow] = useState<boolean>(() => {
    // On iOS, we can show immediately if conditions are met (no install prompt event needed)
    if (!shouldShowPrompt()) return false;
    return isIOS;
  });
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // On non-iOS, we wait for the beforeinstallprompt event
    if (isIOS) return;
    if (!shouldShowPrompt()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isIOS]);

  const handleInstall = async () => {
    if (deferredPromptRef.current) {
      await deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
      }
      deferredPromptRef.current = null;
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 pb-safe">
      <div className="bg-olive-800 border border-olive-700 rounded-xl p-4 shadow-lg max-w-lg mx-auto">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-olive-text text-sm font-medium">
              Install Sortie for the best experience
            </p>
            {isIOS ? (
              <p className="text-olive-muted text-xs mt-1">
                Tap <span className="text-olive-text">Share</span> then{' '}
                <span className="text-olive-text">Add to Home Screen</span>
              </p>
            ) : (
              <p className="text-olive-muted text-xs mt-1">
                Faster access, offline support, and persistent storage
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {!isIOS && (
              <button
                onClick={handleInstall}
                className="px-3 py-2 bg-olive-600 hover:bg-olive-500 text-olive-text text-xs font-semibold rounded-lg transition-colors"
              >
                Install
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="px-3 py-2 bg-olive-900 border border-olive-700 text-olive-muted text-xs rounded-lg transition-colors hover:text-olive-text"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
