# Sortie Codebase Audit

**Date:** 2026-02-14
**Branch:** feature/forge-upgrade
**Auditor:** Forge Process (Pass 1)

---

## Executive Summary

Sortie is a well-structured Next.js 16 PWA with a clear offline-first architecture. The foundations are solid — good file organization, proper App Router usage, reasonable TypeScript coverage, and a working capture-to-sync pipeline. However, the app has **critical gaps in sync reliability, security, error handling, and type safety** that must be addressed before production use at SafelyYou events.

**Overall Grade: C+** — Functional prototype, not production-ready.

---

## What Works Well

- **Architecture:** Clean App Router structure, proper separation of concerns (contexts, lib, components)
- **Offline-first design:** Dexie + IndexedDB captures work offline, sync pipeline exists
- **PWA setup:** Service worker with stale-while-revalidate, manifest, icons, installable
- **Camera capture:** Full-screen viewfinder, rear camera preference, JPEG compression
- **Tailwind v4:** Proper CSS-based config with `@theme` variables, no legacy tailwind.config.js
- **TypeScript:** Strict mode enabled, no `any` types found in initial scan
- **Auth:** Supabase Auth with proper session management and auth state listener
- **RLS:** Row Level Security enabled on all tables, users can only access own data
- **Environment variables:** API keys properly server-side only, `.env.example` well-documented
- **Mobile considerations:** Safe area insets, tap highlight removal, min touch targets, viewport lock

---

## Critical Issues

### 1. Sync Pipeline Unreliability (`src/lib/sync.ts`)

**Severity: CRITICAL**

The sync pipeline is the heart of the app and has multiple serious flaws:

- **Silent failures in catch blocks:** Extraction, transcription, and email drafting failures are caught and silently ignored. A capture can reach `ready` status with zero extracted data.
- **No idempotency:** If sync retries after a partial success (e.g., photo uploaded but local DB not updated), it creates duplicate entries in Supabase.
- **Race conditions:** `getPublicUrl()` called immediately after upload without confirming upload success.
- **No persistent queue:** If app crashes mid-sync, queued operations are lost.
- **No timeout on API calls:** If Claude/Whisper hangs, the entire sync freezes with no recovery.
- **Blob storage never cleaned up:** IndexedDB keeps blobs after sync, slowly filling device quota.
- **Partial progress not preserved:** If sync fails after upload but before extraction, the uploaded file URL is lost and re-uploaded on retry.

### 2. SSRF Vulnerability in API Routes

**Severity: CRITICAL**

`/api/extract` and `/api/transcribe` accept arbitrary URLs from the client (`photoUrl`, `audioUrl`). No validation that URLs point to Supabase Storage. An attacker could:
- Probe internal network resources
- Cause the server to fetch arbitrary external content
- Potentially exfiltrate server-side data

### 3. No Input Validation on API Routes

**Severity: HIGH**

All three API routes (`/api/extract`, `/api/transcribe`, `/api/draft-email`) use manual type assertions (`as`) instead of runtime validation. Zod is not installed. Malformed requests could cause unexpected behavior or expose error details.

### 4. Type Duplication

**Severity: HIGH**

- `CaptureRecord` interface duplicated in `captures/[id]/page.tsx` instead of importing from `db.ts`
- `CaptureStatus` type duplicated in `StatusBadge.tsx` instead of importing from `db.ts`
- Risk of type drift causing runtime bugs

---

## High Priority Issues

### 5. Missing Error Boundaries

No error boundaries anywhere in the component tree. If any context provider or component throws during render, the entire app crashes with a white screen and no recovery path.

### 6. Silent Auth Failure

`AuthContext` calls `getSession()` on mount but has no error handling. If Supabase is unreachable, `loading` stays `true` forever and the user sees an infinite spinner.

### 7. Supabase Client Placeholder Fallbacks

`supabase.ts` uses placeholder URLs/keys when env vars are missing instead of throwing. In production with missing config, the app will make requests to `https://placeholder.supabase.co` and fail with cryptic errors.

### 8. No User Feedback for Operations

- Sync failures: logged to console, user has no idea
- Settings save: fails silently
- Sign out errors: silently caught
- Data clear errors: silently caught
- Process All completion: no success/failure indication

### 9. VoiceRecorder Exhaustive Deps Bug

`useEffect` in VoiceRecorder disables `exhaustive-deps` lint rule, causing missing dependencies (`onRecordingComplete`, `stopRecording`). If parent unmounts while recording, cleanup may not fire properly, leaking media tracks.

### 10. Empty next.config.ts

The Next.js config is completely empty — no security headers (CSP, HSTS, X-Frame-Options), no image optimization config for Supabase Storage URLs, no compression settings.

---

## Medium Priority Issues

### 11. Color Hardcoding
Every component hardcodes hex values (`#1a1f16`, `#2d331f`, `#3d4a2a`, etc.) instead of using CSS variables defined in `globals.css`. Theme changes require updating 6+ files.

### 12. EventContext Uses Names Not IDs
Current event stored as string name in localStorage. Two events with the same name would conflict. Should use event ID.

### 13. navigator.onLine Unreliability
`ConnectionContext` relies solely on `navigator.onLine`, which only indicates network adapter status, not actual internet connectivity. User could have WiFi but no internet and the app would show "Online."

### 14. No Database Migration Path
Dexie only has `version(1)`. No migration handlers for schema changes. Future updates would cause database open failures for existing users.

### 15. No Signup Flow
`AuthContext` provides `signIn` and `signOut` but no `signUp`. Users can't register through the app.

