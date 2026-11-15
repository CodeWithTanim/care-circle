# Care Circle — Evaluation Readiness & Verification Audit

**Audit Date:** 15 November 2026  
**Repository Branch:** `main`  
**Working Directory:** Local Project Root  
**Verification Commands:** `npm run check` (Lint, Typecheck, 74 Tests across 9 Suites, Turbopack Build) & `npm run format:check` (Prettier)

---

## 1. Executive Summary

This document provides a factual, evidence-backed evaluation readiness report for **Care Circle**. It records the current implementation state, verified test outcomes, architecture choices, and remaining external operational prerequisites.

In accordance with competition rules and instructions:

- **No invented platform scores:** We do not predict or assign arbitrary evaluation points.
- **Truthful integration boundaries:** Features that rely on third-party live keys (`RESEND_API_KEY`, `GEMINI_API_KEY`) or cloud hosting (`Cloud Run`, `Cloud Scheduler`) are documented with their exact code paths, test transports, mocked tests, and concrete setup guides without falsely claiming that unexecuted live calls have succeeded.
- **Preserved secrets:** The root `.env` remains private, untouched, and uncommitted.

---

## 2. Seven Scoring Criteria Evidence Table

| Evaluation Criterion                    | Implementation Files                                                                                                                                                                                                                                                                                                       | Automated & Static Tests                                                                                                   | Verified Local Results                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Remaining Operational Limitations                                                                       |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------ |
| **1. Code Quality**                     | `src/lib/*.ts`, `src/app/**`, `next.config.ts`, `tsconfig.json`                                                                                                                                                                                                                                                            | `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`                                               | • Strict TypeScript (`strict: true`, zero `any` bypasses)<br>• Zero ESLint warnings/errors<br>• 100% Prettier compliant<br>• Next.js 16.4.6 Turbopack production build compiles in ~2s with static page generation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | None. Fully verified locally.                                                                           |
| **2. Security & Privacy**               | `src/app/api/cron/reminders/route.ts`, `src/lib/permissions.ts`, `src/lib/circle-service.ts`, `src/lib/reminder-service.ts`, `src/app/api/circles/[circleId]/vitals/route.ts`, `src/app/api/circles/[circleId]/ai/ask/route.ts`, `src/app/api/circles/[circleId]/medications/ai-guide/route.ts`, `src/lib/rate-limiter.ts` | `tests/scheduling-and-delivery.test.ts`, `tests/circle-service.test.ts`, `tests/permissions.test.ts`, `tests/auth.test.ts` | • **Fail-closed Cron:** Rejecting with HTTP 500 when `CRON_SECRET` is unset/empty before any DB/email execution; HTTP 401 on invalid token.<br>• **Atomic AI & Join Limiters:** Database-level atomic reservations prevent race conditions across parallel calls.<br>• **Dispatch Auth:** Live re-check of membership, consent, and notification preferences at send time.<br>• **Vitals RBAC:** `canRecordVitals` blocks read-only family observers with HTTP 403.<br>• **Worker Fencing:** Unique `claimToken` per acquisition prevents stale workers from corrupting re-leased jobs.<br>• **Password Hashing:** Argon2id / scrypt via Better Auth.<br>• **Data Minimization:** AI prompts strip elder names and non-essential PII. | Live external production keys must be provisioned in the hosting environment.                           |
| **3. Efficiency & Resource Bound**      | `src/lib/db.ts`, `src/lib/db-indexes.ts`, `src/lib/reminder-service.ts`, `src/app/api/cron/reminders/route.ts`                                                                                                                                                                                                             | `tests/scheduling-and-delivery.test.ts`, `tests/care-services.test.ts`                                                     | • Global cached MongoDB connection pool.<br>• Compound indexes on `(circleId, scheduledTimestamp)` & `(status, scheduledTimestamp)`.<br>• MongoDB TTL indexes for passcodes, rate limits, and sessions.<br>• Bounded cursor batching: cron scans circles with a 15-second time budget so worker dispatch is never starved.<br>• Worker bounds: max 50 jobs per run, 25-second execution timeout.<br>• Stalled worker lease recovery (5 min) with unique `claimToken` fencing.<br>• Exhausted retry recovery: crashed final-attempt jobs transition cleanly to `failed`.<br>• Exponential retry backoff (5m / 10m / 20m).                                                                                                              | None. Query plans and timeouts verified in test suite.                                                  |
| **4. Testing & Reliability**            | `tests/*.test.ts` (9 test suites, 74 tests)                                                                                                                                                                                                                                                                                | `vitest run`                                                                                                               | • **74 of 74 tests pass** in ~4 seconds.<br>• Real DST transition tests (Spring 2026-03-08, Autumn 2026-11-01, spring non-existent times).<br>• Multi-day background scheduler runs without page visits.<br>• Rescheduled appointments generate fresh replacement reminders.<br>• Stale worker re-lease protection with unique claim tokens.<br>• Dispatch cancellation for removed/opted-out members.<br>• Timezone change timestamp reconciliation.<br>• Full end-to-end acceptance journey.                                                                                                                                                                                                                                        | Live network tests with external Resend SMTP/API require user-supplied API key.                         |
| **5. Accessibility & Senior Usability** | `src/components/circle/today-view.tsx`, `src/components/home/home-navbar.tsx`, `src/app/layout.tsx`, `src/app/sign-in/page.tsx`                                                                                                                                                                                            | Automated DOM inspection and subagent accessibility audit                                                                  | • **44px Touch Targets:** Primary controls, hydration +/- steppers, navbar toggles, and hero CTAs meet `min-h-[44px] min-w-[44px]`.<br>• **Senior Mode:** High-contrast palette (>7.5:1), enlarged text, distinct borders.<br>• **Keyboard & Assistive Tech:** Skip-to-content link, unbroken `h1`→`h2`→`h3` hierarchy, `role="alert"` error announcements, `aria-expanded`, `aria-controls`, and Escape key dismissal on mobile nav.<br>• **Reduced Motion:** Marquee ticker animation safely pauses on `prefers-reduced-motion`.                                                                                                                                                                                                    | Chrome DevTools remote protocol requires Chrome launch with debugging flags for live Lighthouse audits. |
| **6. Problem Alignment**                | `src/lib/medication-service.ts`, `src/lib/alert-service.ts`, `src/lib/appointment-service.ts`, `src/lib/vitals-service.ts`                                                                                                                                                                                                 | `tests/journey.test.ts`, `tests/care-services.test.ts`                                                                     | • **Proactive Background Engine:** Generates doses across a rolling window and advances overdue states automatically without dashboard visits.<br>• **Dignity & Autonomy:** Elder controls sharing consent; elder can confirm their own doses.<br>• **"I'll Handle This":** Caregiver alert acknowledgement prevents panic without falsifying clinical confirmation.<br>• **Doctor Summary:** Printable report for consultations.                                                                                                                                                                                                                                                                                                     | Continuous cron triggering in production requires Google Cloud Scheduler.                               |
| **7. Google Services Usage**            | `src/lib/gemini-ai.ts`, `src/app/api/circles/[circleId]/ai/ask/route.ts`, `src/app/api/circles/[circleId]/medications/ai-guide/route.ts`, `src/lib/vitals-service.ts`, `Dockerfile`                                                                                                                                        | `tests/gemini-ai.test.ts`, `tests/vitals-and-calendar.test.ts`                                                             | • **Gemini 2.5 Flash:** AI Care Assistant with strict input/output bounds (500 chars), per-user rate limits, request timeouts (10s), Zod schema envelope validation, and safe local fallback.<br>• **Safe Coordination Fallback:** Missed-dose guidance defers to prescription labels and clinicians without universal take/skip time windows.<br>• **Google Calendar:** Contextual URL generator for clinical appointments with recurrence and alert offsets.<br>• **Google Maps:** Structured query links for clinic and pharmacy directions.<br>• **Google Cloud Run:** Multi-stage production container running non-root on `PORT=8080`.                                                                                          | Live Gemini API calls require valid `GEMINI_API_KEY`; Cloud Run requires `gcloud run deploy`.           |

