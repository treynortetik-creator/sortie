'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/db';

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [defaultEvent, setDefaultEvent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

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
      setTimeout(() => setCleared(false), 3000);
    } catch (err) {
      console.error('Failed to clear data:', err);
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
      }
    };
    loadSettings();
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#1a1f16]">
      {/* Header */}
      <div className="border-b border-[#3d4a2a] px-4 py-4">
        <h1 className="text-xl font-bold text-[#c8d5a3] tracking-wide">
          Settings
        </h1>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        {/* Profile */}
        <div className="bg-[#2d331f] border border-[#3d4a2a] rounded-lg p-4 space-y-4">
          <h2 className="text-[#e8c547] text-xs uppercase tracking-wider font-semibold">
            Profile
          </h2>

          <div>
            <label className="block text-[#8b956d] text-xs uppercase tracking-wider mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#1a1f16] border border-[#3d4a2a] rounded px-3 py-2 text-[#c8d5a3] text-sm focus:outline-none focus:border-[#4a5d23]"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-[#8b956d] text-xs uppercase tracking-wider mb-1">
              Email
            </label>
            <p className="text-[#8b956d] text-sm px-3 py-2">
              {user.email || 'Not set'}
            </p>
          </div>
        </div>

        {/* Defaults */}
        <div className="bg-[#2d331f] border border-[#3d4a2a] rounded-lg p-4 space-y-4">
          <h2 className="text-[#e8c547] text-xs uppercase tracking-wider font-semibold">
            Defaults
          </h2>

          <div>
            <label className="block text-[#8b956d] text-xs uppercase tracking-wider mb-1">
              Default Event
            </label>
            <input
              type="text"
              value={defaultEvent}
              onChange={(e) => setDefaultEvent(e.target.value)}
              className="w-full bg-[#1a1f16] border border-[#3d4a2a] rounded px-3 py-2 text-[#c8d5a3] text-sm focus:outline-none focus:border-[#4a5d23]"
              placeholder="e.g. CES 2026"
            />
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#4a5d23] hover:bg-[#5a7028] disabled:opacity-50 text-[#c8d5a3] font-semibold uppercase tracking-wider text-sm py-3 rounded transition-colors"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>

        {/* Account */}
        <div className="bg-[#2d331f] border border-[#3d4a2a] rounded-lg p-4 space-y-4">
          <h2 className="text-[#e8c547] text-xs uppercase tracking-wider font-semibold">
            Account
          </h2>

          <button
            onClick={handleSignOut}
            className="w-full bg-[#1a1f16] border border-[#3d4a2a] text-[#c8d5a3] hover:bg-red-900/30 hover:border-red-700/50 hover:text-red-300 text-sm py-2.5 rounded transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Data Management */}
        <div className="bg-[#2d331f] border border-[#3d4a2a] rounded-lg p-4 space-y-4">
          <h2 className="text-[#e8c547] text-xs uppercase tracking-wider font-semibold">
            Data Management
          </h2>

          <button
            onClick={handleClearData}
            disabled={clearing}
            className="w-full bg-red-900/20 border border-red-700/30 text-red-400 hover:bg-red-900/40 disabled:opacity-50 text-sm py-2.5 rounded transition-colors"
          >
            {clearing ? 'Clearing...' : cleared ? 'Data Cleared' : 'Clear Local Data'}
          </button>
          <p className="text-[#8b956d]/50 text-xs">
            Removes all locally stored captures, events, and settings. This cannot be undone.
          </p>
        </div>

        {/* App Info */}
        <div className="text-center space-y-1 pt-4 pb-8">
          <p className="text-[#e8c547] font-bold tracking-[0.2em] text-sm">
            SORTIE
          </p>
          <p className="text-[#8b956d]/50 text-xs">
            Version 1.0.0
          </p>
          <p className="text-[#8b956d]/30 text-xs">
            Lead Capture Mission Control
          </p>
        </div>
      </div>
    </div>
  );
}
