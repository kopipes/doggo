# PetReg
### Product Requirements Document
**Dog Run Race — Vaccine Certificate Registration & Verification System**

Version: 0.1 (Draft)
Status: For review
Date: August 10, 2026

---

## 1. Overview

PetReg is the app that lets pre-registered dog run participants complete their profile online (vaccine certificate + dog photo), lets race officials assign a 4-digit bib number at gear pickup, and lets event crew verify a runner's identity by bib number on race day. The system must be fast, mobile-friendly, and built on a reliable database, since it will be used under time pressure at a physical event with variable connectivity.

### 1.1 Problem Statement

Currently, participant data (uploaded via Excel by the organizer), vaccine certificate collection, and race-day bib verification are disconnected. There is no single system that ties a runner's ticket to their vaccine proof, dog photo, and bib number, and no fast lookup for staff at the event.

### 1.2 Goals

- Give registered users a simple self-service flow to submit certificate + dog photo using only their Ticket ID.
- Let officials assign and record bib numbers quickly during gear pickup.
- Let crew verify a runner in under 2 seconds by bib number on race day, including visual comparison of the certificate photo.
- Keep the admin fully in control: bulk import, de-duplication, and full edit rights at all times.
- Ensure the system stays responsive and correct under concurrent, high-traffic use at the event.

### 1.3 Success Metrics

- Bib lookup by crew returns a result in under 1 second on typical event wifi/4G.
- Zero duplicate Ticket ID records after repeated Excel imports.
- Zero duplicate bib number assignments (enforced, not just monitored).
- 100% of successful user submissions trigger a confirmation email (to user, CC official).

---

## 2. User Roles & Permissions

| Role | Access Method | Permissions |
|---|---|---|
| **Admin** | Login (username/password) | Full CRUD on all runner records; bulk Excel import with de-duplication; manage official/crew accounts; edit locked records; view audit log; export data |
| **Official** | Login (username/password) | Search runner by Ticket ID; assign 4-digit bib number; view full runner profile including certificate image; cannot edit personal data |
| **Crew** | Shared link (no login) | Enter 4-digit bib number only; read-only view of runner + dog info + certificate image for physical comparison; cannot save or edit anything |
| **User** | Ticket ID only (no login) | View own profile; upload/edit certificate image and dog photo, until locked by official bib assignment |

Note: Crew access uses a plain shared link rather than individual logins, since it is read-only and involves no data modification. Official and Admin require authenticated accounts, since both can write data.

---

## 3. Core User Flows

### 3.1 Admin — Bulk Data Import

1. Admin uploads an Excel file of registered participants (source format: Event Name, Ticket Name, Ticket Code, Nama, Email, Nomor HP, Ukuran Baju, Ukuran Pet Collar).
2. System matches rows against existing records using Ticket Code (unique, alphanumeric) as the key — this is the runner's Ticket ID.
3. New Ticket Codes are inserted; existing Ticket Codes are skipped (never overwritten by import). Note: Email is not unique in the source data (one person can hold multiple tickets), so Email must never be used as the dedup key.
4. System shows an import summary: rows added, rows skipped as duplicate, rows with errors (e.g. missing Ticket Code).

### 3.2 User — Self-Service Submission

1. User enters their Ticket ID only (combination of numbers and letters, non-sequential/non-guessable).
2. If the Ticket ID is not found, show a clear "Ticket ID not found" message.
3. If found and no certificate/photo submitted yet, show upload form: vaccine certificate files — up to 3, jpg/png/pdf, max 10MB each — plus 1 dog photo (jpg/png, max 10MB).
4. If found and data already submitted, show "Your data has already been entered" with a read-only view (no email required to re-check).
5. On save: image uploaded automatically accepted, no manual review at this stage.
6. Confirmation email sent to user, CC'd to the official's email.
7. If the official has already assigned a bib number, the record is locked and the user sees a read-only view instead of the upload form.

### 3.3 Official — Gear Pickup / Bib Assignment