---

## 3. Comprehensive Fixes Log

### Security & Reliability (P0 & Follow-ups)

1. **Fail-Closed Cron Authentication:**
   In `src/app/api/cron/reminders/route.ts`, requests immediately halt with HTTP 500 when `CRON_SECRET` is unset/empty before any DB/email work, or HTTP 401 on missing/bad bearer tokens.
2. **Scheduler-Only Dose Generation:**
   `syncCircleDosesAndOverdue(circleId, now)` generates doses across a rolling 4-day window (`[-2, -1, 0, 1]` days) and marks overdue doses as `unconfirmed_missed` with care alerts, completely independent of page visits.
3. **Dispatch-Time Authorization Re-check:**
   Before dispatching any reminder email, the dispatcher queries the database to confirm the recipient is still an active circle member, circle sharing consent is active, and the recipient has not opted out. Jobs failing checks transition to `cancelled`.
4. **Truthful Production Email Status:**
   `UnconfiguredProductionEmailProvider` throws a hard configuration exception in production if `RESEND_API_KEY` is missing, marking jobs as `failed` with descriptive errors rather than silently claiming success.
5. **Atomic Rate Limiting on Join & AI Routes:**
   Implemented database-level atomic quota reservation (`reserveAtomicQuota` in `src/lib/rate-limiter.ts`) across `/api/circles/join`, `/api/circles/[circleId]/ai/ask`, and `/api/circles/[circleId]/medications/ai-guide`, preventing concurrency bypasses.
