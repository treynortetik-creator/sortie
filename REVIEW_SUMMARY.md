# Sortie Forge Review Summary

## Overview

17-pass App Forge process completed on Sortie, a mobile-first PWA for lead capture at SafelyYou events. The app went from working prototype to production-quality across all passes.

## What Changed (by Pass)

### Phase 1: Audit & Plan (Passes 1-2)
- **Pass 1**: Full codebase audit documented in AUDIT.md — identified TypeScript `any` types, missing error handling, no Zod validation, missing loading/empty states, no tests, no deployment config
- **Pass 2**: Created FORGE_PLAN.md with prioritized improvements

### Phase 2: Foundation Fixes (Passes 3-5)
- **Pass 3**: Added shadcn/ui (Tailwind v4 compatible), Zod, security headers (HSTS, X-Frame-Options, etc.), fixed config
- **Pass 4**: Eliminated all `any` types, added Zod schemas for all API routes, typed all data structures
- **Pass 5**: Reviewed Supabase migrations, verified RLS policies, audited auth flow

### Phase 3: Core Feature Polish (Passes 6-8)
- **Pass 6**: Camera error handling with retry button, capture flash feedback, voice recorder cancel support
- **Pass 7**: Improved AI extraction prompt (handles blurry/partial/non-English), better JSON parsing with fallback, email draft prompt improvements, `fetchWithRetry` with exponential backoff, partial progress saving, idempotent upsert, `needs_review` status
- **Pass 8**: Blob cleanup after successful sync, error/needs_review banners with retry, auto-sync on reconnect, service worker v3

### Phase 4: UI/UX Overhaul (Passes 9-11)
- **Pass 9**: Replaced all hardcoded hex colors with Tailwind design tokens across 13 files, switched body font to system sans-serif stack
- **Pass 10**: Toast notification system, improved empty states with CTAs, removed dead Salesforce/Clay placeholder UI, slideDown animation
- **Pass 11**: Status filter on captures list, FEATURE_GAPS.md documenting quick wins and v2 roadmap

### Phase 5: Hardening (Passes 12-14)
- **Pass 12**: Image compression (max 1280px before JPEG encode), lazy-loaded VoiceRecorder via `next/dynamic`
- **Pass 13**: Removed unused Header component, removed unused `isOnline()` export, fixed lint errors (VoiceRecorder ref update, EventContext lazy initializer, unused imports), zero lint warnings
- **Pass 14**: Auth verification on all API routes, per-user rate limiting (20 req/min), auth token in sync pipeline, audio download size limit (25 MB), input length limits on draft-email schema, Content-Security-Policy header, storage path restriction migration

### Phase 6: Ship It (Passes 15-17)
- **Pass 15**: Vitest setup with 28 unit tests covering Zod schemas, rate limiter, and API auth helper
- **Pass 16**: Dockerfile (multi-stage, node:20-alpine, standalone), railway.json, GitHub Actions CI (lint + test + build), .dockerignore
- **Pass 17**: Final verification — build, lint, tests all pass clean

## Files Created
| File | Purpose |
|------|---------|
| `src/lib/schemas.ts` | Zod validation schemas for all API routes |
| `src/lib/api-auth.ts` | Supabase auth token verification for API routes |
| `src/lib/rate-limit.ts` | In-memory sliding-window rate limiter |
| `src/components/Toast.tsx` | Toast notification system (context-based) |
| `src/components/StatusBadge.tsx` | Capture status badge component |
| `src/lib/schemas.test.ts` | 19 tests for Zod schemas |
| `src/lib/rate-limit.test.ts` | 5 tests for rate limiter |
| `src/lib/api-auth.test.ts` | 4 tests for API auth |
| `vitest.config.ts` | Vitest configuration |
| `Dockerfile` | Multi-stage Docker build |
| `railway.json` | Railway deployment config |
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline |
| `.dockerignore` | Docker build exclusions |
| `supabase/migrations/003_storage_path_policy.sql` | Storage upload path restriction |
| `AUDIT.md` | Codebase audit findings |
| `FORGE_PLAN.md` | Upgrade plan |
| `FEATURE_GAPS.md` | Feature gap analysis |

## Files Deleted
| File | Reason |
|------|--------|
| `src/components/Header.tsx` | Unused — never imported anywhere |

## Known Limitations
- **Rate limiting is in-memory** — resets on server restart, not shared across instances. Use Redis for horizontal scaling.
- **No E2E tests** — Playwright was in scope but not implemented (requires running browser + Supabase instance). Unit tests cover critical paths.
- **CSP uses `unsafe-inline` and `unsafe-eval`** — Required by Next.js for development. Consider nonce-based CSP for stricter production enforcement.
- **Storage bucket is public-read** — By design (photos need to be accessible for AI extraction). Storage path policy restricts writes to user's own folder.
- **No password reset flow** — Supabase supports it but no UI was added. Quick win for v2.

## Recommended Next Steps
1. **Password reset UI** — Add forgot password flow using Supabase auth
2. **CSV export** — Quick win identified in FEATURE_GAPS.md
3. **Search captures** — Text search across name/company/email
4. **Capture deletion** — With confirmation dialog and Supabase cascade
5. **Redis rate limiting** — Replace in-memory limiter for multi-instance deploys
6. **E2E tests** — Playwright tests for login → capture → view flow
7. **Nonce-based CSP** — Stricter Content-Security-Policy for production

## Deployment Instructions

### Railway
1. Push the `feature/forge-upgrade` branch (or merge to main)
2. Connect the repo to Railway
3. Railway auto-detects the Dockerfile via `railway.json`
4. Set environment variables in Railway dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
5. Deploy

### Docker (Manual)
```bash
docker build -t sortie .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e ANTHROPIC_API_KEY=... \
  -e OPENAI_API_KEY=... \
  sortie
```

### Supabase
1. Run all migrations in order:
   - `001_initial_schema.sql`
   - `002_updated_at_trigger.sql`
   - `003_storage_path_policy.sql`
2. Verify RLS is enabled on all tables
3. Create the `captures` storage bucket if it doesn't exist

## Verification
```
npm run build   ✅ Clean
npm run lint    ✅ 0 errors, 0 warnings
npm test        ✅ 28/28 tests pass
```
