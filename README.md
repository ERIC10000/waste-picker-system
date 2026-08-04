# Waste Picker Management System

**A Web-Based Mobile Waste Picker App** — INSY 492 Senior Project
Wiclife Omondi Ongo · BBIT · University of Eastern Africa, Baraton · Supervisor: Dr. Victor Mony · AY 2025/2026

A dual-platform system that registers waste pickers across Western Kenya, issues each of them a
verifiable system-generated identity, and gives welfare coordinators a single dashboard from which to
manage, communicate with and report on the community.

---

## The four-tier architecture

| Tier | What lives here | Built with |
|---|---|---|
| **Presentation** | Android app (waste pickers) · Web dashboard (administrators) | Kotlin + XML · React |
| **Application** | REST API, authentication, unique-ID generator, notification engine | Node.js + Express |
| **Integration** | Supabase Auth, Supabase Storage | Supabase SDK |
| **Data** | PostgreSQL tables, views and storage buckets | Supabase (Postgres) |

```
Android app  ─┐
              ├──►  Node/Express REST API  ──►  Supabase (Auth · Postgres · Storage)
React dashboard ─┘
```

## Repository layout

```
WastePickerSystem/
├── supabase/schema.sql     Database schema, ID generator, reporting views, RLS, storage bucket
├── server/                 Node.js + Express REST API  (port 4000)
├── dashboard/              React admin dashboard        (port 5180)
└── docs/                   API reference and setup notes

C:\Users\Administrator\AndroidStudioProjects\WiclifeProject\
                            Android app (Kotlin + XML)
```

---

## Setup — 5 steps

### 1. Create the Supabase project

Go to [supabase.com](https://supabase.com) → **New project**. Once it finishes provisioning, open
**Project Settings → API** and copy three values:

- Project URL
- `anon` public key
- `service_role` secret key

### 2. Create the database

Supabase Dashboard → **SQL Editor** → **New query** → paste the whole of
[`supabase/schema.sql`](supabase/schema.sql) → **Run**.

This creates every table, the `WP-KSM-2026-0001`-style ID generator, the reporting views, row-level
security policies, and the `picker-photos` storage bucket. It is safe to run more than once.

### 3. Start the API

```bash
cd C:\Users\Administrator\Desktop\WastePickerSystem\server
```

Copy `.env.example` to `.env`, paste in the three Supabase values, and set `SEED_ADMIN_EMAIL` plus a
strong `SEED_ADMIN_PASSWORD`. To create demo picker accounts, also set `SEED_PICKER_PASSWORD`. Then:

```bash
npm run seed -- --demo
```

The seed command creates the first superadmin plus demo pickers and activity so the dashboard has
something to show. Drop `-- --demo` if you only want the admin account.

```bash
npm run dev
```

The API listens on **http://localhost:4000**.

### 4. Start the dashboard

```bash
cd C:\Users\Administrator\Desktop\WastePickerSystem\dashboard
npm run dev -- --port 5180
```

Open **http://localhost:5180** and sign in with the seeded admin account.

### 5. Run the Android app

Open `C:\Users\Administrator\AndroidStudioProjects\WiclifeProject` in Android Studio, let Gradle sync,
then Run on an emulator.

The app calls `http://10.0.2.2:4000/` — the address an Android **emulator** uses to reach `localhost`
on the host PC. To run on a **physical phone** on the same Wi-Fi, change `API_BASE_URL` in
`app/build.gradle.kts` to your PC's LAN address (e.g. `http://192.168.1.5:4000/`) and re-sync.

---

## What each part does

### Android app — the waste picker's portal

| Screen | Purpose |
|---|---|
| Welcome / Register / Login | Self-registration with phone number, region and personal details |
| Awaiting approval | Shown until an administrator approves the registration |
| Home | **Digital ID card** with the system-generated Waste Picker ID, plus an activity snapshot |
| Messages | Inbox of announcements, with unread badges on the navigation bar |
| Activity | Record what was collected (material + weight); running totals |
| Profile | Edit details, upload a profile photo, sign out |

### Web dashboard — the coordinator's hub

| Page | Purpose |
|---|---|
| Dashboard | Headline counts, registrations by region, material mix, 6-month registration trend |
| Waste Pickers | Search and filter, approve/reject/suspend, assign roles, per-picker detail drawer |
| Communication | Compose a broadcast to everyone, one region, or one individual; delivery + read log |
| Activity | All collection records across the community, filterable, CSV export |
| Reports | Registrations, by-region, communication reach and activity reports; CSV exports plus the detailed system-summary PDF |

---

## Implementation notes

**How the unique ID works.** A registration starts with no ID. The moment an administrator sets the
status to `approved`, a Postgres trigger calls `generate_picker_id()`, which takes the next number in
that region and year from `id_sequences` and returns e.g. `WP-KSM-2026-0001`. Doing it inside the
database (rather than in application code) means two simultaneous approvals can never collide on the
same number.

**How pickers log in without an email address.** Waste pickers sign in with the phone number they
registered with. Supabase Auth needs an email identity, so the API deterministically maps the phone to
one — `254712345678@wastepickers.ke` — and hides that entirely from the app. The picker only ever sees
their phone number.

**How notifications reach the phone.** Every broadcast fans out into `announcement_recipients`, one row
per recipient. That table is the mobile inbox, and `read_at IS NULL` drives the unread badge — no
third-party service needed, which is what the demo runs on. If `FCM_SERVER_KEY` is set in the server
`.env`, the same message is *additionally* pushed through Firebase Cloud Messaging so it arrives while
the app is closed; without the key that step is skipped and in-app delivery is unaffected.

**Security.** Row-level security is enabled on every table. All application traffic goes through the
API using the `service_role` key, which stays on the server and is never shipped to the app or the
browser. The `anon` key cannot read the tables directly.

---

## Seed credentials

Credentials are never hard-coded or published. Define `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and,
when using demo data, `SEED_PICKER_PASSWORD` in the ignored `server/.env` file before running the seed
command. Use separate, rotated credentials for production.

---

## API reference

See [`docs/API.md`](docs/API.md).

## Detailed system report

The reproducible, illustrated report is available as
[`docs/Waste Picker System - System Documentation.pdf`](docs/Waste%20Picker%20System%20-%20System%20Documentation.pdf),
with the editable DOCX and generator in `docs/`. It includes a dated live-data summary, four analytics
graphs, five implementation diagrams, ten dashboard captures and ten mobile captures. The deployed
Reports page also exposes the PDF through **Download system PDF**.
