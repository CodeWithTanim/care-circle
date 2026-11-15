# Care Circle

[![Live App](https://img.shields.io/badge/Live%20App-care--circle--ochre.vercel.app-0f4c47?style=for-the-badge&logo=vercel)](https://care-circle-ochre.vercel.app/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.4.6-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.3-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-4285f4?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Native%20Driver-47a248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Tests](https://img.shields.io/badge/Tests-51%20Passed-brightgreen?style=for-the-badge&logo=vitest)](https://vitest.dev/)

An accessible elderly care and medication management platform built for the **PromptWars x Catalyst** hackathon. Care Circle puts the person receiving care at the center of their healthcare decisions — coordinating daily medications, appointments, daily vitals, and care routines with family and caregivers through secure, role-based circles.

Care Circle bridges everyday eldercare with the Google ecosystem: **Google Gemini 2.5 Flash** for plain-language medication explainers, food timing advice, and elder care Q&A; **Google Calendar** for one-click doctor visit synchronization; **Google Maps** for instant clinic navigation; and the **Web Speech API** for calm, elder-friendly voice summaries.

---

## 🌐 Live Application & Quick Tour

- **Live URL:** [https://care-circle-ochre.vercel.app/](https://care-circle-ochre.vercel.app/)
- **Evaluator Quick Start:**
  1. Open [https://care-circle-ochre.vercel.app/sign-up](https://care-circle-ochre.vercel.app/sign-up) to create an account (or sign in).
  2. On the dashboard, click the golden **"Evaluator Demo Tour"** button in the top bar.
  3. Click **"Load Evaluation Scenario"** — in one click, this safely populates:
     - **Eleanor Vance (Elder):** 78-year-old fictional care recipient with full emergency contact & physician details.
     - **3 Scheduled Medications:** Lisinopril (10mg), Metformin (500mg), and Vitamin D3 (2000 IU).
     - **Live Overdue Dose Alert:** A simulated missed morning dose ready to test the _"I'll handle this"_ claiming protocol.
     - **Doctor's Appointment:** Upcoming Cardiology follow-up with Google Calendar, Google Maps, and printable visit summary.
     - **Daily Vitals:** Blood pressure (122/82), fasting blood glucose (104 mg/dL), 5 water glasses, and a wellness walk.
  4. Explore the **"Gemini AI"** tab in the sidebar to ask questions and view medication guidance!

---

## 🏛️ Google Ecosystem Integrations

| Google Service                         | Location in App                                 | Capability & Impact                                                                                                                            |
| -------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Gemini 2.5 Flash**            | `Gemini AI` tab, Medication cards, `Today` view | Plain-language medication explainer, food & beverage guidelines, senior care Q&A, and spoken voice summaries with zero-crash clinical fallback |
| **Google Calendar**                    | `Appointments` view (`appointments-view.tsx`)   | 1-Click "Add to Google Calendar" generating pre-filled events with title, provider, clinic location, and prep instructions                     |
| **Google Maps**                        | `Appointments` view (`appointments-view.tsx`)   | 1-Click "Open in Google Maps" navigation directions directly to doctor clinics and hospitals                                                   |
| **Google Cloud Run & Cloud Scheduler** | Deployment architecture (`Dockerfile`)          | Containerized serverless deployment with cron-based background reminder dispatch                                                               |

---

## 📑 Complete Feature Catalog

### 1. 🤖 Google Gemini AI Care Assistant

- **Dedicated "Gemini AI" Dashboard Tab:** Located right in the main sidebar for instant access by any family member.
- **Interactive Care Q&A Box:** Ask natural questions in plain English (_"Can Eleanor take Metformin on an empty stomach?"_, _"What should we do if she misses her morning Lisinopril?"_, _"How much water should an elder drink daily?"_).
- **Quick Question Chips:** Four pre-populated, high-frequency eldercare queries for one-tap answers.
- **Plain-Language Medication Explainer:**
  - **Purpose:** 1-2 gentle sentences explaining what the medication does without medical jargon or alarming terms.
  - **Food & Beverage Guidelines:** Clear rules on meals, hydration, and dietary restrictions (e.g., avoiding grapefruit, taking with meals).
  - **Daily Routine Tips:** Best timing (morning vs evening), storage safety, and advice for seniors (e.g., rising slowly to prevent lightheadedness).
- **Elder Voice Read-Aloud:** Integrated Web Speech API synthesizer reading responses at a calm, elderly-friendly pace (0.88x–0.9x speed) with 1-click stop.
- **Dual-Engine Architecture with Zero-Crash Fallback:**
  - **Live AI Mode:** Connects to Google's official `gemini-2.5-flash` endpoint when `GEMINI_API_KEY` is present.
  - **Verified Clinical Knowledgebase Mode:** When tested without an API key or offline, automatically serves pre-verified clinical guidance for major elder medications (Lisinopril, Metformin, Atorvastatin, Amlodipine, Levothyroxine, Omeprazole). The app **never breaks or throws errors**.
- **Clinical Safety Compliance:** Adheres strictly to `AGENT.MD` guardrails — non-diagnostic, non-prescriptive, never alters doses, and includes clinical disclaimers on every response.

### 2. 👵 Senior Accessibility Mode & Today View

- **Elder Mode Toggle:** Prominent toggle on the Today view optimizing the entire interface for seniors:
  - High-contrast color palette and enlarged typography.
  - Extra-large touch targets (minimum 44px, up to 56px) for easy touchscreen tapping.
  - Tactile Web Audio API positive chime upon dose confirmation.
  - Emergency Check-In Beacon displaying the elder's primary doctor and emergency contact numbers prominently.
  - **Voice Assistant:** Dedicated "Read Today's Schedule Aloud" button speaking today's scheduled doses and times.
- **Dose Confirmations:** Big "Mark Taken" button recording the exact actor name, user ID, and UTC timestamp.
- **Bounded Snooze ("Remind in 15m"):** Snooze up to 3 times (15 minutes each) to allow time to finish eating or drinking while preventing indefinite neglect.
- **Contextual AI Tips:** Every scheduled dose card features an "AI Food & Care Tips" button for immediate guidance.

### 3. 🩺 Daily Healthcare Routines & Vitals Tracker

- **Blood Pressure Tracker:** Records systolic and diastolic readings along with time of measurement; tags readings as normal or elevated.
- **Blood Glucose Tracker:** Logs blood sugar in mg/dL with contextual tags (_Fasting_, _Post-Meal_, _Random_) and timestamps.
- **Hydration Tracker:** Visual daily water intake tracker with interactive `+` and `-` buttons (tracks 0 to 12 glasses).
- **Daily Wellness Walk Tracker:** Checkbox confirmation and notes for gentle daily physical exercise.
- **Idempotent Persistence:** Daily records are saved and retrieved idempotently by date and circle ID.

### 4. 💊 Prescriptions & Medication Management

- **Comprehensive Medication CRUD:** Medication name, dosage (e.g., "10mg tablet"), specific instructions, schedule times (e.g., `08:00`, `20:00`), start date, and optional end date.
- **Deterministic Occurrence Generator:** Automatically creates daily dose occurrences aligned with the circle's local IANA timezone.
- **Active vs. Archived Views:** Allows discontinuing prescriptions without deleting historical adherence records.
- **Direct AI Care Guide Trigger:** Every medication card features a dedicated **"Gemini AI Food & Care Guide"** button opening the full clinical modal.

### 5. 🏥 Appointments, Calendar & Printable Doctor Summary

- **Healthcare Visit CRUD:** Provider name, appointment title, clinic/hospital address, date, time, and preparation notes.
- **Google Calendar 1-Click Sync:** Encodes appointment title, clinic location, details, and exact start/end times directly into Google Calendar.
- **Google Maps 1-Click Navigation:** Direct link opening turn-by-turn directions to the healthcare facility.
- **RFC 5545 iCalendar (`.ics`) Export:** Downloadable calendar file for Apple Calendar, Outlook, and mobile devices.
- **Printable Doctor's Visit Summary Sheet (`DoctorSummaryDialog`):**
  - Formatted specifically for physical printing (`@media print`).
  - Summarizes elder profile, emergency contacts, active medications with dosages, recent adherence statistics, and latest vitals to hand directly to physicians during clinic visits.

### 6. 🚨 Caregiver Follow-Up Protocol ("I'll handle this")

- **Automated Overdue Alerts:** Generated automatically when a scheduled dose passes the 60-minute grace period without confirmation.
- **Atomic Concurrency Claiming:** When a family member clicks **"I'll handle this"**, a MongoDB atomic operation assigns responsibility, preventing duplicate family phone calls or double doses.
- **Transparent Statuses:** Visible across all circle members (`Pending` → `Acknowledged by Sarah` → `Resolved`).
- **Safe Resolution:** Follow-up resolution notes are recorded to resolve the family alert without falsifying the clinical medication log.

### 7. 📈 Honest Adherence History & Analytics

- **Derived Adherence Logic:** Doses unconfirmed after the grace period are derived as `unconfirmed_missed` (not clinically assumed un-taken).
- **Filterable Windows:** View adherence trends across the Last 7, 14, or 30 Days.
- **Adherence Metrics:** Total doses, taken count, unconfirmed missed count, and overall adherence rate percentage.
- **Chronological Timeline:** Visual audit log of past doses with timestamps and confirmation actors.

### 8. 👥 Elder-Centered Care Circles & Role Barriers

- **Explicit Care Consent:** Circle creation requires an explicit elder consent checkbox and consent notes.
- **Three Granular Roles:**
  - **Owner:** Full circle management, invites, member roles, ownership transfer, medication/appointment CRUD.
  - **Caregiver:** Manages prescriptions, logs doses, schedules doctor visits, claims and resolves alerts.
  - **Family Observer:** Read-only timeline visibility with active participation in alert follow-ups ("I'll handle this").
- **Server-Side Enforcement:** Every API route verifies authentication, circle membership, and role permissions at the database level.
- **Multi-Circle Support:** Switch between multiple care circles via a header dropdown or create/join new ones.

### 9. 🔐 Cryptographic Passcode Invitations

- **Human-Readable Passcodes:** Formatted codes (e.g., `CARE-XXXX-XXXX`) for easy communication over phone or SMS.
- **SHA-256 Hashing:** Raw passcodes are never stored in the database or written to server logs.
- **Role Pre-Assignment:**
  - `Caregiver`
  - `Family Observer`
  - **Patient / Care Recipient:** When an elder joins using this passcode, they are automatically linked to `circle.recipientUserId`, granting full dose confirmation and Senior Mode access.
- **Security Controls:** Configurable expiration (1h, 24h, 48h), max uses (1 vs unlimited), manual revocation, and brute-force lockout after 5 failed attempts.

### 10. ⏰ Proactive Reminders & Background Worker

- **Idempotent Queue:** Generates deduplicated reminder jobs for upcoming doses, missed doses, and appointments.
- **Pre-Flight Validation:** Rechecks medication state right before dispatching — if the elder has already taken the dose, the reminder is automatically cancelled.
- **Atomic Worker Leasing:** Prevents duplicate emails when scaling across multiple server instances.
- **Protected Cron Endpoint:** `/api/cron/reminders` authenticated via Bearer `CRON_SECRET` for Google Cloud Scheduler.
- **Pluggable Transports:** Supports Resend API in production and an in-memory safe test transport during development.

### 11. 🎨 Modern Shell & Responsive UX

- **Fixed YouTube-Style Header:** Quick logo navigation, active circle switcher, evaluator demo tour button, and user session badge.
- **Collapsible Left Sidebar:** Mini-sidebar mode (80px icon navigation) for maximum screen real estate on desktop, expanding to full 256px on hover or toggle.
- **Mobile Drawer:** Smooth responsive slide-out drawer on tablets and phones.
- **Persistent Tab Navigation:** Dashboard tab state (`today`, `medications`, `appointments`, `members`, `adherence`, `ai`, `settings`) persists across page reloads and browser back/forward buttons via query params and `popstate`.
- **Split-Screen Authentication:** Modern sign-in and sign-up pages with healthcare branding, user quotes, and password visibility toggles.
- **Marquee Landing Page:** Homepage featuring an infinite right-to-left scrolling ticker, feature highlights, and conditional authentication routing.

---

## 🛠️ Tech Stack

```text
Frontend Framework:   Next.js 16.4.6 (App Router, Turbopack, React 19)
Programming Language: TypeScript (Strict Mode, 0 any types)
Styling & UI:         Tailwind CSS v4, shadcn/ui, Radix UI, Lucide Icons
AI Engine:            Google Gemini 2.5 Flash API (REST API)
Authentication:       Better Auth 1.7 + MongoDB Adapter
Database:             MongoDB (Native Driver 7.9, pooled client)
Validation:           Zod v4
Audio & Speech:       Web Speech API (Synthesis) + Web Audio API (Synthesized Chimes)
Testing:              Vitest 5.1 + MongoMemoryServer (In-Memory Database)
Containerization:     Docker (Multi-stage node:24-bookworm-slim)
Hosting:              Vercel / Google Cloud Run
```

---

## 🧪 Automated Testing & Verification

Care Circle includes **9 test suites with 51 unit and integration tests** executing against an isolated in-memory MongoDB server (`MongoMemoryServer`). Tests never touch real or developer databases.

```bash
npm run lint         # ESLint 9 checks (0 errors, 0 warnings)
npm run typecheck    # Strict TypeScript type generation & compiler check
npm test             # Vitest test suite with MongoMemoryServer
npm run build        # Standalone Next.js production build
npm run format:check # Prettier code formatting verification
npm run check        # All four verification suites in sequence
```

### Test Suite Breakdown:

| Test File                               | Tests | Coverage Scope                                                                                                    |
| --------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------- |
| `tests/gemini-ai.test.ts`               | 5     | Gemini API guide generation, clinical knowledgebase fallback, safe Q&A responses, elder hydration queries         |
| `tests/vitals-and-calendar.test.ts`     | 4     | Google Calendar URL encoding, Google Maps URL formatting, RFC 5545 iCalendar generation, daily vitals persistence |
| `tests/care-services.test.ts`           | 10    | Medication CRUD, occurrence generation, dose confirmations, bounded snooze, appointment lifecycle, alert claiming |
| `tests/circle-service.test.ts`          | 6     | Care circle creation, explicit elder consent, passcode hashing, join flow, ownership transfer                     |
| `tests/permissions.test.ts`             | 6     | Unique membership indexes, cross-circle access rejection, role restrictions, dose confirmation authorization      |
| `tests/journey.test.ts`                 | 8     | Complete 8-step end-to-end acceptance journey from circle creation through alert resolution                       |
| `tests/scheduling-and-delivery.test.ts` | 6     | Timezone midnight boundaries, DST transitions, atomic worker concurrency, retry backoff, cron security            |
| `tests/auth.test.ts`                    | 5     | Password hashing, short password rejection, invalid credentials, session revocation, untrusted origin defense     |
| `tests/demo.test.ts`                    | 1     | Complete fictional evaluation scenario seeding (Eleanor Vance profile, meds, alert, appointment, vitals)          |

---

## 🚀 Local Setup & Configuration

### Prerequisites

- **Node.js 24 LTS** (`node -v` >= 24.0.0)
- **npm**
- **MongoDB** (Local instance, Docker, or MongoDB Atlas)

### Installation

```bash
# Clone repository
git clone https://github.com/CodeWithTanim/care-circle.git
cd care-circle

# Install dependencies
npm install

# Start local MongoDB (optional if using Atlas)
docker compose up -d mongodb

# Run Next.js development server
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

### Environment Variables (`.env`)

```env
# Database
MONGODB_URI=mongodb://localhost:27017/care_circle
MONGODB_DB=care_circle

# Authentication (Better Auth)
BETTER_AUTH_SECRET=your_minimum_32_character_cryptographic_secret
BETTER_AUTH_URL=http://localhost:3000

# Google Gemini Generative AI (Optional - falls back to knowledgebase if unset)
GEMINI_API_KEY=your_google_ai_studio_gemini_api_key

# Background Scheduler & Email (Optional for local dev)
CRON_SECRET=your_scheduler_bearer_secret
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=notifications@yourdomain.com
```

---

## ☁️ Google Cloud Run Deployment

Care Circle is pre-configured for containerized deployment on Google Cloud Run.

### 1. Build and Push Docker Image

```bash
docker build -t gcr.io/[PROJECT-ID]/care-circle:latest .
docker push gcr.io/[PROJECT-ID]/care-circle:latest
```

### 2. Deploy Service to Cloud Run

```bash
gcloud run deploy care-circle \
  --image gcr.io/[PROJECT-ID]/care-circle:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars BETTER_AUTH_URL=https://[YOUR-SERVICE-URL],MONGODB_DB=care_circle \
  --set-secrets MONGODB_URI=MONGODB_URI:latest,BETTER_AUTH_SECRET=BETTER_AUTH_SECRET:latest,CRON_SECRET=CRON_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest
```

### 3. Cloud Scheduler Cron Setup

Configure a Google Cloud Scheduler job executing every 15 minutes (`*/15 * * * *`):

- **Target:** `POST https://[YOUR-SERVICE-URL]/api/cron/reminders`
- **Auth Header:** `Authorization: Bearer [CRON_SECRET]`

---

## 🗺️ Project Map

```text
src/
├── app/
│   ├── (auth)/                     Split-screen sign-in and sign-up pages
│   ├── api/
│   │   ├── auth/[...all]/          Better Auth authentication endpoints
│   │   ├── circles/                Care circle CRUD, invites, and join
│   │   │   └── [circleId]/
│   │   │       ├── adherence/      Historical adherence query endpoint
│   │   │       ├── ai/ask/         Interactive Gemini Care Q&A endpoint
│   │   │       ├── alerts/         Overdue dose alerts & "I'll handle this" claiming
│   │   │       ├── appointments/   Doctor visits & prep notes
│   │   │       ├── doses/          Today's dose list, confirmations, snooze
│   │   │       ├── invites/        Passcode generation and management
│   │   │       ├── medications/    Prescription CRUD & Gemini AI guides
│   │   │       ├── members/        Member listing & role management
│   │   │       ├── preferences/    Notification settings
│   │   │       └── vitals/         Daily blood pressure, sugar, water, walk
│   │   ├── cron/reminders/         Cloud Scheduler dispatch endpoint
│   │   ├── demo/seed/              Evaluator quick demo scenario seeder
│   │   └── health/                 Health check probe
│   ├── dashboard/                  Main dashboard server-rendered page
│   └── page.tsx                    Accessible homepage with infinite marquee
├── components/
│   ├── auth/                       Account forms, sign-out button
│   ├── circle/
│   │   ├── adherence-view.tsx      Adherence graphs & timeline
│   │   ├── ai-assistant-view.tsx   Gemini AI interactive assistant tab
│   │   ├── appointments-view.tsx   Doctor visits, Google Calendar & Maps
│   │   ├── dashboard-view.tsx      YouTube-style sidebar shell & tour modal
│   │   ├── doctor-summary-dialog.tsx Printable doctor visit sheet (@media print)
│   │   ├── medication-ai-dialog.tsx  Gemini medication food & care guide modal
│   │   ├── medications-view.tsx    Prescription management
│   │   ├── members-view.tsx        Circle roster & passcode generator
│   │   ├── onboarding-view.tsx     Circle creation & join wizard
│   │   ├── settings-view.tsx       Timezone & preference settings
│   │   └── today-view.tsx          Senior Mode, voice assistant & vitals
│   ├── home/                       Landing page navigation
│   └── ui/                         Accessible shadcn/ui components
└── lib/
    ├── alert-service.ts            Atomic "I'll handle this" claiming logic
    ├── appointment-service.ts      Doctor visit scheduling
    ├── auth.ts & auth-client.ts    Better Auth configuration & client
    ├── calendar.ts                 Google Calendar, Maps & iCal generators
    ├── circle-service.ts           Circle management & hashed passcodes
    ├── db.ts & db-indexes.ts       MongoDB pool & unique index definitions
    ├── demo-data.ts                Fictional evaluation scenario dataset
    ├── gemini-ai.ts                Google Gemini 2.5 Flash API & knowledgebase
    ├── medication-service.ts       Deterministic dose scheduling & adherence
    ├── models.ts                   Domain TypeScript interfaces
    ├── permissions.ts              Centralized server-side authorization
    ├── reminder-service.ts         Idempotent job queue & atomic worker leases
    ├── tabs.ts                     Type-safe tab definitions
    ├── timezone.ts                 IANA timezone & DST boundary conversions
    └── vitals-service.ts           Daily routine & vitals persistence
tests/                              9 Vitest integration and unit test suites
```

---

## 🔮 Future Production Enhancements

1. **Push Notifications (Firebase Cloud Messaging - FCM):** Complement email notifications with instant mobile/browser push alerts for overdue doses.
2. **Multilingual Support (i18n):** Complete Spanish, Bengali, and Hindi localization for the UI, Gemini AI answers, and voice synthesizer.
3. **Gemini Vision Pill Identifier:** Photograph a prescription pill with a smartphone to verify color, imprint, and shape against database records before taking.
4. **Drug Interaction Scanner:** Use Gemini to check an elder's complete medication list for known contraindications and drug-food interactions.
5. **PDF Clinical Reports:** Export monthly vitals and adherence charts into downloadable PDFs for physicians.
6. **Progressive Web App (PWA):** Service worker caching for offline access and home screen installation on iOS and Android.
7. **Real-Time WebSockets / SSE:** Instant multi-user screen updates when a family member takes a dose or claims an alert without manual refresh.
8. **Wearable Device Integration:** Automatic synchronization of blood pressure and step counts via Google Fit / Health Connect.

---

## 📄 License

Built for the **PromptWars x Catalyst** hackathon. All rights reserved.
