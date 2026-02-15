'use client';

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed top-4 left-4 right-4 z-[100] flex flex-col items-center gap-2 pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm w-full animate-[slideDown_200ms_ease-out] ${
              t.type === 'success'
                ? 'bg-green-900/90 text-green-200 border border-green-700/50'
                : t.type === 'error'
                  ? 'bg-red-900/90 text-red-200 border border-red-700/50'
                  : 'bg-olive-800/95 text-olive-text border border-olive-700'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
