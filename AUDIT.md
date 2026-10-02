# Sortie audit (v1 at `f19a360`, audited 2026-10-02)

Scope: everything in the v1 repo (about 4,500 lines of app code), run for real: `npm ci`, `npm outdated`, `npm audit`, `vitest`, `eslint`, `next build`. Findings below were checked against the code or a command's output, not assumed.

## Verdict: rebuild on the same stack, keep the good parts

**Rewrite the architecture, keep Next.js, Dexie and the camera/voice ideas.** The v1 code is tidy and it builds, but its shape is wrong for what Sortie should be:

- It is a **multi-user SaaS** (Supabase Auth + Postgres + Storage + an admin panel) wrapped around what is really a **one-person tool**. Most of the code, and nearly every security problem, comes from that layer.
- The one thing a rep needs at a booth, **getting contacts out as a CSV**, only existed on a desktop-only admin page.
- It cannot be generic or open source while it requires you to run your own Supabase project, run migrations and hand-create users.

So v2 deletes the server-side data layer entirely: leads live on the phone (IndexedDB), the server is two stateless routes that forward a photo or a recording to OpenRouter and drop it. That removes the Supabase layer, the admin panel and the whole class of problems in "Security" below.

## What worked in v1

| Area | Status |
|---|---|
| Build, lint, type check | Pass (Next 16.1.6, TS strict). |
| Unit tests | 20 pass, but they cover only the rate limiter, auth helper and Zod schemas. **Nothing tested extraction parsing, the sync queue or CSV** (CSV did not exist for reps). |
| Camera capture | Worked: rear camera, 1280px JPEG, visibility handling. |
| Voice recorder | Worked; picked `audio/webm` first, which is wrong for iOS (see mobile). |
| Offline capture | Photos were queued in IndexedDB. Sync was a fire-and-forget loop with no persisted retry state. |
| Extraction | One OpenRouter call with a hand-rolled JSON regex. Reasonable idea, brittle parsing. |

## What was broken

1. **No CSV for the rep.** Export lived only in `/admin` (desktop, "not linked from mobile UI"). No Salesforce or HubSpot column mapping.
2. **Sign-in wall.** No sign-up page; accounts had to be created by hand in Supabase. A cold start with no cached session means no app.
3. **Sync was not a queue.** `syncCapture` ran inline; failure state was `error` with no backoff, no attempt count, no stale-job recovery. Photos were uploaded to Supabase *before* extraction, so "offline" meant nothing could be read until a full upload succeeded.
4. **Transcription path doubled the traffic.** The browser uploaded audio to storage, then the server downloaded it again to send to OpenAI Whisper (a second vendor key).
5. **Dedupe and edit.** No duplicate detection. Editing was possible but could be overwritten by a late extraction result.
6. **Per-event lists** existed only as a free-text `event` string on each capture.
7. **Cost was not tracked at all.**
8. **Dead and stale code:** `sf_match_status`, `sf_account_id`, `clay_data`, `email_draft` columns and `LocalProfile` (never written), an unused `/api/draft-email` mentioned in docs but absent, leftover "Forge" process docs (`FORGE_PROMPT.md`, `FORGE_PLAN.md`, `REVIEW_SUMMARY.md`, `FEATURE_GAPS.md`) and a `CLAUDE.md` of build instructions.

## Security

Severity is for a public deployment with real contacts.

| # | Finding | Evidence | Severity |
|---|---|---|---|
| S1 | **Any signed-in user could read every user's captures.** `/api/admin/captures` verified only "is logged in", then queried with the **service-role key** (bypasses row-level security). | `src/app/api/admin/captures/route.ts` | Critical |
| S2 | **Any signed-in user could change app-wide settings** (including which model is called). The RLS policy is "any authenticated user can read/write". | `supabase/migrations/004_app_settings.sql` | High |
| S3 | **Badge and card photos in a public bucket.** `storage.buckets.public = true` plus a `SELECT` policy for everyone: anyone with a URL can fetch the image of a person's name tag, and the URLs are stored in the database. | `001_initial_schema.sql` | High |
| S4 | **SSRF filter was bypassable.** `/api/extract` and `/api/transcribe` accepted a URL and fetched it server-side, guarded only by `url.includes('.supabase.co/storage/')`, so `https://evil.example/x?.supabase.co/storage/` passes. The transcribe route downloaded whatever the URL returned. | `src/lib/schemas.ts` | High |
| S5 | **In-memory rate limiter** keyed by user id; resets on deploy and does not span instances (the file says so). | `src/lib/rate-limit.ts` | Low |
| S6 | CSP allowed `'unsafe-eval'` in production. | `next.config.ts` | Medium |
| S7 | API keys: the OpenRouter and OpenAI keys were server-side only. **No key was shipped to the client.** Only the Supabase anon key (public by design) was in the bundle. | `.env.example`, build output | OK |
| S8 | Git history: 10 commits carry an employer email address as the author, and the old README, manifest and docs named the employer the app was first built for. | `git log` | Privacy, see below |