6. **Appointment Rescheduling Replacement Reminders:**
   In `src/lib/appointment-service.ts` and `src/lib/reminder-service.ts`, appointments maintain a `revision` sequence. Idempotency keys use `appointment:${appt._id}:r${revision}:${email}`. Rescheduling cancels obsolete jobs and generates fresh pending reminders for the replacement visit.
7. **Exhausted Stale Worker Claim Recovery:**
   Jobs abandoned in `processing` whose attempts have reached `maxAttempts` transition cleanly to `failed` with descriptive error notes rather than remaining stuck indefinitely.
8. **Unique Claim Token Fencing:**
   Each worker run acquires jobs with a unique `claimToken = ${workerId}-${randomUUID()}`. Status updates (sent, failed, cancelled) check `claimToken`, ensuring a stale worker whose lease expired cannot mutate a job re-claimed by another worker.
9. **DST Transition Iterative Offset Convergence:**
   `localToUtc` in `src/lib/timezone.ts` uses fixed-point iterative convergence with `Intl.DateTimeFormat`, accurately resolving New York Spring (`2026-03-08 03:30 -> 07:30Z`), Autumn (`2026-11-01 02:30 -> 07:30Z`), and Spring non-existent gap times.
10. **Timezone Change Timestamp Reconciliation:**
    When a circle's timezone is updated in `updateCircle`, future scheduled dose occurrences and appointments have their UTC timestamps recalculated automatically.
11. **Safe AI Fallback Advice:**
    Missed-dose fallback in `src/lib/gemini-ai.ts` removes universal 1-2 hour take/skip time windows and blanket fluid targets, replacing them with coordination-only text directing users to prescription packaging and healthcare providers.
12. **44px Minimum Touch Targets & Mobile Nav:**
    Hydration +/- controls, mobile navbar toggles, and CTA buttons meet the 44px minimum sizing (`min-h-[44px] min-w-[44px]`). Mobile navbar includes `aria-expanded`, `aria-controls`, and `Escape` key dismissal.

---

## 4. Test Suite Execution Summary

Running `npm run check`:

