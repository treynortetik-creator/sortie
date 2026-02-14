# Sortie — Feature Gap Analysis

**Date:** 2026-02-14
**Current State:** Functional MVP with AI extraction, offline-first sync, and core capture flow.

---

## Implemented (v1.0)

- Photo capture with rear camera
- Voice note recording with live transcription (Web Speech API + Whisper)
- AI-powered contact extraction (Claude Vision)
- AI-generated follow-up email drafts
- Offline-first with IndexedDB (Dexie) + Supabase sync
- Auto-sync on reconnect
- Retry logic with exponential backoff
- Event-based organization with history
- Status tracking (captured → processing → ready/needs_review/error)
- Manual re-sync on failed captures
- Toast notifications for user actions
- PWA with service worker offline caching

---

## Quick Wins (Low Effort, High Impact)

### 1. Export to CSV
- Download all captures as a CSV file for import into CRM/spreadsheet
- Fields: name, company, email, phone, event, status, created_at, notes
- Single button on captures list page

### 2. Search by Name/Company
- Text search input on captures list page
- Filter captures by name or company substring match
- Already has event and status filters — search completes the trifecta

### 3. Capture Statistics Dashboard
- Count by event, status breakdown (pie/bar chart)
- Success rate metrics (% extracted, % synced)
- Could be a section on the Settings or a new /stats page

---

## Medium Priority Gaps

### 4. Bulk Operations
- Select multiple captures → process all, delete all, export selected
- Checkbox UI on capture list cards
- Batch sync with progress indicator

### 5. Capture Deletion
- Delete individual captures (local + remote)
- Confirmation dialog (already have confirm for clear-all)
- Soft delete vs hard delete consideration

### 6. QR Code / Barcode Scanning
- Scan QR codes on badges for instant contact import
- Use camera stream + js-qr or similar library
- Would complement photo-based extraction

### 7. Duplicate Detection
- Flag captures with same name/email as potential duplicates
- Merge UI to combine duplicate records
- Run after extraction, before marking as ready

### 8. Audio Playback on List
- Play audio note directly from capture card without opening detail
- Small play button on CaptureCard component

---

## Future / V2 Features

### 9. CRM Integration (Salesforce)
- Push extracted contacts directly to Salesforce
- Match against existing contacts/accounts
- Would require OAuth flow + Salesforce API

### 10. Clay Enrichment
- Send extracted contacts to Clay for data enrichment
- Auto-fill company info, LinkedIn, etc.
- Webhook or API integration

### 11. Team Sharing
- Share captures between team members at the same event
- Requires multi-user Supabase queries (by event, not just user)
- Real-time sync between devices

### 12. Event Management
- Create/edit/delete events with metadata (date, location, description)
- Event dashboard with capture counts and stats
- Currently events are just name strings

### 13. Email Sending
- Send follow-up emails directly from the app (not just draft)
- Integration with email provider (SendGrid, Resend, etc.)
- Track email open/click rates

### 14. Multi-Photo Capture
- Capture both front and back of business cards
- Gallery view per capture with multiple images
- AI extracts from all images combined

### 15. Contact Notes Timeline
- Multiple voice notes per capture
- Timestamped note history
- Searchable transcriptions

---

## Technical Debt for V2

- Image compression before Supabase upload (currently uploads full-res JPEG)
- Pagination on captures list (currently loads all into memory)
- Real-time Supabase subscriptions for multi-device sync
- Push notifications for sync completion
- Dark/light theme toggle (currently dark-only by design)
- Accessibility audit (WCAG AA compliance)
- E2E test suite (Playwright)
