# System Documentation

## A Web-Based Mobile Waste Picker App

**INSY 492 — Senior Project**
Wiclife Omondi Ongo · Bachelor of Business Information Technology
School of Business, Department of Information Systems and Computing
University of Eastern Africa, Baraton
Supervisor: Dr. Victor Mony · Academic Year 2025/2026

---

## Table of contents

0. [Executive system summary](#0-executive-system-summary)
1. [System overview](#1-system-overview)
2. [System architecture](#2-system-architecture)
3. [Technology stack](#3-technology-stack)
4. [Database design](#4-database-design)
5. [Unique identity generation](#5-unique-identity-generation)
6. [Authentication and authorisation](#6-authentication-and-authorisation)
7. [Administrative dashboard — functionality](#7-administrative-dashboard--functionality)
8. [Mobile application — functionality](#8-mobile-application--functionality)
9. [Deployment](#9-deployment)
10. [Verification and testing](#10-verification-and-testing)
11. [Security considerations](#11-security-considerations)
12. [Limitations and future work](#12-limitations-and-future-work)
13. [Appendix](#13-appendix)

---

## 0. Executive system summary

This report records the implemented and deployed Waste Picker Management System and summarises its
operational data. Figures in this section were captured from the authenticated reporting API on
**4 August 2026 at 13:47 EAT**; the reproducible snapshot is stored in
[`report_data_snapshot.json`](report_data_snapshot.json).

| Indicator | Live value | Interpretation |
|---|---:|---|
| Registered waste pickers | 16 | Records across ten configured counties |
| Approved | 13 (81.2%) | Pickers with an issued system identity |
| Pending review | 3 (18.8%) | Registrations requiring administrator action |
| Waste recorded | 1,334.69 kg | 50 collection records from 9 active collectors |
| Broadcasts | 2 | 12 recipient deliveries |
| Recorded reads | 1 (8.3%) | Communication engagement is the clearest improvement opportunity |

The system is operational end to end: registration, approval, identity assignment, collection
recording, targeted communication and administrative reporting have all been verified. Kisumu has the
largest registered group (4), followed by Siaya (3). Plastic is the largest recorded material category
(294.01 kg), closely followed by paper (266.67 kg). No rejected or suspended records were present at
the snapshot time.

![Registration status summary](generated/status_summary.png)

![Registrations by region](generated/registrations_by_region.png)

![Waste collection by material](generated/material_mix.png)

![Six-month registration trend](generated/registration_trend.png)

---

## 1. System overview

The Waste Picker Management System addresses a specific gap identified in the project proposal: waste
pickers across Western Kenya work in large numbers but remain unregistered, uncoordinated and
unreachable. Welfare organisations cannot identify beneficiaries, pickers hold no record of their own
work, and urgent communication has no reliable channel.

The system is built as two interfaces over one shared platform:

| Interface | Users | Purpose |
|---|---|---|
| **Android mobile application** | Waste pickers | Register, hold a verifiable digital identity card, receive announcements, log collection activity |
| **Web administrative dashboard** | Welfare coordinators and administrators | Approve registrations, assign roles, broadcast messages, monitor activity, produce reports |

The dashboard is the operational hub; the mobile application is the channel through which pickers
consume the services the dashboard coordinates.

### Live system

| Component | Location |
|---|---|
| Dashboard | https://waste-picker-system.vercel.app |
| REST API | https://waste-picker-system.vercel.app/api |
| Source code | https://github.com/ERIC10000/waste-picker-system |
| Database | Supabase PostgreSQL (project `iyproqyuvpdrsrwxkwfg`, region `eu-north-1`) |

---

## 2. System architecture

The system follows the four-tier model set out in the proposal.

```mermaid
graph TD
    subgraph P["PRESENTATION LAYER"]
        A["Android App<br/>Kotlin + XML"]
        B["Web Dashboard<br/>React"]
    end
    subgraph AP["APPLICATION LAYER"]
        C["REST API — Node.js + Express"]
        D["Authentication"]
        E["Unique ID Generator"]
        F["Notification Engine"]
    end
    subgraph I["INTEGRATION LAYER"]
        G["Supabase Auth"]
        H["Supabase Storage"]
    end
    subgraph DA["DATA LAYER"]
        J["PostgreSQL<br/>tables + views"]
        K["Storage buckets<br/>picker-photos"]
    end

    A -->|HTTPS/JSON| C
    B -->|HTTPS/JSON| C
    C --> D
    C --> E
    C --> F
    D --> G
    C --> H
    G --> J
    C --> J
    H --> K
```

### Design decision: a single deployment origin

The dashboard and the API are served from **one Vercel project**. The React build is served as static
files at `/`, and every request under `/api/*` is rewritten to a serverless function exporting the
Express application.

This matters for two reasons. The browser makes same-origin requests, so there is no CORS negotiation
to configure or debug. And the mobile application has a single HTTPS base URL to target, which works
identically from an emulator, from Wi-Fi and from mobile data — no local server, no IP addresses to
change.

### Request flow — registration to approval

```mermaid
sequenceDiagram
    participant M as Mobile App
    participant A as REST API
    participant S as Supabase Auth
    participant D as PostgreSQL
    participant W as Dashboard

    M->>A: POST /api/auth/register
    A->>S: create identity (phone-derived email)
    A->>D: INSERT waste_pickers (status = pending)
    A-->>M: session + pending profile
    Note over M: "Awaiting approval" screen

    W->>A: PATCH /api/pickers/:id/status {approved}
    A->>D: UPDATE status = 'approved'
    D->>D: TRIGGER assign_picker_id()
    Note over D: WP-KSM-2026-0001 generated
    A-->>W: picker with issued ID
    M->>A: GET /api/me/profile
    A-->>M: approved + Waste Picker ID
    Note over M: Digital ID card unlocked
```

---

## 3. Technology stack

| Layer | Technology | Role |
|---|---|---|
| Mobile | Kotlin, XML layouts, ViewBinding | Native Android application for waste pickers |
| Mobile networking | Retrofit 2, OkHttp, Gson, Coroutines | Typed REST client with structured error handling |
| Mobile imaging | Glide | Profile photograph loading and caching |
| Web frontend | React 18, Vite, React Router, Recharts | Administrative dashboard and data visualisation |
| Backend | Node.js 20, Express 4 | REST API, business logic, request authorisation |
| Auth / storage | Supabase Auth, Supabase Storage | Identity management and profile photo storage |
| Database | Supabase PostgreSQL | Relational storage, triggers, reporting views |
| Hosting | Vercel | Static hosting + serverless functions |
| Version control | Git, GitHub | Source management and collaboration |

---

## 4. Database design

### Entity relationships

```mermaid
erDiagram
    REGIONS ||--o{ WASTE_PICKERS : "operates in"
    REGIONS ||--o{ ANNOUNCEMENTS : "targeted at"
    ADMINS ||--o{ ANNOUNCEMENTS : creates
    ADMINS ||--o{ WASTE_PICKERS : approves
    WASTE_PICKERS ||--o{ COLLECTIONS : records
    WASTE_PICKERS ||--o{ ANNOUNCEMENT_RECIPIENTS : receives
    WASTE_PICKERS ||--o{ DEVICE_TOKENS : registers
    ANNOUNCEMENTS ||--o{ ANNOUNCEMENT_RECIPIENTS : "fans out to"
```

### Tables

| Table | Purpose | Key columns |
|---|---|---|
| `regions` | The ten Western Kenya / Lake Victoria basin counties | `id`, `name`, `code` |
| `waste_pickers` | Picker profiles; `id` mirrors the Supabase Auth user | `picker_id`, `full_name`, `phone`, `status`, `role`, `region_id` |
| `admins` | Dashboard users | `id`, `full_name`, `email`, `role` |
| `announcements` | Composed broadcasts | `title`, `body`, `audience`, `region_id`, `recipient_count` |
| `announcement_recipients` | One row per recipient — the mobile inbox and read receipts | `announcement_id`, `picker_id`, `read_at` |
| `collections` | Activity log of material collected | `material`, `weight_kg`, `collected_on` |
| `device_tokens` | Registered push targets | `picker_id`, `token` |
| `id_sequences` | Per-region, per-year counter backing the ID generator | `region_code`, `year`, `last_value` |

### Enumerated types

- `picker_status` — `pending`, `approved`, `rejected`, `suspended`
- `picker_role` — `picker`, `community_leader`, `data_collector`
- `admin_role` — `superadmin`, `admin`
- `audience_type` — `all`, `region`, `individual`
- `material_type` — `plastic`, `paper`, `glass`, `metal`, `e_waste`, `organic`, `other`

### Reporting views

| View | Produces |
|---|---|
| `v_registrations_by_region` | Total / approved / pending / rejected / suspended per county |
| `v_communication_log` | Every broadcast with delivery and read counts |
| `v_collection_summary` | Per-picker trip count and total kilograms, ranked |

---

## 5. Unique identity generation

Every approved waste picker receives a permanent, system-generated registration number in the format:

```
WP - <REGION CODE> - <YEAR> - <4-DIGIT SEQUENCE>

WP-KSM-2026-0001    (Kisumu, 2026, first registrant)
WP-KKG-2026-0001    (Kakamega, 2026, first registrant)
```

The sequence is scoped to region **and** year, so each county maintains its own numbering.

**The generator lives in the database, not in application code.** A `BEFORE INSERT OR UPDATE` trigger
on `waste_pickers` fires the moment a record's status becomes `approved`, calls
`generate_picker_id()`, and that function atomically increments `id_sequences` inside the same
transaction. Two coordinators approving different registrations at the same instant therefore cannot
be issued the same number — a guarantee that application-level counting could not make.

Verified against the live database:

| Call | Result |
|---|---|
| `generate_picker_id(1)` | `WP-KSM-2026-0001` |
| `generate_picker_id(1)` | `WP-KSM-2026-0002` |
| `generate_picker_id(6)` | `WP-KKG-2026-0001` |

---

## 6. Authentication and authorisation

### Waste pickers sign in with a phone number

Most waste pickers do not hold an email address, but Supabase Auth requires one. The API therefore
derives a stable internal identity from the normalised phone number:

```
0712345678  →  254712345678  →  254712345678@wastepickers.ke
```

Normalisation accepts `0712345678`, `712345678`, `+254712345678` and `254712345678` as the same
account. The derived address is never shown in the interface — the picker only ever sees their phone
number. This avoids requiring a paid SMS provider while keeping Supabase Auth as the identity source
of truth, as the proposal's integration layer specifies.

### Authorisation model

Every request carries the Supabase JWT as `Authorization: Bearer <token>`. Middleware resolves the
token to a user, then looks the user up in `admins` and `waste_pickers` to establish which of the two
roles applies. Three guards then protect the routes:

| Guard | Enforces |
|---|---|
| `requireAdmin` | Dashboard-only endpoints — the register, approvals, broadcasts, reports |
| `requirePicker` | Self-service endpoints under `/api/me` |
| `requireApproved` | Blocks pending registrants from logging activity until approved |

---

## 7. Administrative dashboard — functionality

> All screenshots in this section are captured from the **live deployment** with real data. Phone
> numbers and national ID numbers are masked in the images, since this repository is public and the
> register holds real contact details gathered during testing. Nothing else is altered.

### 7.1 Administrator sign-in

Administrators authenticate with email and password. The account must exist in the `admins` table;
a valid Supabase identity alone is rejected with *"This account is not an administrator"*.

![Administrator sign-in](screenshots/01-login.png)

### 7.2 Dashboard — community overview

The landing screen answers the coordinator's first four questions immediately: how many pickers are
registered, how many are waiting for review, how many messages have gone out, and how much material
the community has recorded.

Below the figures, three visualisations: registrations by county split into approved and pending, the
material mix as a share of total kilograms, and a six-month registration trend.

![Dashboard overview](screenshots/02-dashboard.png)

### 7.3 Waste picker register

The full register, searchable by name, phone or registration number, and filterable by status and
county. Each row exposes the actions available for that record's current state — `Approve` and
`Reject` on a pending registration, `Suspend` on an approved one.

Approving here is the action that triggers the database to issue the unique Waste Picker ID.

![Waste picker register](screenshots/03-waste-pickers.png)

### 7.4 Individual picker record

Selecting a name opens the full record: issued ID, status, contact details, county and sub-location,
registration date, and total material collected. Roles are assigned here — `Waste Picker`,
`Community Leader` or `Data Collector` — supporting the community-leadership structures welfare
programmes rely on.

![Individual picker record](screenshots/04-picker-detail.png)

### 7.5 Communication module

Coordinators compose a message and choose an audience: everyone, a single county, or one named
individual. Only approved pickers receive broadcasts. Messages may be flagged urgent for health
alerts and emergencies.

The log on the left records every message sent, how many recipients it reached, and how many have
opened it — the "communication reach" measure the proposal calls for.

![Communication module](screenshots/05-communication.png)

### 7.6 Collection activity

Every collection recorded by every picker, filterable by date range and material, with per-record
attribution to the picker and their county. Exportable to CSV.

![Collection activity](screenshots/06-activity.png)

### 7.7 Reporting module

Four tabular reports are exportable to CSV for submission to partner agencies. The page also publishes
this detailed PDF, including the dated executive summary and generated analytics graphs, through the
**Download system PDF** action.

**Registrations** — the full register with date-range, county and status filters.

![Registrations report](screenshots/07-reports-registrations.png)

**By region** — approved, pending, rejected and suspended counts per county.

![Registrations by region](screenshots/08-reports-by-region.png)

**Communication reach** — every broadcast with delivery and read counts.

![Communication reach report](screenshots/09-reports-communication.png)

**Community activity** — per-picker trip counts and total kilograms, ranked.

![Community activity report](screenshots/10-reports-activity.png)

---

## 8. Mobile application — functionality

### 8.1 Welcome and registration

New users install the application and complete a structured registration form: full name, phone
number, national ID (optional), gender, county, sub-location and password. The county list is fetched
live from the API so it can never drift from the database.

![Application splash screen](screenshots/m01-splash.jpg)
![Welcome screen](screenshots/m02-welcome.jpg)
![Registration form](screenshots/m03-register.jpg)
![Waste picker sign-in](screenshots/m04-signin.jpg)

### 8.2 Awaiting approval

Between submitting and being approved, the picker sees a dedicated screen explaining the position,
with a **Check my status** button that re-reads the profile. The moment a coordinator approves the
record, the next check unlocks the application. Rejected and suspended accounts get their own
explanatory message rather than a dead end.

![Awaiting approval](screenshots/m05-pending.jpg)

### 8.3 The digital identity card

The centrepiece of the application: a two-sided identity card carrying the system-issued registration
number. Tapping the card flips it.

The **front** carries the holder's photograph, full name, registration number, county, issue date and
role, over a machine-readable zone in the style of an official travel document. The **back** carries
the holder's particulars, status, the property-and-return notice, and the issuing authority.

For a worker previously absent from every formal register, this is the tangible output of the whole
system — a credential that can be produced when accessing a welfare programme.

![ID card front](screenshots/m06-id-front.jpg)
![ID card back](screenshots/m07-id-back.jpg)

### 8.4 Messages

Announcements broadcast from the dashboard arrive in the picker's inbox, newest first, with unread
items marked and a badge on the navigation bar. Urgent messages are flagged. Opening a message clears
its unread state, which is what feeds the read counts in the dashboard's communication report.

![Message received on the mobile app](screenshots/m08-message.jpg)

### 8.5 Activity log

Pickers record what they collect — material and weight — building a personal work history. Running
totals for all time, the current month and number of records sit at the top. This is the data that
makes the community's output measurable at the dashboard level.

![Activity log](screenshots/m09-activity.jpg)

### 8.6 Profile

Personal details can be corrected, and a profile photograph uploaded — stored in Supabase Storage and
rendered onto the identity card. The phone number is deliberately read-only, since it is the account
identifier.

![Profile](screenshots/m10-profile.jpg)

---

## 9. Deployment

### Live deployment

The dashboard and API deploy together to Vercel from the repository root:

| Setting | Value |
|---|---|
| Build command | `npm run vercel-build` |
| Output directory | `dashboard/dist` |
| Serverless function | `api/index.js` (exports the Express app) |
| Rewrite | `/api/(.*)` → `/api/index` |

Environment variables are configured in the Vercel project, never committed:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PHONE_EMAIL_DOMAIN`,
`PHOTO_BUCKET`.

### Mobile application

The Android client is maintained in a separate mobile project. Its `API_BASE_URL` build setting points
to the live HTTPS deployment; this repository contains the shared API, database, dashboard and the
mobile evidence used by this report.

### Running locally

```bash
cd server && npm install && npm run dev          # API on :4000
cd dashboard && npm install && npm run dev       # dashboard on :5173
```

Database setup is a single step: paste `supabase/schema.sql` into the Supabase SQL editor and run it.
`npm run seed -- --demo` then creates the first superadmin plus demonstration data.

---

## 10. Verification and testing

The complete workflow was executed against the **live deployment**, not a local copy. All eleven
steps passed:

| # | Step | Result |
|---|---|---|
| 1 | Administrator signs in | System Administrator / superadmin |
| 2 | New picker registers from the app | Created, `status = pending`, no ID yet |
| 3 | Picker attempts to log activity before approval | Blocked — *"registration is still awaiting approval"* |
| 4 | Administrator opens the approval queue | Pending registrations listed |
| 5 | Administrator approves | **`WP-KSM-2026-0003` issued by the database trigger** |
| 6 | Picker records a collection | 12.5 kg plastic accepted |
| 7 | Administrator broadcasts to a county | Delivered to all approved pickers in that county |
| 8 | Message reaches the picker's inbox | 1 message, 1 unread |
| 9 | Picker opens the message | Unread count returns to 0 |
| 10 | Dashboard reporting reflects the activity | Counts, broadcasts and kilograms updated |
| 11 | Picker attempts an administrator endpoint | Blocked — *"Administrator access only"* |

Database-level checks confirmed the ten regions seeded, the ID generator sequencing correctly per
region and year, the storage bucket present, and row-level security enabled on all core tables.

---

## 11. Security considerations

| Concern | Measure |
|---|---|
| Direct database access | Row-level security enabled on every table; the public `anon` key cannot read them |
| Privileged credentials | The `service_role` key is held only by the server and never shipped to the app or browser |
| Secrets in version control | `.gitignore` and `.vercelignore` both exclude every `.env`; only `.env.example` is committed |
| Transport | All traffic over HTTPS; the mobile application targets an HTTPS base URL |
| Privilege escalation | Role guards enforced server-side on every request, not in the client |
| Approval integrity | Only an authenticated administrator can change a registration's status |
| Password handling | Delegated entirely to Supabase Auth; the application never stores or sees password material |
| Published system report | Intentionally public as academic evidence; credentials are excluded and dashboard identifiers are masked |

---

## 12. Limitations and future work

**Push notifications.** Announcements are delivered in-app: the fan-out to `announcement_recipients`
is the mobile inbox and drives the unread badge. This requires no third-party service and is what the
demonstration runs on. A Firebase Cloud Messaging path is implemented behind the `FCM_SERVER_KEY`
environment variable to additionally deliver messages while the app is closed; without that key the
step is skipped and in-app delivery is unaffected.

**Offline capture.** Pickers work in areas with intermittent coverage. Recording collections
currently requires connectivity; a local queue that syncs when a connection returns would be the
natural next iteration.

**Verification of identity.** National ID numbers are captured but not validated against any
authority. Integration with a government register would strengthen the credential.

**Language.** The interface is English-only. Dholuo and Kiswahili localisation would materially widen
reach in the target region.

---

## 13. Appendix

### A. Demonstration accounts

Credentials are deliberately not published. Local seed credentials must be supplied through
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and `SEED_PICKER_PASSWORD`; production passwords must be
unique and rotated independently of demonstration data.

### B. API reference

The complete endpoint reference is in [`API.md`](API.md).

### C. Mobile evidence set

The ten physical-device captures in `docs/screenshots/m01-splash.jpg` through
`docs/screenshots/m10-profile.jpg` cover launch, welcome, registration, sign-in, pending approval,
both sides of the identity card, messages, activity and profile management.

### D. Repository layout

```
waste-picker-system/
├── api/               Vercel serverless entry points
├── server/            Node.js + Express REST API
│   └── src/
│       ├── routes/    auth, pickers, announcements, me, reports
│       ├── middleware/ authentication and role guards
│       └── lib/       Supabase clients, helpers, notification engine
├── dashboard/         React administrative dashboard
│   └── src/pages/     Login, Dashboard, Pickers, Announcements, Collections, Reports
├── supabase/
│   └── schema.sql     Tables, trigger, views, RLS, storage bucket
└── docs/
    ├── SYSTEM_DOCUMENTATION.md
    ├── API.md
    └── screenshots/
```

### E. Rebuilding the detailed report

Set `WPS_REPORT_EMAIL` and `WPS_REPORT_PASSWORD` only in the current shell, then run
`docs/capture_report_snapshot.ps1` to refresh the dated JSON snapshot. Run
`python docs/generate_system_report.py` to regenerate the charts and DOCX, followed by
`python docs/export_report_pdf.py` to publish the final PDF through Microsoft Word. Credentials and
access tokens are never written into the report.
