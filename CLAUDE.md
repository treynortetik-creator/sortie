# CLAUDE.md — Sortie Project Instructions

## What Is Sortie?
Lead Capture Mission Control — a mobile-first PWA for capturing leads at SafelyYou events. Snap a photo of a business card/badge, record a voice note, AI extracts contact info, transcribes notes, and drafts follow-up emails. Offline-first with IndexedDB + Supabase sync.

## Tech Stack (DO NOT CHANGE)
- **Framework:** Next.js 16 (App Router), React 19, TypeScript strict
- **Styling:** Tailwind CSS v4 (NOT v3 — no tailwind.config.js, uses CSS-based config)
- **Auth & DB:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Local Storage:** Dexie (IndexedDB) for offline-first
- **AI:** Anthropic Claude API (vision extraction + email drafting), OpenAI Whisper (transcription)
- **PWA:** Custom service worker, stale-while-revalidate
- **Deployment Target:** Railway (NOT Vercel)

## Architecture
- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — Shared UI components
- `src/contexts/` — React context providers (Auth, Connection, Event)
- `src/lib/db.ts` — Dexie IndexedDB schema
- `src/lib/supabase.ts` — Supabase client
- `src/lib/sync.ts` — Capture processing + sync pipeline
- `supabase/migrations/` — Database schema
- `public/sw.js` — Service worker

## Data Flow
1. User captures photo → stored as Blob in IndexedDB via Dexie
2. Optional voice note → also stored locally
3. When online, sync pipeline processes each capture:
   - Upload photo/audio to Supabase Storage
   - `/api/extract` (Claude Vision) → contact extraction
   - `/api/transcribe` (Whisper) → audio transcription
   - `/api/draft-email` (Claude) → follow-up email
   - Insert into Supabase PostgreSQL
4. Local record updated with extracted data + `ready` status

## Coding Standards
- TypeScript strict — no `any` types
- All components as named exports with explicit return types
- Server Components by default; `"use client"` only when needed
- Zod for runtime validation on API routes
- Error boundaries on all major routes
- Loading states (skeletons) for all async content
- Empty states that are helpful, not confusing
- Mobile-first responsive design (this is primarily a phone app)

## Git Conventions
- Commit after each completed pass/phase
- Commit messages: `forge(pass-N): brief description`
- Work on a feature branch: `feature/forge-upgrade`
- Do NOT push to main directly

## Important Constraints
- **Supabase is correct for this app** — it uses Auth, Storage, RLS, and realtime. Keep it.
- **Railway for deployment** — create `railway.json` and `Dockerfile` if missing
- **PWA must work offline** — don't break the offline-first architecture
- **Mobile-first** — every UI decision should prioritize phone usage at events
- **shadcn/ui** — add it if not already present for consistent component library
- **This is for SafelyYou events** — enterprise context, professional appearance

## Environment Variables (Reference)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```