## Dependencies

`npm outdated` at audit time: `next` 16.1.6 (latest 16.3.8), `react` 19.2.3 (19.3.0), `dexie` 4.2.1 (4.4.6), `zod` 4.3.6 (4.6.5), `tailwindcss` 4.1.18 (4.3.3), `vitest` 4.0.18 (5.0.3), `@supabase/supabase-js` 2.93.2 (2.117.2), plus eleven more. **`npm audit`: 29 vulnerabilities (2 critical, 18 high)**, mostly through the shadcn CLI toolchain that was installed as a runtime dependency. Unused weight: `radix-ui` (whole suite), `shadcn`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@supabase/supabase-js`.

v2: 5 runtime-relevant dependencies (`next`, `react`, `react-dom`, `dexie`, `zod`), all current, `npm audit` reports 0 vulnerabilities.

## Mobile UX on an iPhone at a busy booth

| Problem in v1 | Why it matters | v2 |
|---|---|---|
| Voice upload hard-coded the filename `audio.webm` whatever the container (iPhone records MP4/AAC). Whisper likely sniffs the content, so this probably worked, but it was never tested on a device. | Silent mislabelling risk. | MIME chosen per browser (`audio/mp4` first), format sent explicitly. Tested with m4a and webm against the real API. |
| After a capture the app navigated to a detail page, and the bottom nav sat over the primary action. | Two taps and a page load per lead. | Sheet over the live camera; **Save & next** is the biggest control, in thumb reach. |
| Sync needed login and uploads before reading. | Dead at a convention centre with bad wifi. | Capture is saved locally in milliseconds; reading happens whenever there is signal. |
| Offline state was a small icon. | Reps could not tell if a lead was safe. | Always-visible pill: Offline / No connection / Reading N / Failed / Synced, with counts. |
| Service worker stale-while-revalidate over a hand-listed set of pages with no JS-chunk precache; routes only worked offline once visited. `/captures/[id]` was a dynamic route. | The first offline launch of another route could fail. | Precaches every route's JS/CSS at install; no dynamic routes; verified by killing the server and reloading. |
| Viewport set `userScalable: false` / `maximumScale: 1`, which disables pinch-zoom (accessibility). The home-screen icon was a 192px file reused for Apple. | Fails WCAG 1.4.4, soft icon on iOS. | Zoom allowed; 16px inputs stop iOS zooming on focus; proper 180px Apple icon, maskable icon, safe-area padding. |
| Always-on viewfinder, no fallback. | If camera permission is denied the app is stuck. | Falls back to the native camera / photo library picker. |

## Offline behaviour (v1)

Captures were stored locally and synced when `online` fired. Gaps: `navigator.onLine` lies (true on captive-portal wifi), failures were not retried on a schedule, a crash mid-sync left rows in `processing` forever, and extraction was blocked behind upload. v2's queue is persisted, retries with exponential backoff, recovers stale `running` jobs, pauses (not burns retries) on a wrong key or code, and revives on reconnect.

## Privacy and the repo being public

- v1 documentation, manifest text and `CLAUDE.md` named the employer the app was first built for. All removed in v2.
- **Git history still contains those strings and the employer author address in 10 commits** (find them with `git log --format='%an <%ae>' | sort | uniq -c`). v2 deliberately does not rewrite history. If you want the repo fully clean, the options are (a) a fresh orphan repo seeded from `v2`, or (b) `git filter-repo`. Both are destructive to the public history, so this is your call.
- No secrets were found in history (searched for `sk-or-`, JWT-shaped strings, `sbp_`, `sk-ant`; the only match was a placeholder JWT in a test).

## Fix vs rewrite

| Option | Cost | Outcome |
|---|---|---|
| Patch v1 | Medium | Still needs Supabase + accounts; S1-S4 fixable but the app stays a SaaS shell; still no generic story. |
| **Rebuild on this stack (chosen)** | About 3,300 lines of app code plus 850 of tests (102 tests) | Local-first, no accounts, stateless server, bring-your-own-key. |

Kept from v1: Next.js App Router, Tailwind v4, Dexie, Zod, the Railway Dockerfile idea, the camera-then-voice concept. Everything else was replaced.