```text
> care-circle@0.1.0 check
> npm run lint && npm run typecheck && npm test && npm run build

> care-circle@0.1.0 lint
> eslint (0 errors, 0 warnings)

> care-circle@0.1.0 typecheck
> next typegen && tsc --noEmit (0 errors)

> care-circle@0.1.0 test
> vitest run

 ✓ tests/gemini-ai.test.ts (10 tests)
 ✓ tests/vitals-and-calendar.test.ts (4 tests)
 ✓ tests/permissions.test.ts (7 tests)
 ✓ tests/demo.test.ts (1 test)
 ✓ tests/circle-service.test.ts (8 tests)
 ✓ tests/journey.test.ts (8 tests)
 ✓ tests/care-services.test.ts (15 tests)
 ✓ tests/scheduling-and-delivery.test.ts (16 tests)
 ✓ tests/auth.test.ts (5 tests)

 Test Files  9 passed (9)
      Tests  74 passed (74)
   Duration  3.67s

> care-circle@0.1.0 build
> next build
▲ Next.js 16.4.6 (Turbopack)
✓ Compiled successfully in 1.9s
✓ Generating static pages (14/14)
```

Running `npm run format:check`:

```text
> care-circle@0.1.0 format:check
> prettier --check .
All matched files use Prettier code style!
```

---

## 5. Google Cloud Run and Cloud Scheduler Deployment Guide

Care Circle is fully containerized with Next.js standalone output and ready for Cloud Run.

### 5.1 Cloud Run Deployment Commands

```bash
# 1. Set Google Cloud project and region
gcloud config set project [YOUR_PROJECT_ID]
gcloud config set run/region us-central1

# 2. Build and submit container via Cloud Build
gcloud builds submit --tag gcr.io/[YOUR_PROJECT_ID]/care-circle:latest .

# 3. Deploy container to Cloud Run
gcloud run deploy care-circle \
  --image gcr.io/[YOUR_PROJECT_ID]/care-circle:latest \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 10 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars "NODE_ENV=production,BETTER_AUTH_URL=https://[YOUR_RUN_URL],MONGODB_DB=care_circle" \
  --set-secrets "MONGODB_URI=care-circle-mongo-uri:latest,BETTER_AUTH_SECRET=care-circle-auth-secret:latest,CRON_SECRET=care-circle-cron-secret:latest,RESEND_API_KEY=care-circle-resend-key:latest,GEMINI_API_KEY=care-circle-gemini-key:latest"
```

### 5.2 Cloud Scheduler Configuration

```bash
gcloud scheduler jobs create http care-circle-reminder-cron \
  --schedule="*/15 * * * *" \
  --uri="https://[YOUR_RUN_URL]/api/cron/reminders" \
  --http-method=POST \
  --headers="Authorization=Bearer [YOUR_CRON_SECRET]" \
  --time-zone="UTC" \
  --attempt-deadline=30s
```

---

## 6. External Email Verification (Resend)

To enable live email dispatch in production:

1. Create a verified sending domain at [Resend](https://resend.com) (e.g. `notifications.yourdomain.com`).
2. Add SPF, DKIM, and DMARC DNS records to your DNS registrar.
3. Generate a Resend API Key with Sending permissions.
4. Set environment variables:
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
   EMAIL_FROM="Care Circle <reminders@yourdomain.com>"
   ```

---

## 7. Honest Remaining Limitations & Boundaries

1. **Docker CLI on Local Host:** The Docker CLI is not installed on this local Windows host (`CommandNotFoundException`). Container image builds must be executed in an environment with Docker installed or via Google Cloud Build (`gcloud builds submit`).
2. **Live External Services:**
   - **Resend:** Unit and regression tests utilize the fully functional `testEmailTransport`. Real email delivery requires a valid `RESEND_API_KEY` and verified DNS domain.
   - **Gemini API:** Unit tests exercise both mocked HTTP responses (success, error, rate-limit, timeout) and the local reference guideline fallback. Live calls require a provisioned `GEMINI_API_KEY`.
3. **No Deployments or Platform Submissions Made:** As instructed, no code has been submitted to the platform or deployed to external clouds in this turn.
