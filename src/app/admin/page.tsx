'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'captures' | 'settings' | 'export';

interface SupabaseCapture {
  id: string;
  user_id: string;
  submitter_email: string | null;
  event_name: string;
  photo_url: string | null;
  audio_url: string | null;
  audio_duration: number | null;
  extracted_name: string | null;
  extracted_title: string | null;
  extracted_company: string | null;
  extracted_email: string | null;
  extracted_phone: string | null;
  notes: string | null;
  audio_transcription: string | null;
  transcription_source: string | null;
  status: string;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
}

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing?: { prompt: string; completion: string };
  contextLength?: number;
  inputModalities?: string[];
  modality?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'ready':
      return 'bg-green-900/30 text-green-400 border border-green-800/50';
    case 'needs_review':
      return 'bg-orange-900/30 text-orange-400 border border-orange-800/50';
    case 'error':
      return 'bg-red-900/30 text-red-400 border border-red-800/50';
    case 'processing':
      return 'bg-blue-900/30 text-blue-400 border border-blue-800/50';
    default:
      return 'bg-olive-800 text-olive-text border border-olive-700';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'ready': return 'Ready';
    case 'needs_review': return 'Needs Review';
    case 'error': return 'Error';
    case 'processing': return 'Processing';
    case 'captured': return 'Captured';
    default: return status;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminPage(): React.ReactNode {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('captures');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-olive-900 flex items-center justify-center">
        <p className="text-olive-muted">Loading...</p>
      </div>
    );
  }

  if (!user || !session) return null;

  const token = session.access_token;

  return (
    <div className="min-h-screen bg-olive-900">
      {/* Header */}
      <header className="border-b border-olive-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-gold font-bold text-lg tracking-wide uppercase stencil">
            Sortie Admin
          </h1>
          <nav className="flex gap-1 ml-6">
            {(['captures', 'settings', 'export'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-olive-700 text-olive-text'
                    : 'text-olive-muted hover:text-olive-text hover:bg-olive-800'
                }`}
              >
                {tab === 'captures' ? 'Events & Captures' : tab === 'settings' ? 'AI Settings' : 'Export'}
              </button>
            ))}
          </nav>
        </div>
        <span className="text-olive-muted text-xs">{user.email}</span>
      </header>

      {/* Tab Content */}
      <main className="p-6">
        {activeTab === 'captures' && <CapturesTab token={token} />}
        {activeTab === 'settings' && <SettingsTab token={token} />}
        {activeTab === 'export' && <ExportTab token={token} />}
      </main>
    </div>
  );
}

// ─── Tab 1: Events & Captures ────────────────────────────────────────────────

function CapturesTab({ token }: { token: string }): React.ReactNode {
  const [captures, setCaptures] = useState<SupabaseCapture[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    void loadCaptures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCaptures(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/captures', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const data: SupabaseCapture[] = json.captures ?? [];
        setCaptures(data);
        if (data.length > 0 && !selectedEvent) {
          const events = [...new Set(data.map((c) => c.event_name))];
          setSelectedEvent(events[0] ?? null);
        }
      } else {
        console.error('Failed to load captures:', res.status);
      }
    } catch (err) {
      console.error('Failed to load captures:', err);
    }
    setLoading(false);
  }

  // Group events
  const events = [...new Set(captures.map((c) => c.event_name))].sort();
  const eventCounts = new Map<string, number>();
  for (const c of captures) {
    eventCounts.set(c.event_name, (eventCounts.get(c.event_name) ?? 0) + 1);
  }

  // Filter captures for selected event
  let filtered = captures.filter((c) => c.event_name === selectedEvent);
  if (statusFilter !== 'all') {
    filtered = filtered.filter((c) => c.status === statusFilter);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.extracted_name?.toLowerCase().includes(q) ||
        c.extracted_title?.toLowerCase().includes(q) ||
        c.extracted_company?.toLowerCase().includes(q) ||
        c.extracted_email?.toLowerCase().includes(q) ||
        c.submitter_email?.toLowerCase().includes(q),
    );
  }

  if (loading) {
    return <p className="text-olive-muted">Loading captures...</p>;
  }

  if (captures.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-olive-muted text-lg">No captures synced yet</p>
        <p className="text-olive-muted/60 text-sm mt-2">
          Captures will appear here after syncing from the mobile app
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-140px)]">
      {/* Sidebar: Events */}
      <div className="w-56 flex-shrink-0">
        <h3 className="text-olive-muted text-xs uppercase tracking-wider font-semibold mb-3">
          Events
        </h3>
        <div className="space-y-1">
          {events.map((event) => (
            <button
              key={event}
              onClick={() => { setSelectedEvent(event); setExpandedId(null); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex justify-between items-center ${
                selectedEvent === event
                  ? 'bg-olive-700 text-olive-text'
                  : 'text-olive-muted hover:bg-olive-800 hover:text-olive-text'
              }`}
            >
              <span className="truncate">{event}</span>
              <span className="text-xs opacity-60 ml-2">{eventCounts.get(event)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main: Captures Table */}
      <div className="flex-1 min-w-0">
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Search name, company, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!w-64 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="!w-40 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="ready">Ready</option>
            <option value="needs_review">Needs Review</option>
            <option value="error">Error</option>
            <option value="processing">Processing</option>
            <option value="captured">Captured</option>
          </select>
          <button
            onClick={() => void loadCaptures()}
            className="px-3 py-2 bg-olive-800 border border-olive-700 text-olive-muted hover:text-olive-text rounded-lg text-sm transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="bg-olive-800 border border-olive-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-olive-700 text-olive-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 w-12"></th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((capture) => (
                <CaptureRow
                  key={capture.id}
                  capture={capture}
                  expanded={expandedId === capture.id}
                  onToggle={() => setExpandedId(expandedId === capture.id ? null : capture.id)}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-olive-muted">
                    No captures match filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-olive-muted/50 text-xs mt-2">
          {filtered.length} capture{filtered.length !== 1 ? 's' : ''}
          {selectedEvent ? ` for "${selectedEvent}"` : ''}
        </p>
      </div>
    </div>
  );
}

