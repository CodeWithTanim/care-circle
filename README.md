# Care Circle

An accessible elderly care and medication management platform built for the **PromptWars x Catalyst** hackathon. The person receiving care stays at the center of their healthcare decisions — coordinating daily medications, appointments, vitals, and care routines with family and caregivers through secure passcode-based circles.

Care Circle integrates **Google Gemini 2.5 Flash** for plain-language medication guidance and food timing advice, **Google Calendar** for doctor visit synchronization, **Google Maps** for clinic navigation, and the **Web Speech API** for elder-friendly voice readouts — all wrapped in a senior-accessible UI with high-contrast layouts, large touch targets, and a dedicated voice assistant.

## Live Demo

> **Evaluator Quick Start**: Sign up at `/sign-up`, then click the golden **"Evaluator Demo Tour"** button in the dashboard top bar. One click loads Eleanor Vance (78-year-old fictional elder) with 3 medications, an overdue dose alert, a cardiology appointment, and daily vitals — ready to explore every feature instantly.

---

## Google Services Integration

| Google Service              | Where It's Used                             | What It Does                                                                                   |
| --------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Google Gemini 2.5 Flash** | Gemini AI tab, Medication cards, Today view | Plain-language medication explainer, food & beverage guidelines, care Q&A, and voice summaries |
| **Google Calendar**         | Appointments view                           | One-click "Add to Google Calendar" with pre-filled doctor visit details                        |
| **Google Maps**             | Appointments view                           | One-click driving/transit directions to clinic or hospital                                     |
| **Google Cloud Run**        | Deployment                                  | Production containerized deployment with Cloud Scheduler for reminder dispatch                 |

---

## Local Setup

Requires **Node.js 24 LTS** and npm. Run all commands from the repository root.

```bash
npm install
```

Configuration is in the root `.env` file (auto-loaded by Next.js). Never commit credentials.

```bash
# Start MongoDB locally (or supply a MongoDB Atlas URI)
docker compose up -d mongodb
npm run dev
```

Open http://localhost:3000. Create an account at `/sign-up`, then visit `/dashboard`.

### Environment Variables

