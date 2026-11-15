# Care Circle

An accessible elderly care and medication management platform designed for the PromptWars x Catalyst hackathon. The person receiving care remains at the center of their healthcare decisions, coordinating daily medications, appointments, and care routines with family and caregivers through secure passcode-based access.

## Local setup

Use Node.js 24 LTS and npm. Run commands from this repository root.

```powershell
npm install
```

Configuration lives in the root `.env` file, which Next.js loads automatically. Keep your existing values and never commit credentials.

Start MongoDB locally or supply a MongoDB Atlas URI in `MONGODB_URI`:

```powershell
docker compose up -d mongodb
npm run dev
```

Open http://localhost:3000. Create an account at `/sign-up`, then visit `/dashboard`.

| Variable             | Purpose                                                                   | Required / Default |
| -------------------- | ------------------------------------------------------------------------- | ------------------ |
| `MONGODB_URI`        | MongoDB connection URI                                                    | Required           |
| `MONGODB_DB`         | Database name                                                             | `care_circle`      |
| `BETTER_AUTH_SECRET` | Cryptographic auth secret (min 32 chars)                                  | Required           |
| `BETTER_AUTH_URL`    | App origin (`http://localhost:3000` or production HTTPS URL)              | Required           |
| `CRON_SECRET`        | Bearer token for Cloud Scheduler reminder dispatch endpoint               | Optional / Dev     |
| `RESEND_API_KEY`     | Resend API key for external email delivery (uses test transport if unset) | Optional           |
| `EMAIL_FROM`         | Verified sender address for notifications                                 | Optional           |

Builds do not require secrets or database access. Runtime configuration is validated when accessed.

## Key features

- **Elder-Centered Care Circles**: Create care circles with explicit sharing consent and IANA time zone support. Elder ownership can be transferred to trusted family or caregivers.
- **Secure Invitation Passcodes**: Cryptographically random, human-readable passcodes (`CARE-XXXX-XXXX`). Codes are hashed with SHA-256 before storage, enforce expiry and maximum uses, and assign explicit roles (`caregiver` or `family`).
- **Granular Permissions & Barriers**:
  - `owner`: Manage circle settings, invites, member roles, ownership transfer, full medication & appointment management.
  - `caregiver`: Manage medications, confirm taken/snoozed doses, schedule appointments, claim and resolve alerts.
  - `family`: Read-only schedule visibility, adherence history, and active participation in follow-up alerts ("I'll handle this").
  - Unauthorized and cross-circle access are rejected at the server.
- **Accessible Today Schedule**:
  - High-contrast, large text and large touch targets (minimum 44px) designed for elderly users and touchscreen devices.
  - Big "Mark Taken" button with actor and timestamp recording.
  - Bounded snooze ("Remind in 15m") limited to 3 times to prevent indefinite neglect.
- **Honest Adherence Tracking**:
  - Unconfirmed doses past the grace period (60 minutes) are derived as `unconfirmed_missed` (not clinically assumed un-taken).
  - Adherence statistics and filterable timeline (last 7, 14, 30 days).
- **Healthcare Appointments**:
  - Doctor visits, clinic locations, and prep instructions in the care profile's timezone.
- **Proactive Reminders & Cloud Scheduler**:
  - Idempotent delivery jobs with atomic claims preventing duplicate emails.
  - Rechecks medication state before dispatch (cancels reminders if already confirmed taken).
  - Bounded retries (max 3) with observable failure tracking.
  - Protected endpoint `GET/POST /api/cron/reminders` authenticated via `CRON_SECRET`.
- **Caregiver & Family Follow-Up ("I'll handle this")**:
  - Atomic claiming prevents simultaneous members from both becoming responsible.
  - Entire circle sees who is following up.
  - Follow-up resolution records notes without falsifying clinical medication records.
- **Evaluation Demo Scenario**:
  - Quick-load fictional scenario (Eleanor Vance, Lisinopril, unconfirmed dose alert, and cardiology appointment) available via the dashboard or `/api/demo/seed`.

## Validation and tests

```powershell
npm run lint         # ESLint checks
npm run typecheck    # TypeScript strict check
npm test             # Vitest test suite with MongoMemoryServer
npm run build        # Next.js standalone production build
npm run format:check # Prettier code formatting check
npm run check        # All checks in sequence
```

All 7 test suites (42 integration and unit tests) run against an isolated in-memory MongoDB instance and verify permissions, concurrency, timezones, and full user journeys.

## Cloud Run & Google Cloud Deployment

1. **Build Container**:

   ```bash
   docker build -t gcr.io/[PROJECT-ID]/care-circle:latest .
   docker push gcr.io/[PROJECT-ID]/care-circle:latest
   ```

2. **Deploy to Cloud Run**:

   ```bash
   gcloud run deploy care-circle \
     --image gcr.io/[PROJECT-ID]/care-circle:latest \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars BETTER_AUTH_URL=https://[YOUR-SERVICE-URL],MONGODB_DB=care_circle \
     --set-secrets MONGODB_URI=MONGODB_URI:latest,BETTER_AUTH_SECRET=BETTER_AUTH_SECRET:latest,CRON_SECRET=CRON_SECRET:latest
   ```

3. **Cloud Scheduler Dispatch**:
   Configure a Google Cloud Scheduler recurring job (e.g. every 15 minutes `*/15 * * * *`) targeting:
   `https://[YOUR-SERVICE-URL]/api/cron/reminders` with header `Authorization: Bearer [CRON_SECRET]`.

## Project map

```text
src/
  app/                    Next.js App Router pages and API routes
    api/circles/          Care circle CRUD, invites, doses, adherence, appointments, alerts
    api/cron/reminders/   Cloud Scheduler dispatch endpoint
    api/demo/seed/        Fictional evaluation scenario seeder
    dashboard/            Elderly-friendly dashboard page
  components/
    circle/               Dashboard, Today, Medications, Appointments, Members, Onboarding
    auth/                 Account forms and sign-out
    ui/                   Accessible shadcn components
  lib/
    circle-service.ts     Circle creation, invites, hashed passcodes, membership
    medication-service.ts Dose scheduling, confirmations, snooze, adherence
    appointment-service.ts Medical visit scheduling & updates
    alert-service.ts      Atomic follow-up claiming ("I'll handle this") & resolution
    reminder-service.ts   Idempotent job queue & atomic worker claims
    email/                Email provider interface, Resend adapter, safe test transport
    timezone.ts           IANA timezone conversions, DST handling, grace periods
    permissions.ts        Centralized server-side role and membership checks
    db-indexes.ts         MongoDB unique and performance indexes
    demo-data.ts          Fictional evaluation dataset
tests/                    Integration test suites (auth, permissions, care, journey, scheduling)
```