function CaptureRow({
  capture,
  expanded,
  onToggle,
}: {
  capture: SupabaseCapture;
  expanded: boolean;
  onToggle: () => void;
}): React.ReactNode {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-olive-700/50 hover:bg-olive-700/30 cursor-pointer transition-colors"
      >
        <td className="px-4 py-3">
          {capture.photo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={capture.photo_url}
              alt=""
              className="w-10 h-10 rounded object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-olive-700 flex items-center justify-center text-olive-muted text-xs">
              --
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="text-olive-text font-medium">
            {capture.extracted_name || <span className="text-olive-muted italic">Unknown</span>}
          </div>
          {capture.extracted_title && (
            <div className="text-olive-muted text-xs">{capture.extracted_title}</div>
          )}
        </td>
        <td className="px-4 py-3 text-olive-muted">
          {capture.extracted_company || '—'}
        </td>
        <td className="px-4 py-3 text-olive-muted">
          {capture.extracted_email || '—'}
        </td>
        <td className="px-4 py-3 text-olive-muted">
          {capture.extracted_phone || '—'}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(capture.status)}`}>
            {statusLabel(capture.status)}
          </span>
        </td>
        <td className="px-4 py-3 text-olive-muted text-xs">
          {formatDate(capture.created_at)}
        </td>
      </tr>
      {expanded && <CaptureDetail capture={capture} />}
    </>
  );
}

function CaptureDetail({ capture }: { capture: SupabaseCapture }): React.ReactNode {
  return (
    <tr>
      <td colSpan={7} className="bg-olive-900/50 px-6 py-5">
        <div className="grid grid-cols-2 gap-6 max-w-4xl">
          {/* Left: Photo */}
          <div>
            {capture.photo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={capture.photo_url}
                alt="Capture"
                className="w-full max-h-80 object-contain rounded-lg border border-olive-700"
              />
            ) : (
              <div className="w-full h-48 bg-olive-800 rounded-lg border border-olive-700 flex items-center justify-center text-olive-muted">
                No photo
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-olive-muted text-xs uppercase tracking-wider">Notes</span>
              <p className="text-olive-text mt-1">{capture.notes || 'None'}</p>
            </div>

            {capture.audio_transcription && (
              <div>
                <span className="text-olive-muted text-xs uppercase tracking-wider">
                  Transcription ({capture.transcription_source})
                </span>
                <p className="text-olive-text mt-1">{capture.audio_transcription}</p>
              </div>
            )}

            {capture.audio_url && (
              <div>
                <span className="text-olive-muted text-xs uppercase tracking-wider">Audio</span>
                <audio controls src={capture.audio_url} className="w-full mt-1" />
              </div>
            )}

            {capture.processing_error && (
              <div>
                <span className="text-red-400 text-xs uppercase tracking-wider">Error</span>
                <p className="text-red-400/80 mt-1 text-xs">{capture.processing_error}</p>
              </div>
            )}

            <div className="text-olive-muted/50 text-xs space-y-1 pt-2 border-t border-olive-700/50">
              <p>ID: {capture.id}</p>
              {capture.submitter_email && <p>Submitted by: {capture.submitter_email}</p>}
              <p>Created: {new Date(capture.created_at).toLocaleString()}</p>
              <p>Updated: {new Date(capture.updated_at).toLocaleString()}</p>
              {capture.photo_url && (
                <p className="truncate">
                  Photo: <a href={capture.photo_url} target="_blank" rel="noreferrer" className="text-gold/60 hover:text-gold">{capture.photo_url}</a>
                </p>
              )}
              {capture.audio_url && (
                <p className="truncate">
                  Audio: <a href={capture.audio_url} target="_blank" rel="noreferrer" className="text-gold/60 hover:text-gold">{capture.audio_url}</a>
                </p>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Tab 2: AI Settings ──────────────────────────────────────────────────────

function SettingsTab({ token }: { token: string }): React.ReactNode {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);

  const [extractionModel, setExtractionModel] = useState('');
  const [savedModel, setSavedModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [modelSearch, setModelSearch] = useState('');

  useEffect(() => {
    void loadModels();
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadModels(): Promise<void> {
    setLoadingModels(true);
    setModelError(null);
    try {
      const res = await fetch('/api/admin/models', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        setModelError(data.error ?? 'Failed to load models');
        return;
      }
      const data = await res.json();
      setModels(data.models ?? []);
    } catch {
      setModelError('Failed to connect to server');
    } finally {
      setLoadingModels(false);
    }
  }

  async function loadSettings(): Promise<void> {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const settings: Record<string, string> = data.settings ?? {};
        setExtractionModel(settings.extraction_model ?? '');
        setSavedModel(settings.extraction_model ?? '');
      }
    } catch {
      // Settings load failed — non-fatal
    }
  }

  async function saveExtractionModel(): Promise<void> {
    if (!extractionModel) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key: 'extraction_model', value: extractionModel }),
      });
      if (res.ok) {
        setSavedModel(extractionModel);
        setSaveMsg({ type: 'success', text: 'Model saved' });
      } else {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        setSaveMsg({ type: 'error', text: data.error ?? 'Failed to save' });
      }
    } catch {
      setSaveMsg({ type: 'error', text: 'Failed to connect to server' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  // Filter models for vision capability (extraction needs image input)
  const visionModels = models.filter(
    (m) => m.inputModalities?.includes('image') || m.modality === 'multimodal',
  );

  const filteredModels = modelSearch
    ? visionModels.filter(
        (m) =>
          m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
          m.name.toLowerCase().includes(modelSearch.toLowerCase()),
      )
    : visionModels;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Extraction Model */}
      <div className="bg-olive-800 border border-olive-700 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-gold text-sm uppercase tracking-wider font-semibold">
            Extraction Model
          </h3>
          <p className="text-olive-muted text-xs mt-1">
            Vision-capable model for reading business cards and badges via OpenRouter.
            {visionModels.length > 0 && ` ${visionModels.length} vision models available.`}
          </p>
        </div>

        {loadingModels ? (
          <p className="text-olive-muted text-sm">Loading models from OpenRouter...</p>
        ) : modelError ? (
          <div className="space-y-2">
            <p className="text-red-400 text-sm">{modelError}</p>
            <button
              onClick={() => void loadModels()}
              className="text-sm text-gold hover:text-gold-dark transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search models..."
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              className="text-sm"
            />
            <select
              value={extractionModel}
              onChange={(e) => setExtractionModel(e.target.value)}
              className="text-sm"
              size={8}
            >
              {!extractionModel && <option value="">Select a model...</option>}
              {filteredModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.id}
                  {m.pricing ? ` ($${m.pricing.prompt}/1K in, $${m.pricing.completion}/1K out)` : ''}
                </option>
              ))}
            </select>

            {extractionModel && (
              <p className="text-olive-muted text-xs">
                Selected: <span className="text-olive-text">{extractionModel}</span>
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => void saveExtractionModel()}
                disabled={saving || !extractionModel || extractionModel === savedModel}
                className="px-4 py-2 bg-olive-600 hover:bg-olive-500 disabled:opacity-40 text-olive-text text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save Model'}
              </button>
              {saveMsg && (
                <span className={`text-xs ${saveMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {saveMsg.text}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Transcription Info */}
      <div className="bg-olive-800 border border-olive-700 rounded-lg p-6 space-y-2">
        <h3 className="text-gold text-sm uppercase tracking-wider font-semibold">
          Transcription
        </h3>
        <p className="text-olive-muted text-sm">
          OpenAI Whisper (via <code className="text-olive-text">OPENAI_API_KEY</code>)
        </p>
        <p className="text-olive-muted/60 text-xs">
          Whisper transcription is configured via environment variable, not selectable through OpenRouter.
        </p>
      </div>
    </div>
  );
}

