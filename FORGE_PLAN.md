# Sortie Forge Upgrade Plan

**Based on:** AUDIT.md (Pass 1)
**Goal:** Take Sortie from prototype (C+) to production-ready (A-)

---

## Priority 1: Foundation Fixes (Passes 3-5)

### Pass 3: Dependencies & Config

| Item | Action | Complexity |
|------|--------|------------|
| Install shadcn/ui | `npx shadcn@latest init` (Tailwind v4 compatible) | M |
| Install Zod | `npm install zod` | S |
| Fix next.config.ts | Add security headers, image optimization for Supabase URLs | S |
| Remove next-pwa | Unused (manual SW instead), remove dep | S |
| Remove workbox deps | Unused (manual SW), remove 4 workbox packages | S |
| Clean legacy assets | Remove file.svg, globe.svg, next.svg, vercel.svg, window.svg from public/ | S |
| Verify build passes | `npm run build` must succeed | S |

### Pass 4: TypeScript Hardening

| Item | Action | Complexity |
|------|--------|------------|
| Export shared types from db.ts | Add `CaptureStatus` type, export all interfaces | S |
| Remove type duplication | Import `LocalCapture` in captures/[id]/page.tsx, import `CaptureStatus` in StatusBadge | S |
| Add Zod schemas for API routes | Create schemas for extract, transcribe, draft-email request/response | M |
| Replace type assertions | Replace `as` casts with Zod `.parse()` in all API routes | M |
| Add explicit return types | Add return types to all exported functions/components | S |
| Type API responses | Create response types for all API routes | S |

### Pass 5: Database & Auth Review

| Item | Action | Complexity |
|------|--------|------------|
| Fix supabase.ts placeholders | Throw error if env vars missing instead of placeholder fallback | S |
| Add signUp to AuthContext | Add `signUp(email, password)` method | S |
| Fix silent getSession failure | Add catch block, set error state, show error UI | S |
| Add loading false on error | Fix AuthContext loading state never resetting on failure | S |
| Review RLS policies | Verify policies are complete — **already looks solid** | S |
| Add Dexie migration path | Add version(2) handler stub for future schema changes | S |
| Add updated_at trigger | Create Supabase migration for auto-updating `updated_at` on row changes | S |
| EventContext: use IDs not names | Store event ID instead of name string | M |

---

## Priority 2: Core Feature Polish (Passes 6-8)

### Pass 6: Capture Flow Polish

| Item | Action | Complexity |
|------|--------|------------|
| Improve camera error messages | Distinguish permission denied vs hardware unavailable | S |
| Add camera retry button | Show retry button on camera error instead of requiring page reload | S |
| Fix canvas context null check | Already handled — verify | S |
| Add capture feedback | Brief flash/haptic when photo taken | S |
| Fix QuickNoteModal auto-dismiss | Make timeout more visible (countdown indicator) | S |
| Fix VoiceRecorder deps bug | Add proper dependencies to useEffect, remove lint disable | M |
| Add capture editing | Allow editing notes/name after capture | M |

### Pass 7: AI Pipeline

| Item | Action | Complexity |
|------|--------|------------|
| Add URL validation | Validate photoUrl/audioUrl are from Supabase Storage | S |
| Add AbortController timeouts | 30s timeout on all Claude/Whisper API calls | S |
| Add Zod response validation | Validate AI responses before using | S |
| Improve extraction prompt | Handle edge cases (blurry, partial, non-English cards) | M |
| Add retry logic | Retry failed AI calls up to 2 times with backoff | M |
| Add error states for AI failures | Show specific error when extraction/transcription/email fails | S |
| Improve email templates | Better prompt engineering for follow-up emails | S |

### Pass 8: Offline & Sync

| Item | Action | Complexity |
|------|--------|------------|
| Fix sync silent failures | Log errors, set `needs_review` status with error details | M |
| Add idempotency | Check `remoteId` before Supabase insert, use upsert | M |
| Preserve partial progress | Store photoUrl/audioUrl in local DB immediately after upload | M |
| Add sync timeout | AbortController on all fetch calls in sync pipeline | S |
| Add blob cleanup | Delete imageBlob/audioBlob from IndexedDB after successful sync | S |
| Add sync status indicators | Show pending/syncing/synced/failed per capture | M |
| Add manual re-sync button | Retry button on failed captures | S |
| Review service worker | Verify caching strategy is complete, add offline fallback page | S |

---

## Priority 3: UI/UX Overhaul (Passes 9-11)

### Pass 9: Visual Design

| Item | Action | Complexity |
|------|--------|------------|
| Centralize design tokens | Use CSS variables from globals.css everywhere, remove hardcoded hex | M |
| Audit visual hierarchy | Ensure consistent heading sizes, spacing, weights across all pages | M |
| Professional branding | Refine SafelyYou enterprise feel (consider sans-serif body font) | M |
| Mobile-first responsive | Verify all screens at 375px, 390px, 428px widths | S |
| Dark mode support | Already dark — document as intentional dark-only | S |

### Pass 10: UX Polish

| Item | Action | Complexity |
|------|--------|------------|
| Add toast notification system | Success/error/info toasts for all operations | M |
| Add loading skeletons | Replace spinners with content-shaped skeleton loaders | M |
| Add meaningful empty states | Helpful messages + CTAs when no captures, no events | S |
| Add error states with recovery | Error UI with retry buttons on all major operations | M |
| Add confirmation dialogs | Confirm destructive actions (delete capture, clear data) | S |
| Add transitions | Smooth page transitions, list animations | S |
| Remove dead integrations UI | Remove Salesforce/Clay placeholder sections | S |

