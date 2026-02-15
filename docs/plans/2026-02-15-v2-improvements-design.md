# Sortie V2 Improvements — Design Document

## Summary

Six workstreams: fix extraction bug, **remove email drafting feature**, simplify voice recorder, build admin panel with model selection + export, add storage persistence, and add PWA install prompt.

---

## 1. Bug Fix: Extraction 502

**Root cause:** Hardcoded model ID `anthropic/claude-sonnet-4-20250514` doesn't exist on OpenRouter.

**Fix:**
- Remove ALL hardcoded model IDs from `extract/route.ts`
- Delete `draft-email/route.ts` entirely (email feature removed)
- Remove `OPENROUTER_MODEL` env var fallback
- API route reads model from Supabase `app_settings` table
- If no model configured, return clear error: "No AI model configured — visit /admin to set up"
- Remove `OPENROUTER_MODEL` from CLAUDE.md env vars reference

**Files:** `src/app/api/extract/route.ts`, `CLAUDE.md`

---

## 1b. Remove Email Drafting Feature

**Rationale:** Sales team already has a dedicated person using Apollo + email templates. AI-generated drafts are redundant and waste tokens.

**Changes:**
- Deleted `src/app/api/draft-email/route.ts`
- Removed `draftEmailRequestSchema` + `DraftEmailRequest` type from `src/lib/schemas.ts`
- Removed email draft tests from `src/lib/schemas.test.ts`
- Removed Step 5 (email drafting) from sync pipeline in `src/lib/sync.ts`
- Removed `emailDraft` field from `LocalCapture` interface in `src/lib/db.ts`
- Removed email draft UI section (textarea, copy, open-in-mail) from capture detail page
- Note: `email_draft` column left in Supabase `captures` table (harmless, already applied migration)

---

## 2. Voice Recorder Simplification

**Current:** Uses both MediaRecorder (audio blob) + Web Speech API (live transcription that goes nowhere).

**New behavior:**
- Remove all Web Speech API / SpeechRecognition code from VoiceRecorder
- Component only uses MediaRecorder to capture WebM audio blob
- After recording: show "Voice note saved" with play button
- Auto-sync attempt immediately after recording (if online): upload audio → Whisper transcription
- On capture detail page, transcription states:
  - No audio: nothing shown
  - Audio captured, not synced: "Transcription pending" + Sync button
  - Syncing: spinner "Transcribing..."
  - Synced: editable text field with Whisper transcription
  - Failed: "Transcription failed" + Retry button
- If offline or sync fails, user can manually sync later

**Files:** `src/components/VoiceRecorder.tsx`, `src/app/captures/[id]/page.tsx`

---

## 3. Admin Panel (`/admin`)

**Route:** `src/app/admin/page.tsx` — client component, behind auth, NOT linked from mobile UI. Desktop-optimized.

### Tab 1: Events & Captures
- Left sidebar: events list (grouped from captures table)
- Main area: data table of captures for selected event
- Columns: thumbnail, name, company, email, phone, status badge, timestamp
- Row expand: full detail (transcription, audio player, full photo, Storage URLs)
- Filter: search by name/company/email, filter by status
- Status badges: Ready (green), Needs Review (yellow), Error (red), Processing (blue)

### Tab 2: AI Settings
- Fetches live model list from OpenRouter `/api/v1/models` via server-side proxy route
- Two sections:
  - **Extraction Model** — filtered to vision-capable models only, saved to `app_settings` (key: `extraction_model`)
  - **Transcription** — info display showing "OpenAI Whisper (via OPENAI_API_KEY)" — not configurable via OpenRouter
- Searchable model list with pricing info from OpenRouter metadata
- Save button with success/error feedback

### Tab 3: Export
- Event selector dropdown (or "All Events")
- Two export buttons: "Export CSV" and "Export Markdown"
- **CSV columns:** name, company, email, phone, notes, transcription, status, photo_url, audio_url, event, created_at
- **Markdown:** sections per capture — heading = name, bullet fields
- Generated client-side from Supabase query results

### New API Routes
- `GET /api/admin/models` — proxies OpenRouter `/api/v1/models` (keeps API key server-side)
- `GET /api/admin/settings` — reads `app_settings` from Supabase
- `PUT /api/admin/settings` — updates `app_settings` in Supabase

### New Supabase Table
```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: any authenticated user can read/write (no role restrictions)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage settings"
  ON app_settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

---

## 4. Storage Persistence

- Add `navigator.storage.persist()` call on app initialization
- Separate `StoragePersist` component in root layout
- Prevents browser from evicting IndexedDB under storage pressure
- Auto-granted for installed PWAs on Chrome

**Files:** `src/components/StoragePersist.tsx`, `src/app/layout.tsx`

---

## 5. PWA Install Prompt

- Show a dismissible banner on first visit (before PWA is installed)
- Detect install state via `beforeinstallprompt` event (Chrome) or `navigator.standalone` check (iOS)
- Banner text: "Install Sortie for the best experience" with Install/Dismiss buttons
- On Chrome: triggers the native install prompt
- On iOS: shows instructions ("Tap Share → Add to Home Screen")
- Dismissed state saved to localStorage so it doesn't re-appear
- Only shows on mobile viewports

**Files:** `src/components/InstallPrompt.tsx`, `src/app/layout.tsx`

---

## Implementation Status: COMPLETE

All phases implemented:

1. **Phase 1 — Fix extraction + model infra + email removal** ✅
2. **Phase 2 — Admin panel** ✅
3. **Phase 3 — Voice recorder simplification** ✅
4. **Phase 4 — PWA improvements** ✅

---

## Files Modified (Existing)
- `src/app/api/extract/route.ts` — read model from DB, removed hardcoded model
- `src/components/VoiceRecorder.tsx` — strip Web Speech API
- `src/app/captures/[id]/page.tsx` — transcription states + auto-sync + sync button
- `src/app/layout.tsx` — storage persist + install prompt
- `src/lib/sync.ts` — removed email drafting step
- `src/lib/schemas.ts` — removed email schema + type
- `src/lib/schemas.test.ts` — removed email tests
- `src/lib/db.ts` — removed emailDraft field
- `CLAUDE.md` — updated AI description, env vars, architecture

## Files Created (New)
- `src/app/admin/page.tsx` — admin panel (3 tabs)
- `src/app/api/admin/models/route.ts` — OpenRouter models proxy
- `src/app/api/admin/settings/route.ts` — app settings CRUD
- `src/lib/supabase-server.ts` — server-side Supabase client + getAppSetting helper
- `src/components/InstallPrompt.tsx` — PWA install banner
- `src/components/StoragePersist.tsx` — storage persistence
- `supabase/migrations/004_app_settings.sql` — new table

## Files Deleted
- `src/app/api/draft-email/route.ts` — email drafting removed