// ─── Tab 3: Export ───────────────────────────────────────────────────────────

function ExportTab({ token }: { token: string }): React.ReactNode {
  const [captures, setCaptures] = useState<SupabaseCapture[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState('__all__');

  useEffect(() => {
    void loadCaptures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCaptures(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/captures', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setCaptures(json.captures ?? []);
      } else {
        console.error('Failed to load captures:', res.status);
      }
    } catch (err) {
      console.error('Failed to load captures:', err);
    }
    setLoading(false);
  }

  const events = [...new Set(captures.map((c) => c.event_name))].sort();
  const filtered =
    selectedEvent === '__all__'
      ? captures
      : captures.filter((c) => c.event_name === selectedEvent);

  function exportCSV(): void {
    const headers = [
      'submitted_by', 'name', 'title', 'company', 'email', 'phone',
      'notes', 'transcription', 'status', 'photo_url', 'audio_url',
      'event', 'created_at',
    ];

    const rows = filtered.map((c) => [
      c.submitter_email ?? '',
      c.extracted_name ?? '',
      c.extracted_title ?? '',
      c.extracted_company ?? '',
      c.extracted_email ?? '',
      c.extracted_phone ?? '',
      c.notes ?? '',
      c.audio_transcription ?? '',
      c.status,
      c.photo_url ?? '',
      c.audio_url ?? '',
      c.event_name,
      c.created_at,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    downloadFile(csvContent, `sortie-export-${selectedEvent === '__all__' ? 'all' : selectedEvent}.csv`, 'text/csv');
  }

  function exportMarkdown(): void {
    const lines: string[] = [
      `# Sortie Export — ${selectedEvent === '__all__' ? 'All Events' : selectedEvent}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
    ];

    let currentEvent = '';
    for (const c of filtered) {
      if (c.event_name !== currentEvent) {
        currentEvent = c.event_name;
        lines.push(`## ${currentEvent}`, '');
      }

      lines.push(`### ${c.extracted_name || 'Unknown Contact'}`);
      if (c.extracted_title) lines.push(`- **Title:** ${c.extracted_title}`);
      if (c.extracted_company) lines.push(`- **Company:** ${c.extracted_company}`);
      if (c.extracted_email) lines.push(`- **Email:** ${c.extracted_email}`);
      if (c.extracted_phone) lines.push(`- **Phone:** ${c.extracted_phone}`);
      lines.push(`- **Status:** ${statusLabel(c.status)}`);
      if (c.notes) lines.push(`- **Notes:** ${c.notes}`);
      if (c.audio_transcription) lines.push(`- **Transcription:** ${c.audio_transcription}`);
      if (c.submitter_email) lines.push(`- **Submitted by:** ${c.submitter_email}`);
      if (c.photo_url) lines.push(`- **Photo:** ${c.photo_url}`);
      if (c.audio_url) lines.push(`- **Audio:** ${c.audio_url}`);
      lines.push(`- **Captured:** ${new Date(c.created_at).toLocaleString()}`);
      lines.push('');
    }

    downloadFile(
      lines.join('\n'),
      `sortie-export-${selectedEvent === '__all__' ? 'all' : selectedEvent}.md`,
      'text/markdown',
    );
  }

  function downloadFile(content: string, filename: string, type: string): void {
    const blob = new Blob([content], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p className="text-olive-muted">Loading captures...</p>;
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-olive-800 border border-olive-700 rounded-lg p-6 space-y-4">
        <h3 className="text-gold text-sm uppercase tracking-wider font-semibold">
          Export Data
        </h3>

        <div>
          <label className="block text-olive-muted text-xs uppercase tracking-wider mb-1">
            Event
          </label>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="text-sm"
          >
            <option value="__all__">All Events ({captures.length})</option>
            {events.map((event) => (
              <option key={event} value={event}>
                {event} ({captures.filter((c) => c.event_name === event).length})
              </option>
            ))}
          </select>
        </div>

        <p className="text-olive-muted text-xs">
          {filtered.length} capture{filtered.length !== 1 ? 's' : ''} selected
        </p>

        <div className="flex gap-3">
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex-1 px-4 py-3 bg-olive-600 hover:bg-olive-500 disabled:opacity-40 text-olive-text text-sm font-medium rounded-lg transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={exportMarkdown}
            disabled={filtered.length === 0}
            className="flex-1 px-4 py-3 bg-olive-600 hover:bg-olive-500 disabled:opacity-40 text-olive-text text-sm font-medium rounded-lg transition-colors"
          >
            Export Markdown
          </button>
        </div>
      </div>
    </div>
  );
}