1. Official logs in and searches by Ticket ID.
2. Official views runner profile, including certificate photos (for a quick visual sanity check, not a formal verification step).
3. Official enters the 4-digit bib number (starting at 1000) and saves.
4. System enforces bib number uniqueness — rejects duplicate assignment with a clear error.
5. Record locks for the user going forward; admin retains edit rights.

### 3.4 Crew — Race-Day Verification

1. Crew opens the shared check-in link (no login).
2. Crew enters the 4-digit bib number.
3. System displays runner name, dog name/breed, dog photo, and all certificate photos (enlargeable/zoomable) for physical comparison against the real vaccine card.
4. No data is created or changed in this flow — view only.

---

## 4. Data Model (High Level)

### 4.1 runners

Fields marked "from Excel import" come directly from the source spreadsheet (Event Name, Ticket Name, Ticket Code, Nama, Email, Nomor HP, Ukuran Baju, Ukuran Pet Collar). Fields marked "user-submitted" are collected later through the self-service flow. Note: the source data has no dog name/breed field — if the crew's visual-check screen should show dog identity, it must be collected as a new user-submitted field.

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | Internal identifier |
| ticket_id | String, unique, indexed | From Excel import ("Ticket Code"). Non-sequential. Primary lookup key for users and officials. |
| event_name | String | From Excel import ("Event Name") |
| ticket_name | String | From Excel import ("Ticket Name") — package/tier, e.g. Regular, Regular + Add Ons, Early Bird. Relevant for gear handed out at pickup. |
| owner_name | String | From Excel import ("Nama") |
| email | String | From Excel import ("Email"). Not unique — one person may hold multiple tickets. Used for confirmation email only, not for lookup. |
| phone | String | From Excel import ("Nomor HP") |
| shirt_size | String | From Excel import ("Ukuran Baju") — includes size, character design, and measurements as a single text value |
| collar_size | String | From Excel import ("Ukuran Pet Collar") — includes size and measurements as a single text value |
| dog_name | String, nullable | User-submitted (not in source Excel) — optional, only if dog identity is wanted on the crew check screen |
| cert_image_urls | Array of String (max 3) | User-submitted. Object storage URLs — up to 3 vaccine certificate files (jpg, png, or pdf; max 10MB each) |
| dog_photo_url | String (exactly 1) | User-submitted. Object storage URL — single dog photo (jpg or png; max 10MB) |
| bib_number | String(4), unique, indexed, nullable | Assigned by official; enforced unique at DB level |
| locked | Boolean, default false | Set true when bib_number is assigned; blocks user edits, not admin edits |
| submission_status | Enum | not_submitted / submitted / locked |
| created_at / updated_at | Timestamp | |

### 4.2 staff_accounts

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | String | |
| role | Enum | admin / official |
| email | String, unique | Used for login |
| password_hash | String | Crew has no account — link-based access only |

### 4.3 audit_log

Records who changed what and when — critical since this is a compliance-adjacent system (vaccine proof) and multiple staff roles can touch the same record. Recommended fields: `id`, `actor_id`, `actor_role`, `runner_id`, `action`, `before_value`, `after_value`, `timestamp`.

---

## 5. Functional Requirements Summary

- **FR1** — Admin can import Excel files repeatedly without creating duplicate records (unique on ticket_id).
- **FR2** — Admin can search, view, and edit any runner record regardless of lock status.
- **FR3** — User can look up their record using Ticket ID only.
- **FR4** — User can upload up to 3 vaccine certificate files (jpg, png, or pdf; max 10MB each) and exactly 1 dog photo (jpg/png, max 10MB); system auto-accepts on upload.
- **FR5** — System sends confirmation email to user with CC to official on successful submission.
- **FR6** — Official can search by Ticket ID and assign a unique 4-digit bib number.
- **FR7** — System prevents duplicate bib number assignment at the database level (not just UI validation).
- **FR8** — Bib assignment locks the record from further user self-edits; admin is exempt from the lock.
- **FR9** — Crew can look up a runner by bib number via a shared link, with no login and no write access.
- **FR10** — All submitted certificate files (up to 3, including PDFs) are viewable/previewable at full size on the crew screen for physical comparison.
- **FR11** — All create/update actions are recorded in an audit log with actor, timestamp, and change.

