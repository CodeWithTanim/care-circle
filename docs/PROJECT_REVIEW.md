# Project review

Reviewed on 15 November 2026 against the current local source. This was a source and automated-check review, not a full browser accessibility audit or production penetration test. Application code was not changed as part of this documentation update.

## Verified checks

| Check                     | Result                                                                   |
| ------------------------- | ------------------------------------------------------------------------ |
| `npm run lint`            | Passed                                                                   |
| `npm run typecheck`       | Passed                                                                   |
| `npm test`                | Passed: 9 suites, 51 tests                                               |
| `npm run build`           | Passed                                                                   |
| `npm run format:check`    | Failed: existing formatting issue in `tests/vitals-and-calendar.test.ts` |
| Published Vercel homepage | HTTP 200; signed-in production flows not exercised                       |

The service journey test exercises application services against an isolated MongoDB server. It is not a browser end-to-end test. The Gemini tests exercise fallback behavior; they do not prove successful calls to the live Gemini endpoint. Live email delivery, Docker execution, Cloud Run deployment, and Cloud Scheduler execution were not verified in this review.

## Findings to address before production

### High: cron authentication fails open when configuration is missing

In `src/app/api/cron/reminders/route.ts`, authorization is checked only inside `if (cronSecret)`. If `CRON_SECRET` is unset or empty, unauthenticated requests can generate and dispatch reminder jobs. Reject execution when the secret is missing, enforce authentication in all environments, and add a missing-secret regression test. The current test covers only the configured-secret case.

### High: reminder scheduling depends on pre-existing dose records

The cron route calls `generateReminderJobsForCircle` and `processDueReminderJobs`. Neither creates the required daily dose occurrences nor advances scheduled doses to `unconfirmed_missed`. Those operations currently live in `src/lib/medication-service.ts`, including Today-view processing. A scheduled run without dashboard visits can therefore miss future-day doses or missed-dose alerts. Make occurrence creation and overdue transitions part of the scheduled pipeline and test multiple days with no UI activity.

### High: pending emails do not recheck current sharing permissions

`src/lib/reminder-service.ts` snapshots recipient details when jobs are created. The worker checks the circle and dose/appointment, but not whether the recipient is still a member or has since opted out. Recheck membership and notification preferences immediately before dispatch, and cancel obsolete jobs. Add a test for member removal and opt-out after job creation.

### High: clinical verification and safety claims exceed the evidence

`src/lib/gemini-ai.ts` labels its static fallback as a "Verified Clinical Knowledgebase", but the repository does not document clinical sources or a clinical review process. It includes generalized missed-dose timing, hydration targets, and medication timing instructions. Do not describe these as clinically verified or universally safe. Obtain an appropriate review, replace unsupported recommendations with prescription-specific guidance from a qualified source, and validate model outputs against a strict schema. The prompts and disclaimers alone do not establish clinical safety.

### Medium: invite brute-force lockout is not implemented

`src/lib/circle-service.ts` initializes `failedAttempts` but does not increment or enforce it. Invalid passcodes return an error without per-user/IP attempt accounting, and `src/app/api/circles/join/route.ts` adds no join-specific limiter. Better Auth login limits do not cover this custom endpoint. Add persistent attempt limiting and tests before claiming a five-attempt lockout.

### Medium: worker claims have no crash recovery or retry delay

The worker atomically changes `pending` jobs to `processing`, but has no lease expiry/reclaim path. A crashed worker can leave jobs stuck indefinitely. Failed jobs are immediately eligible again in the same loop; retries are bounded but do not use backoff. Implement claim expiry, ownership checks, delayed retries, and a per-run processing bound. Test a worker crash and provider failure followed by recovery.

### Medium: schedule changes can leave stale reminders

Medication edits do not reconcile all existing occurrences, and reminder jobs use `$setOnInsert` with stable reference keys. Appointment edits can therefore leave an old reminder time; archived or edited medication schedules need consistent reconciliation too. Test rescheduling after a reminder is queued, including snoozed occurrences, before claiming schedule-change cancellation is complete.

### Medium: missing email credentials silently select memory transport

`src/lib/email/provider.ts` defaults to the in-memory provider regardless of environment. The reminder worker marks these jobs `sent`. Without `RESEND_API_KEY`, production can report successful dispatch without sending an email. Fail closed in production or explicitly expose delivery mode and distinguish test delivery from external delivery in persistent status.

### Documentation and presentation

- `src/app/page.tsx` contains fixed impact figures such as "120k+", "94%", and "25k+", plus testimonial content. No supporting dataset or attribution was established in this review. Remove them or clearly mark them as illustrative before presenting them as product traction.
- Google Calendar uses a prefilled event template URL; it does not implement account-connected calendar synchronization. Google Maps uses a location search URL, not a directions API integration.
- The demo seeder currently creates two medications, not the three previously listed in README.
- Email verification and recovery callbacks exist in Better Auth configuration. The account UI does not provide a complete recovery/verification journey, and verification is not configured as a sign-in requirement.
- AI requests can transmit recipient names, medication details, and user questions to Google. Explain this behavior before users submit real care information.
- The original event deck specifies a working Cloud Run deployment for Top 10 eligibility. A Vercel URL and Dockerfile do not establish that requirement has been met.
- `AGENT.MD` still describes the dashboard as empty and features as unimplemented. Its baseline status should be refreshed in the next implementation handoff; this review did not rewrite coding instructions.

## README changes

The revised README keeps the implemented feature catalog, evaluator walkthrough, stack, local configuration, and deployment preparation. It distinguishes source-level integrations from verified delivery/deployment, removes unsupported clinical certification and availability guarantees, corrects the demo contents, and points to this review for remaining work.
