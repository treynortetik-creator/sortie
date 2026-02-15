'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/db';
import BottomNav from '@/components/BottomNav';
import { useToast } from '@/components/Toast';

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [defaultEvent, setDefaultEvent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    setDisplayName(user.user_metadata?.display_name || user.email || '');
  }, [user, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.settings.put({
        key: 'displayName',
        value: displayName,
      });
      await db.settings.put({
        key: 'defaultEvent',
        value: defaultEvent,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Are you sure? This will delete all local captures and data. This cannot be undone.')) {
      return;
    }
    setClearing(true);
    try {
      await db.captures.clear();
      await db.events.clear();
      await db.settings.clear();
      setCleared(true);
      toast('All local data cleared', 'success');
      setTimeout(() => setCleared(false), 3000);
    } catch (err) {
      console.error('Failed to clear data:', err);
      toast('Failed to clear data', 'error');
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedName = await db.settings.get('displayName');
        const savedEvent = await db.settings.get('defaultEvent');
        if (savedName) setDisplayName(savedName.value);
        if (savedEvent) setDefaultEvent(savedEvent.value);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-olive-900 flex items-center justify-center">
        <p className="text-olive-muted">Loading settings...</p>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-olive-900">
      {/* Header */}
      <div className="border-b border-olive-700 px-4 py-4">
        <h1 className="text-xl font-bold text-olive-text tracking-wide">
          Settings
        </h1>
      </div>

      <div className="px-4 py-6 space-y-5 max-w-lg mx-auto pb-24">
        {/* Profile */}
        <div className="bg-olive-800 border border-olive-700 rounded-lg p-4 space-y-4">
          <h2 className="text-gold text-xs uppercase tracking-wider font-semibold">
            Profile
          </h2>

          <div>
            <label className="block text-olive-muted text-xs uppercase tracking-wider mb-2">
              Display Name
            </label>
            <input
              type="text"
              aria-label="Display name"
              autoComplete="name"
              enterKeyHint="done"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-olive-900 border border-olive-700 rounded-lg px-4 py-3 text-olive-text text-base focus:outline-none focus:border-olive-600"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-olive-muted text-xs uppercase tracking-wider mb-2">
              Email
            </label>
            <p className="text-olive-muted text-base px-4 py-3">
              {user.email || 'Not set'}
            </p>
          </div>
        </div>

        {/* Defaults */}
        <div className="bg-olive-800 border border-olive-700 rounded-lg p-4 space-y-4">
          <h2 className="text-gold text-xs uppercase tracking-wider font-semibold">
            Defaults
          </h2>

          <div>
            <label className="block text-olive-muted text-xs uppercase tracking-wider mb-2">
              Default Event
            </label>
            <input
              type="text"
              aria-label="Default event"
              autoComplete="off"
              enterKeyHint="done"
              value={defaultEvent}
              onChange={(e) => setDefaultEvent(e.target.value)}
              className="w-full bg-olive-900 border border-olive-700 rounded-lg px-4 py-3 text-olive-text text-base focus:outline-none focus:border-olive-600"
              placeholder="e.g. CES 2026"
            />
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-olive-600 hover:bg-olive-500 active:bg-[#3d4d1b] disabled:opacity-50 text-olive-text font-semibold uppercase tracking-wider text-sm py-3.5 rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>

        {/* Account */}
        <div className="bg-olive-800 border border-olive-700 rounded-lg p-4 space-y-4">
          <h2 className="text-gold text-xs uppercase tracking-wider font-semibold">
            Account
          </h2>

          <button
            onClick={handleSignOut}
            className="w-full bg-olive-900 border border-olive-700 text-olive-text hover:bg-red-900/30 hover:border-red-700/50 hover:text-red-300 active:bg-red-900/40 text-sm py-3 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Data Management */}
        <div className="bg-olive-800 border border-olive-700 rounded-lg p-4 space-y-4">
          <h2 className="text-gold text-xs uppercase tracking-wider font-semibold">
            Data Management
          </h2>

          <button
            onClick={handleClearData}
            disabled={clearing}
            className="w-full bg-red-900/20 border border-red-700/30 text-red-400 hover:bg-red-900/40 active:bg-red-900/50 disabled:opacity-50 text-sm py-3 rounded-lg transition-colors"
          >
            {clearing ? 'Clearing...' : cleared ? 'Data Cleared' : 'Clear Local Data'}
          </button>
          <p className="text-olive-muted/50 text-xs">
            Removes all locally stored captures, events, and settings. This cannot be undone.
          </p>
        </div>

        {/* App Info */}
        <div className="text-center space-y-1 pt-4 pb-8">
          <p className="text-gold font-bold tracking-[0.2em] text-sm">
            SORTIE
          </p>
          <p className="text-olive-muted/50 text-xs">
            Version 1.0.0
          </p>
          <p className="text-olive-muted/30 text-xs">
            Lead Capture Mission Control
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