### Pass 11: Feature Gap Analysis

| Item | Action | Complexity |
|------|--------|------------|
| Search/filter captures | Quick win — add search by name/company, filter by status | M |
| Export to CSV | Quick win — download captures as CSV | S |
| Capture statistics | Quick win — count by event, status breakdown | S |
| Document remaining gaps | Write FEATURE_GAPS.md for: bulk operations, QR scanning, dedup, CRM integration, team sharing | S |

---

## Priority 4: Hardening (Passes 12-14)

### Pass 12: Performance

| Item | Action | Complexity |
|------|--------|------------|
| Add pagination to captures list | Limit initial load, add load-more | M |
| Lazy load camera/voice | Dynamic imports for heavy components | S |
| Image compression before upload | Resize/compress photos before Supabase upload | M |
| Optimize DB queries | Use proper Dexie indexes instead of loading all then filtering | S |
| Add caching headers | Configure in next.config.ts | S |

### Pass 13: Code Audit

| Item | Action | Complexity |
|------|--------|------------|
| Verify no `any` types | Full codebase scan | S |
| Remove code duplication | DRY up repeated patterns (auth guards, loading states) | M |
| Handle all error paths | Every catch block should inform the user | M |
| Remove console.log/error | Replace with proper error reporting or remove | S |
| Resolve TODOs/FIXMEs | Address or document remaining items | S |
| Remove dead code | Remove unused functions, imports, components | S |
| Consistent naming | Verify naming conventions across codebase | S |

### Pass 14: Security Audit

| Item | Action | Complexity |
|------|--------|------------|
| Fix SSRF vulnerability | Validate URLs are from Supabase Storage in extract/transcribe | S |
| Add Zod validation (verify) | Confirm all API routes use Zod by this point | S |
| Add rate limiting | Rate limit login + AI endpoints | M |
| Add security headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options | S |
| File upload validation | Validate image type/size before storage | S |
| Review CORS | Ensure proper CORS configuration | S |
| Test RLS policies | Verify with multiple user scenarios | S |

---

## Priority 5: Ship It (Passes 15-17)

### Pass 15: Testing

| Item | Action | Complexity |
|------|--------|------------|
| Install Vitest | Add vitest, @testing-library/react | M |
| Unit test: API validation | Test Zod schemas and API route handlers | M |
| Unit test: sync pipeline | Test sync logic, error handling, retry | M |
| Unit test: utility functions | Test formatTime, status helpers | S |
| Install Playwright | Add Playwright for E2E | M |
| E2E: login flow | Test login → capture → view captures | L |
| E2E: offline capture | Test offline capture → reconnect → sync | L |

### Pass 16: Deployment Config

| Item | Action | Complexity |
|------|--------|------------|
| Create Dockerfile | Multi-stage Next.js Docker build | M |
| Create railway.json | Railway deployment configuration | S |
| Update .env.example | Ensure all variables documented | S |
| Update README.md | Add deployment instructions for Railway | S |
| Add GitHub Actions CI | Lint + test on push | M |

### Pass 17: Final Review

| Item | Action | Complexity |
|------|--------|------------|
| npm run build — clean | Must pass with zero errors | S |
| npm run lint — clean | Must pass with zero warnings | S |
| Run tests — all pass | Unit + E2E tests green | S |
| Review generated docs | AUDIT.md, FORGE_PLAN.md, FEATURE_GAPS.md accuracy | S |
| Write REVIEW_SUMMARY.md | Changes, limitations, next steps, deployment instructions | M |

---

## What to Keep vs. Rewrite

### Keep (solid foundation)
- Overall App Router structure
- Dexie IndexedDB schema (extend, don't rewrite)
- Supabase migration schema
- Service worker caching strategy
- Camera capture flow (polish, don't rewrite)
- Context provider pattern
- Tailwind v4 CSS theme variables
- PWA manifest configuration

### Rewrite
- `sync.ts` — Needs major rework for reliability (idempotency, error handling, partial progress)
- `supabase.ts` — Replace placeholder fallbacks with proper error handling
- All API routes — Add Zod validation, URL validation, timeouts
- `ServiceWorkerRegistrar.tsx` — Add error handling

### Add New
- Toast notification component
- Error boundary components
- Loading skeleton components
- Search/filter functionality
- CSV export
- Dockerfile + railway.json
- Test suite (Vitest + Playwright)
- GitHub Actions CI

---

## Estimated Effort by Pass

| Pass | Items | Estimated Complexity |
|------|-------|---------------------|
| 3: Dependencies & Config | 7 | Small |
| 4: TypeScript Hardening | 6 | Medium |
| 5: Database & Auth | 8 | Medium |
| 6: Capture Flow | 7 | Medium |
| 7: AI Pipeline | 7 | Medium |
| 8: Offline & Sync | 8 | Large |
| 9: Visual Design | 5 | Medium |
| 10: UX Polish | 7 | Large |
| 11: Feature Gaps | 4 | Medium |
| 12: Performance | 5 | Medium |
| 13: Code Audit | 7 | Medium |
| 14: Security Audit | 7 | Medium |
| 15: Testing | 7 | Large |
| 16: Deployment | 5 | Medium |
| 17: Final Review | 5 | Small |
