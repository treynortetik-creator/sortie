# Sortie Forge Prompt
## Copy everything below this line and paste it into Claude Code

---

You are running the App Forge process on Sortie, an existing Lead Capture PWA. This is NOT a greenfield build — the app already exists with working code. Your job is to take it from prototype to production-quality through a structured multi-pass process.

**Work on branch `feature/forge-upgrade`. Create it now if it doesn't exist.**

Read CLAUDE.md first for project context and constraints.

## Phase 1: Audit & Plan (Passes 1-2)

### Pass 1: Codebase Audit
Review every file in the project. Document:
- What works well
- What's broken or incomplete
- What's missing for production readiness
- Code quality issues (any types, missing error handling, etc.)
- UI/UX gaps (missing loading states, error states, empty states)
- Security concerns
Write findings to `AUDIT.md` in the project root.
Commit: `forge(pass-1): codebase audit`

### Pass 2: Upgrade Plan
Based on the audit, create `FORGE_PLAN.md` with:
- Prioritized list of changes needed
- Which existing code to keep vs rewrite
- New features or improvements to add
- Architecture changes (if any)
- Estimated complexity per item (S/M/L)
Commit: `forge(pass-2): upgrade plan`

## Phase 2: Foundation Fixes (Passes 3-5)

### Pass 3: Dependencies & Config
- Update dependencies if needed (keep Next.js 16, React 19, Tailwind v4)
- Add shadcn/ui if not present (use the Tailwind v4 compatible version)
- Add zod for validation
- Fix any config issues found in audit
- Ensure `npm run build` passes clean
Commit: `forge(pass-3): dependencies and config`

### Pass 4: TypeScript Hardening
- Enable strict mode everywhere
- Remove ALL `any` types
- Add proper interfaces/types for all data structures
- Type all API responses
- Add zod schemas for API route validation
Commit: `forge(pass-4): typescript hardening`

### Pass 5: Database & Auth Review
- Review Supabase migration for completeness
- Verify RLS policies are bulletproof
- Review auth flow (login, signup, session management, protected routes)
- Add password reset if missing
- Fix any auth edge cases
Commit: `forge(pass-5): database and auth hardening`

## Phase 3: Core Feature Polish (Passes 6-8)

### Pass 6: Capture Flow
- Review and improve camera capture UX
- Ensure photo quality is good for AI extraction
- Test/fix the voice recording flow
- Improve the capture card display
- Add capture editing capability if missing
Commit: `forge(pass-6): capture flow polish`

### Pass 7: AI Pipeline
- Review `/api/extract` (Claude Vision) — improve prompts, handle edge cases
- Review `/api/transcribe` (Whisper) — handle errors gracefully
- Review `/api/draft-email` (Claude) — improve email quality, add templates
- Add retry logic for failed AI calls
- Add proper error states when AI processing fails
Commit: `forge(pass-7): AI pipeline improvements`

### Pass 8: Offline & Sync
- Review Dexie schema and sync pipeline
- Ensure offline captures sync correctly when back online
- Add sync status indicators (pending, syncing, synced, failed)
- Add manual re-sync button for failed captures
- Test and fix service worker caching
Commit: `forge(pass-8): offline and sync improvements`

## Phase 4: UI/UX Overhaul (Passes 9-11)

### Pass 9: Visual Design
- Audit every screen for visual hierarchy
- Implement consistent design system (colors, spacing, typography)
- Add proper SafelyYou branding (professional, enterprise feel)
- Ensure mobile-first responsive design
- Dark mode support (optional but nice)
Commit: `forge(pass-9): visual design overhaul`

### Pass 10: UX Polish
- Add loading skeletons for all async content
- Add meaningful empty states
- Add clear error states with recovery actions
- Toast notifications for actions (capture saved, sync complete, etc.)
- Confirmation dialogs for destructive actions (delete capture)
- Smooth transitions and micro-interactions
- Pull-to-refresh on capture list
- Haptic feedback on capture (if available)
Commit: `forge(pass-10): UX polish`

### Pass 11: Feature Gap Analysis
Compare against what a best-in-class event lead capture app should have:
- Search/filter captures
- Export to CSV
- Bulk operations (select multiple, bulk export, bulk delete)
- Capture statistics/analytics per event
- QR code scanning (business cards with QR codes)
- Contact deduplication
- Salesforce/CRM integration readiness
- Team/multi-user event sharing
Document gaps in `FEATURE_GAPS.md`, implement the quick wins, backlog the rest.
Commit: `forge(pass-11): feature gap analysis and quick wins`

## Phase 5: Hardening (Passes 12-14)

### Pass 12: Performance
- React Server Components where beneficial
- Lazy load heavy components (camera, voice recorder)
- Optimize image handling (compression before upload)
- Add proper caching headers
- Review and optimize database queries
- Bundle size analysis
Commit: `forge(pass-12): performance optimization`

### Pass 13: Code Audit
- No `any` types remaining
- No code duplication (DRY)
- All error paths handled
- No console.log in production code
- No TODO/FIXME unresolved
- Dead code removed
- Consistent naming conventions
- All imports clean
Commit: `forge(pass-13): code audit cleanup`

### Pass 14: Security Audit
- Auth flow — no bypasses possible
- All API routes validate input (zod)
- No SQL injection vectors
- No XSS vectors
- API keys server-side only (never in client bundle)
- RLS policies tested
- Rate limiting on AI endpoints (prevent abuse)
- File upload validation (type, size limits)
- CORS properly configured
Commit: `forge(pass-14): security audit`

## Phase 6: Ship It (Passes 15-17)

### Pass 15: Testing
- Add Vitest for unit tests on critical paths:
  - AI extraction parsing
  - Sync pipeline logic
  - Utility functions
  - API route validation
- Add Playwright for E2E on critical flows:
  - Login → capture → view captures
  - Offline capture → sync
Commit: `forge(pass-15): testing`

### Pass 16: Deployment Config
- Create/update `railway.json` with proper build settings
- Create `Dockerfile` if needed
- Create `.env.example` with all required variables documented
- Create proper `README.md` with setup/deployment instructions
- Add GitHub Actions CI (lint + test on push)
Commit: `forge(pass-16): deployment configuration`

### Pass 17: Final Review
- Run `npm run build` — must pass clean
- Run `npm run lint` — must pass clean
- Run tests — must pass
- Review all generated docs (AUDIT.md, FORGE_PLAN.md, FEATURE_GAPS.md)
- Write `REVIEW_SUMMARY.md` with:
  - What was changed and why
  - Known limitations
  - Recommended next steps
  - Deployment instructions
Commit: `forge(pass-17): final review and documentation`

## Rules
1. **Commit after EVERY pass** with the specified commit message format
2. **Do NOT skip passes** — even if something looks fine, verify and document it
3. **Read CLAUDE.md** before starting for project constraints
4. **Mobile-first** — test all UI decisions against phone viewport
5. **Don't break offline-first** — this is a core architectural requirement
6. **Ask no questions** — make reasonable decisions and document them
7. **If `npm run build` breaks, fix it before moving on**
8. At the end, print a summary of everything you did across all 17 passes