### 16. ServiceWorkerRegistrar Swallows Errors
The `.catch(() => {})` silently ignores all SW registration failures. No way to know if the service worker failed to install.

### 17. Memory Leak Risk in Capture Page
Blob URLs created for thumbnails in the capture strip. While cleanup exists, rapid capture/navigation cycles could leak URLs.

### 18. No Rate Limiting
Login form has no rate limiting — brute force attacks possible. AI API endpoints have no rate limiting — abuse/cost explosion possible.

---

## Low Priority Issues

### 19. Legacy Assets in public/
Next.js starter SVGs still present: `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`

### 20. Courier New Body Font
Body uses `'Courier New'` monospace font. While thematic ("military" aesthetic), it's harder to read for body text and may not be appropriate for enterprise use.

### 21. Accessibility Gaps
- Color-only status indicators (red/green online dot) — colorblind users can't distinguish
- Some WCAG AA contrast failures with muted text (`#8b956d` on `#1a1f16`)
- No `aria-live` regions for dynamic content updates (transcription, sync status)
- Emoji-dependent UI elements vary across platforms

### 22. Dead Integrations UI
Capture detail page shows Salesforce "Not connected" and Clay "Not enriched" sections with no actual functionality. Confusing placeholder UI.

### 23. No Pagination
Captures list loads all captures into memory. With hundreds of captures, this will cause performance issues.

### 24. Console.error in Production
Multiple `console.error` calls throughout the codebase. Should use proper logging or error reporting service.

---

## Missing for Production

| Item | Status |
|------|--------|
| shadcn/ui component library | Not installed |
| Zod runtime validation | Not installed |
| Test framework (Vitest) | Not installed |
| E2E tests (Playwright) | Not installed |
| Error boundaries | Missing |
| Toast/notification system | Missing |
| Loading skeletons | Missing (uses spinners) |
| Railway deployment config | Missing (no Dockerfile, no railway.json) |
| Security headers | Missing |
| Rate limiting | Missing |
| Password reset flow | Missing |
| Image optimization config | Missing |
| Bundle analysis | Not configured |
| CI/CD pipeline | Missing |

---

## Security Concerns Summary

| Issue | Severity | Location |
|-------|----------|----------|
| SSRF via unvalidated URLs | Critical | `/api/extract`, `/api/transcribe` |
| No input validation (Zod) | High | All API routes |
| No CSP/security headers | High | `next.config.ts` |
| No rate limiting | Medium | Login, AI endpoints |
| Placeholder Supabase keys | Medium | `supabase.ts` |
| No CORS validation | Medium | All API routes |
| Console error detail leaks | Low | All API routes |

---

## File Inventory

### Pages (src/app/)
| File | LOC (est) | Quality | Notes |
|------|-----------|---------|-------|
| layout.tsx | 43 | Good | Missing error boundary |
| page.tsx | ~30 | Good | Simple redirect logic |
| providers.tsx | ~20 | Good | Clean provider composition |
| globals.css | 123 | Good | Proper Tailwind v4 theme |
| login/page.tsx | ~80 | Good | Needs rate limiting |
| event-select/page.tsx | ~100 | Fair | Silent DB errors |
| capture/page.tsx | ~420 | Fair | Complex, some issues |
| captures/page.tsx | ~100 | Fair | Missing loading states |
| captures/[id]/page.tsx | ~300 | Poor | Type duplication, dead UI |
| settings/page.tsx | ~120 | Fair | Silent errors |

### API Routes (src/app/api/)
| File | Quality | Notes |
|------|---------|-------|
| extract/route.ts | Poor | SSRF, no Zod, no timeout |
| transcribe/route.ts | Poor | SSRF, no Zod, no timeout |
| draft-email/route.ts | Fair | No Zod, no timeout |

### Components (src/components/)
| File | Quality | Notes |
|------|---------|-------|
| BottomNav.tsx | Good | Hardcoded colors |
| CaptureCard.tsx | Fair | No loading state, emoji fallback |
| Header.tsx | Fair | Truncation issues, color hardcoding |
| ServiceWorkerRegistrar.tsx | Poor | Swallows all errors |
| StatusBadge.tsx | Fair | Type duplication |
| VoiceRecorder.tsx | Fair | Deps bug, complex cleanup |

### Library (src/lib/)
| File | Quality | Notes |
|------|---------|-------|
| db.ts | Good | Needs migration path |
| supabase.ts | Poor | Placeholder fallbacks |
| sync.ts | Poor | Multiple critical issues |

### Contexts (src/contexts/)
| File | Quality | Notes |
|------|---------|-------|
| AuthContext.tsx | Fair | Silent failures, no signup |
| ConnectionContext.tsx | Fair | navigator.onLine unreliable |
| EventContext.tsx | Fair | Name-based not ID-based |

### Config
| File | Quality | Notes |
|------|---------|-------|
| package.json | Good | Missing test/shadcn deps |
| tsconfig.json | Excellent | Strict mode, proper config |
| next.config.ts | Poor | Completely empty |
| postcss.config.mjs | Good | Correct for Tailwind v4 |
| eslint.config.mjs | Good | Could add more rules |

### Infrastructure
| File | Quality | Notes |
|------|---------|-------|
| public/sw.js | Good | Solid caching strategy |
| public/manifest.json | Good | Proper PWA config |
| supabase/migrations/001 | Good | Well-designed schema |
| .env.example | Excellent | Well-documented |
| README.md | Good | Comprehensive |