| Variable             | Purpose                                                                    | Required                                        |
| -------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| `MONGODB_URI`        | MongoDB connection URI                                                     | Yes                                             |
| `MONGODB_DB`         | Database name                                                              | Default: `care_circle`                          |
| `BETTER_AUTH_SECRET` | Cryptographic auth secret (min 32 chars)                                   | Yes                                             |
| `BETTER_AUTH_URL`    | App origin (e.g. `http://localhost:3000`)                                  | Yes                                             |
| `GEMINI_API_KEY`     | Google Gemini API key from [AI Studio](https://aistudio.google.com/apikey) | Optional (falls back to clinical knowledgebase) |
| `CRON_SECRET`        | Bearer token for Cloud Scheduler reminder endpoint                         | Optional                                        |
| `RESEND_API_KEY`     | Resend API key for email delivery                                          | Optional (uses test transport if unset)         |
| `EMAIL_FROM`         | Verified sender address for notifications                                  | Optional                                        |

Builds work without secrets or a running database. Runtime configuration is validated on access.

---

## Features

### 🤖 Google Gemini AI Care Assistant

A dedicated **"Gemini AI"** tab in the dashboard sidebar provides interactive care intelligence:

- **Interactive Care Q&A**: Ask any eldercare question in plain English — food timing, missed dose protocols, hydration routines, blood pressure precautions — and receive structured, non-diagnostic guidance.
- **Quick Question Chips**: Pre-built common care questions for one-tap access.
- **Per-Medication Care Guide**: Click any medication card to open a detailed modal with purpose, food guidelines, routine tips, and a clinical disclaimer.
- **Elder Voice Read-Aloud**: Every AI response and medication guide can be spoken aloud using Web Speech API at a gentle pace (0.88x–0.9x rate) designed for seniors.
- **Dual-Mode Engine**: When `GEMINI_API_KEY` is set, queries hit Google Gemini 2.5 Flash for live AI responses. Without a key, the system seamlessly falls back to a verified clinical knowledgebase (Lisinopril, Metformin, Atorvastatin, Amlodipine, Levothyroxine, Omeprazole) with zero errors.
- **Safety Compliance**: Never prescribes, diagnoses, or suggests dosage changes. Every response includes a clinical disclaimer per `AGENT.MD` safety rules.

### 👥 Elder-Centered Care Circles

- Create care circles with explicit sharing consent and IANA time zone support.
- Three distinct roles: **Owner** (full control), **Caregiver** (manage medicines & appointments), **Family Observer** (read-only with alert follow-up).
- **Patient / Care Recipient** invitation role that automatically links the joining user as the elder in the circle.
- Ownership transfer to trusted family or caregivers.

### 🔐 Secure Invitation Passcodes

- Cryptographically random, human-readable passcodes (`CARE-XXXX-XXXX`).
- SHA-256 hashed before storage, with configurable expiry (1h / 24h / 48h) and maximum uses.
- Rate-limited failed attempts to prevent brute-force.
- Passcodes never appear in logs or URLs.

### 🛡️ Granular Permissions & Server-Side Authorization

- Every API route validates session, circle membership, and role-specific permissions.
- Cross-circle access is rejected at the server — page-level protection alone is never relied upon.
- Dose confirmations restricted to owners, caregivers, and linked care recipients.

### 📋 Today View & Senior Accessibility Mode

- High-contrast, large-text layout with **44px minimum** touch targets for elderly users.
- Big **"Mark Taken"** button with actor identity and UTC timestamp recording.
- **Bounded snooze** ("Remind in 15m") limited to 3 times to prevent indefinite neglect.
- **Elder Mode toggle**: Extra-large fonts, tactile Web Audio API success chime, and voice assistant.
- **Emergency Check-In Beacon**: Quick emergency contact visibility in Senior Mode.
- **Daily Vitals Tracker**: Blood pressure (systolic/diastolic), blood sugar (fasting/post-meal/random), water intake (glasses), and wellness walk logging.

### 💊 Medication Management

- Full CRUD for medications with dosage, instructions, schedule times, start/end dates.
- Automatic daily dose occurrence generation based on schedule times and circle timezone.
- Archive/restore functionality for discontinued medications.
- **Gemini AI Food & Care Guide** button on every medication card.

### 📊 Adherence Tracking

- Unconfirmed doses past the 60-minute grace period are derived as `unconfirmed_missed` (not clinically assumed un-taken).
- Filterable adherence timeline (last 7, 14, or 30 days) with visual statistics.
- Adherence percentage calculation across all scheduled doses.

### 🏥 Doctor Appointments & Google Calendar

- Schedule doctor visits with provider, location, date/time, and prep notes.
- **Google Calendar Sync**: One-click "Add to Google Calendar" with pre-filled event details.
- **Google Maps Navigation**: One-click directions to the appointment location.
- **RFC 5545 iCalendar Export**: Download `.ics` file for any calendar application.
- **Printable Doctor's Visit Summary**: Print-optimized sheet with current medications, adherence rates, and vitals to bring to appointments.

### 🔔 Proactive Alerts & "I'll Handle This"

- Overdue dose alerts with real-time visibility across all circle members.
- **Atomic "I'll handle this" claiming**: Prevents two members from simultaneously becoming responsible.
- Follow-up resolution with notes — without falsifying clinical medication records.
- Entire circle sees who acknowledged and who resolved the follow-up.

### ⏰ Reminder System & Cloud Scheduler

- Idempotent delivery jobs with atomic worker claims preventing duplicate emails.
- Rechecks medication state before dispatch (cancels reminders if dose was already confirmed).
- Bounded retries (max 3) with observable failure tracking.
- Protected endpoint `POST /api/cron/reminders` authenticated via `CRON_SECRET` bearer token.

### 🎯 Evaluator Demo Tour

- One-click golden **"Evaluator Demo Tour"** button in the dashboard header.
- Instantly seeds: Eleanor Vance (78-year-old elder), 3 medications (Lisinopril 10mg, Metformin 500mg, Vitamin D3 2000 IU), an overdue missed-dose alert, a cardiology follow-up appointment, and today's vitals.
- Safe and idempotent — can be clicked multiple times without duplicating data.

---

## Validation & Tests

```bash
npm run lint         # ESLint (0 errors, 0 warnings)
npm run typecheck    # TypeScript strict mode check
npm test             # Vitest with MongoMemoryServer
npm run build        # Next.js standalone production build
npm run format:check # Prettier formatting check
npm run check        # All checks in sequence
```

**9 test suites, 51 integration and unit tests** run against an isolated in-memory MongoDB instance, covering:

| Test Suite                        | What It Verifies                                                              |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `auth.test.ts`                    | Sign-up, sign-in, password hashing, session validation, origin checking       |
| `circle-service.test.ts`          | Circle creation, consent, passcode hashing, join flow, ownership transfer     |
| `permissions.test.ts`             | Unique membership, cross-circle denial, role restrictions, dose permissions   |
| `care-services.test.ts`           | Medication CRUD, dose scheduling, snooze, adherence, alerts, reminders        |
| `journey.test.ts`                 | Full 8-step acceptance journey from circle creation through alert resolution  |
| `scheduling-and-delivery.test.ts` | Timezone/DST boundaries, concurrent worker claims, retry limits, cron auth    |
| `vitals-and-calendar.test.ts`     | Daily vitals persistence, Google Calendar URL, Maps URL, iCalendar RFC 5545   |
| `demo.test.ts`                    | Fictional scenario seeding with medications, appointments, alerts, and vitals |
| `gemini-ai.test.ts`               | Medication guide generation, knowledgebase fallback, care Q&A responses       |

---

## Cloud Run & Google Cloud Deployment

### 1. Build and Push Container

```bash
docker build -t gcr.io/[PROJECT-ID]/care-circle:latest .
docker push gcr.io/[PROJECT-ID]/care-circle:latest
```

### 2. Deploy to Cloud Run

```bash
gcloud run deploy care-circle \
  --image gcr.io/[PROJECT-ID]/care-circle:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars BETTER_AUTH_URL=https://[YOUR-SERVICE-URL],MONGODB_DB=care_circle \
  --set-secrets MONGODB_URI=MONGODB_URI:latest,BETTER_AUTH_SECRET=BETTER_AUTH_SECRET:latest,CRON_SECRET=CRON_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest
```

### 3. Cloud Scheduler for Reminders

Configure a Google Cloud Scheduler job (every 15 minutes: `*/15 * * * *`) targeting:

```
POST https://[YOUR-SERVICE-URL]/api/cron/reminders
Header: Authorization: Bearer [CRON_SECRET]
```

---

## Tech Stack

| Layer              | Technology                                         |
| ------------------ | -------------------------------------------------- |
| **Framework**      | Next.js 16.4 (App Router, Turbopack, React 19)     |
| **Language**       | TypeScript (strict mode)                           |
| **Styling**        | Tailwind CSS v4, shadcn/ui, Radix UI, Lucide Icons |
| **Authentication** | Better Auth with MongoDB adapter                   |
| **Database**       | MongoDB (native driver, no ORM)                    |
| **AI**             | Google Gemini 2.5 Flash API                        |
| **Validation**     | Zod v4                                             |
| **Testing**        | Vitest, MongoMemoryServer                          |
| **Deployment**     | Docker, Google Cloud Run                           |
| **Voice**          | Web Speech API (SpeechSynthesis), Web Audio API    |

---

## Project Structure

```
src/
  app/                          Next.js App Router pages & API routes
    api/circles/                Circle CRUD, invites, doses, adherence, appointments, alerts
    api/circles/[circleId]/ai/  Gemini AI care Q&A endpoint
    api/circles/[circleId]/medications/ai-guide/  Per-medication Gemini guide
    api/circles/[circleId]/vitals/  Daily vitals (BP, sugar, hydration, walk)
    api/cron/reminders/         Cloud Scheduler dispatch endpoint
    api/demo/seed/              Fictional evaluation scenario seeder
    dashboard/                  Dashboard page (server component with auth guard)
  components/
    circle/
      ai-assistant-view.tsx     Gemini AI interactive Q&A tab
      dashboard-view.tsx        YouTube-style sidebar dashboard shell
      today-view.tsx            Today schedule with Senior Mode & voice assistant
      medications-view.tsx      Medication CRUD with AI guide triggers
      medication-ai-dialog.tsx  Gemini AI medication guide modal
      appointments-view.tsx     Doctor visits with Calendar/Maps integration
      doctor-summary-dialog.tsx Printable visit summary sheet
      adherence-view.tsx        Adherence history & statistics
      members-view.tsx          Circle members & invitation management
      settings-view.tsx         Timezone & circle preferences
      onboarding-view.tsx       Circle creation / join wizard
    auth/                       Sign-in, sign-up, sign-out components
    ui/                         shadcn/ui accessible primitives
  lib/
    gemini-ai.ts                Gemini API integration + clinical knowledgebase fallback
    circle-service.ts           Circle creation, invites, hashed passcodes, membership
    medication-service.ts       Dose scheduling, confirmations, snooze, adherence
    appointment-service.ts      Medical visit scheduling & updates
    alert-service.ts            Atomic follow-up claiming & resolution
    reminder-service.ts         Idempotent job queue & atomic worker claims
    vitals-service.ts           Daily routine & vitals tracking
    calendar.ts                 Google Calendar URL, Maps URL, iCalendar generation
    email/                      Email provider interface, Resend adapter, test transport
    timezone.ts                 IANA timezone conversions, DST handling, grace periods
    permissions.ts              Server-side role & membership authorization
    demo-data.ts                Fictional evaluation dataset generator
    models.ts                   TypeScript interfaces for all domain entities
    db.ts, db-indexes.ts        MongoDB connection pool & index management
tests/                          9 test suites, 51 integration & unit tests
Dockerfile                      Multi-stage standalone production build
```

---

## Future Enhancements

Here are high-impact features that would take Care Circle further toward a production-ready product:

### Near-Term (High Impact)

1. **Push Notifications (FCM)**: Replace email-only reminders with Firebase Cloud Messaging for instant mobile push notifications when doses are due or missed.
2. **Multi-Language Support (i18n)**: Bengali, Hindi, and Spanish localization for the UI, Gemini AI responses, and voice readouts — critical for serving diverse elder communities.
3. **Photo Pill Identifier**: Use Gemini Vision API to let a caregiver photograph a pill and verify it matches the prescribed medication before administering.
4. **Medication Interaction Checker**: Use Gemini to cross-check all medications in a circle for known drug-drug interactions and flag potential conflicts.
5. **PDF Health Reports**: Generate downloadable monthly adherence reports and vitals trend charts (blood pressure over time, medication compliance rates) for doctor appointments.

### Medium-Term (Product Growth)

6. **Progressive Web App (PWA)**: Add a service worker and manifest for offline access, home screen installation, and background sync on mobile devices.
7. **Real-Time Updates (WebSocket/SSE)**: Live dashboard updates when another circle member confirms a dose or claims an alert — no page refresh needed.
8. **Caregiver Shift Scheduling**: Assign primary caregiver responsibility windows (morning shift, night shift) so alerts route to the right person at the right time.
9. **Pharmacy Refill Reminders**: Track medication supply counts and alert when a prescription is running low (e.g. "5 doses remaining — time to refill").
10. **Telehealth Video Integration**: In-app video call button connecting the elder directly to their doctor using Google Meet API.

### Long-Term (Scale & Compliance)

11. **HIPAA/GDPR Compliance Audit**: Encryption at rest, audit logging, data retention policies, and right-to-deletion workflows for regulated healthcare environments.
12. **Wearable Device Integration**: Sync blood pressure, heart rate, and step counts from Google Fit, Apple Health, or Fitbit APIs into the daily vitals tracker.
13. **Professional Caregiver Marketplace**: Connect families with verified professional caregivers who can be invited into circles with time-bounded access.
14. **AI-Powered Anomaly Detection**: Use Gemini to analyze vitals trends and flag unusual patterns (e.g. blood pressure trending upward over 2 weeks) for early physician consultation.
15. **Multi-Circle Dashboard**: A unified "My Day" view for professional caregivers managing multiple elders across different care circles.

---

## License

Built for the PromptWars x Catalyst hackathon. All rights reserved.
