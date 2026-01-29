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
    <div className="min-h-screen bg-[#1a1f16] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold tracking-[0.3em] text-[#e8c547] mb-2">
            SORTIE
          </h1>
          <p className="text-[#8b956d] text-sm tracking-widest uppercase">
            Lead Capture Mission Control
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#2d331f] border border-[#3d4a2a] rounded-lg p-8 space-y-6"
        >
          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm rounded px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-[#8b956d] text-xs uppercase tracking-wider mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1a1f16] border border-[#3d4a2a] rounded px-4 py-3 text-[#c8d5a3] placeholder-[#8b956d]/50 focus:outline-none focus:border-[#4a5d23] focus:ring-1 focus:ring-[#4a5d23] transition-colors"
              placeholder="operator@sortie.app"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[#8b956d] text-xs uppercase tracking-wider mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1a1f16] border border-[#3d4a2a] rounded px-4 py-3 text-[#c8d5a3] placeholder-[#8b956d]/50 focus:outline-none focus:border-[#4a5d23] focus:ring-1 focus:ring-[#4a5d23] transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4a5d23] hover:bg-[#5a7028] disabled:opacity-50 disabled:cursor-not-allowed text-[#c8d5a3] font-semibold uppercase tracking-wider text-sm py-3 rounded transition-colors"
          >
            {loading ? 'Authenticating...' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-[#8b956d]/50 text-xs mt-8">
          Sortie v1.0 — Secure Access Only
        </p>
      </div>
    </div>
  );
}