---

## 6. Non-Functional Requirements

### 6.1 Performance

- Bib number and Ticket ID lookups must be indexed — target sub-1-second response under normal load.
- Images served via CDN/object storage, not through the application server, to keep lookups fast.
- Frontend should lazy-load images and avoid heavy JS bundles, especially for the crew/official mobile views.

### 6.2 Reliability & Robustness

- Database-level unique constraints on ticket_id and bib_number — never rely on application logic alone to prevent duplicates.
- SQLite in WAL mode: keep write transactions short (e.g. single bib assignment, single upload record) to minimize lock contention during gear-pickup rush; monitor write latency as concurrent official usage grows.
- Design for concurrent writes: multiple officials assigning bib numbers simultaneously without race conditions (use DB transactions/constraints, not read-then-write checks in app code).
- Plan for degraded/offline connectivity at the venue: consider a PWA or cached-lookup mode for crew/official screens so check-in doesn't fully stop if wifi drops.
- Have a manual/paper fallback procedure defined in case the system is unreachable during the event rush.

### 6.3 Security

- Ticket ID must be random/non-sequential to prevent enumeration of other users' data.
- Public Ticket ID lookup endpoint protected with simple CAPTCHA or honeypot to deter scraping/brute force.
- Admin and Official accounts require authentication; passwords hashed, sessions expire.
- Crew link should be a long, non-guessable URL even though it requires no login, since it exposes personal data (owner name, dog info, certificate image) in read form.
- Certificate and dog photo uploads validated for file type (jpg, png, pdf) and size (max 10MB per file) to prevent abuse.

### 6.4 Usability

- Mobile-first responsive design — officials and crew will primarily use phones/tablets at the event.
- Clear, distinct error states: Ticket ID not found, already submitted, bib already assigned, invalid image type, etc.
- Minimal steps: user flow should be lookup → upload → confirm, no unnecessary screens.

---

## 7. Technical Recommendations

| Layer | Recommendation | Why |
|---|---|---|
| Database | SQLite (WAL mode enabled) | Simple to deploy/back up; WAL mode allows concurrent reads during a single writer. Fine at this scale — revisit if concurrent official write-load grows significantly (straightforward migration path to Postgres later since schema is already normalized) |
| Image storage | S3-compatible object storage + CDN | Keeps DB lean and lookups fast; images served independently of app server |
| Backend | Indexed REST/GraphQL API, rate-limited public endpoints | Fast lookups; protects against scraping/brute force on Ticket ID |
| Frontend | Responsive SPA or PWA | Mobile-friendly; PWA enables partial offline resilience for event day |
| Email | Transactional email service (SES / SendGrid / Resend) | Reliable delivery with CC support for confirmation emails |

---

## 8. Open Items / Next Steps

- Confirm exact Ticket ID format (length, character set) so it can be validated on both Excel import and lookup.
- Define and document the offline/degraded-connectivity fallback for race day (technical PWA caching vs. manual paper backup, or both).
- Decide error-state copy/wording for each of the flows above.
- Confirm who besides the assigned official receives the CC'd confirmation email (a role inbox vs. a specific person).
- Confirm PDF preview approach for crew screen (inline PDF viewer vs. auto-converted thumbnail) so certificate PDFs are as fast to check as images.
- Decide whether dog name (not present in the source Excel) should be collected as a new field during user self-service, for display on the crew's verification screen.
- Confirm handling for the 24 rows with duplicate emails in the sample data (multiple tickets per person) — verify each ticket still gets its own independent self-service submission, not shared across tickets.

---
*End of draft PRD — v0.1*
