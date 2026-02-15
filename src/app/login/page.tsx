'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/event-select');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed. Check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-olive-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold tracking-[0.3em] text-gold mb-2">
            SORTIE
          </h1>
          <p className="text-olive-muted text-sm tracking-widest uppercase">
            Lead Capture Mission Control
          </p>
        </div>

        <form
          aria-label="Sign in"
          onSubmit={handleSubmit}
          className="bg-olive-800 border border-olive-700 rounded-lg p-8 space-y-6"
        >
          {error && (
            <div role="alert" className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm rounded px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-olive-muted text-xs uppercase tracking-wider mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-olive-900 border border-olive-700 rounded px-4 py-3 text-olive-text placeholder-olive-muted/50 focus:outline-none focus:border-olive-600 focus:ring-1 focus:ring-olive-600 transition-colors"
              placeholder="operator@sortie.app"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-olive-muted text-xs uppercase tracking-wider mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-olive-900 border border-olive-700 rounded px-4 py-3 text-olive-text placeholder-olive-muted/50 focus:outline-none focus:border-olive-600 focus:ring-1 focus:ring-olive-600 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-olive-600 hover:bg-olive-500 disabled:opacity-50 disabled:cursor-not-allowed text-olive-text font-semibold uppercase tracking-wider text-sm py-3.5 rounded transition-colors active:scale-[0.98]"
          >
            {loading ? 'Authenticating...' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-olive-muted/50 text-xs mt-8">
          Sortie v1.0 — Secure Access Only
        </p>
      </div>
    </div>
  );
}
