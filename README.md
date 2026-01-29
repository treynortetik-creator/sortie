# Sortie — Lead Capture Mission Control

A mobile-first PWA for capturing leads at SafelyYou events. Snap a photo of a business card or badge, record a voice note, and let AI extract contact info, transcribe notes, and draft a follow-up email — all with offline support.

## Features

- **Photo Capture** — Use your device camera to photograph business cards and name badges
- **Voice Notes** — Record audio notes with real-time speech-to-text transcription
- **AI Extraction** — Claude Vision extracts contact info (name, company, email, phone) from photos
- **AI Transcription** — OpenAI Whisper transcribes voice recordings
- **Email Drafting** — Claude generates personalized follow-up emails based on contact + notes
- **Offline-First** — Captures stored locally in IndexedDB (Dexie) and synced when online
- **PWA** — Installable on mobile devices with service worker caching
- **Event Organization** — Group captures by event with history and autocomplete

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Auth & Database | Supabase (PostgreSQL + Auth + Storage) |
| Local Storage | Dexie (IndexedDB) |
| AI — Vision & Text | Anthropic Claude API |
| AI — Transcription | OpenAI Whisper API |
| PWA | Custom service worker (stale-while-revalidate) |

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project — [supabase.com](https://supabase.com)
- An Anthropic API key — [console.anthropic.com](https://console.anthropic.com)
- An OpenAI API key — [platform.openai.com](https://platform.openai.com)

### Setup

1. Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd sortie
npm install
```

2. Copy the environment file and fill in your keys:

```bash
cp .env.example .env.local
```

See [Environment Variables](#environment-variables) below for details on each variable.

3. Set up your Supabase project:

```bash
# Apply the schema migration to your Supabase project.
# Use the Supabase dashboard SQL editor or the CLI:
supabase db push
```

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone or in a mobile viewport.

## Environment Variables

| Variable | Description | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Supabase dashboard → Settings → API |
| `ANTHROPIC_API_KEY` | Anthropic API key (Claude Vision + email drafting) | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | OpenAI API key (Whisper transcription) | [platform.openai.com](https://platform.openai.com) |

Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. API keys without that prefix are server-side only and never sent to the client.

## Project Structure

```
src/
  app/
    api/
      extract/         # Claude Vision — business card contact extraction
      transcribe/      # OpenAI Whisper — audio transcription
      draft-email/     # Claude — follow-up email generation
    capture/           # Camera capture interface
    captures/          # Captures list + detail view
    event-select/      # Event selection with autocomplete
    login/             # Email + password authentication
    settings/          # User settings and data management
  components/          # Shared UI components
  contexts/            # React context providers (Auth, Connection, Event)
  lib/
    db.ts              # Dexie IndexedDB schema and types
    supabase.ts        # Supabase client initialization
    sync.ts            # Capture processing and sync pipeline
public/
  sw.js                # Service worker (stale-while-revalidate)
  manifest.json        # PWA manifest
supabase/
  migrations/          # Database schema migrations
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Architecture

### Offline-First Data Flow

1. User captures a photo → stored as a `Blob` in IndexedDB via Dexie
2. Optional voice note recorded → also stored locally
3. When online, the sync pipeline (`src/lib/sync.ts`) processes each capture:
   - Uploads photo/audio to Supabase Storage
   - Calls `/api/extract` (Claude Vision) for contact extraction
   - Calls `/api/transcribe` (Whisper) for audio transcription
   - Calls `/api/draft-email` (Claude) for follow-up email generation
   - Inserts processed record into Supabase PostgreSQL
4. Local record updated with extracted data and `ready` status

### Service Worker

The service worker (`public/sw.js`) uses a stale-while-revalidate strategy:
- Static pages and assets are pre-cached on install
- API routes and Supabase calls bypass the cache
- Network failures fall back to cached responses

## Deployment

Build and deploy as a standard Next.js application. Recommended platforms:

- **Vercel** — zero-config deployment for Next.js
- **Docker** — use `next build && next start` in a container

Ensure all environment variables are configured in your deployment environment.
