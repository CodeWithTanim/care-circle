# Care Circle

## Purpose

Build an accessible elderly care and medication management app for the PromptWars x Catalyst hackathon. The person receiving care stays in control of their information and who helps them.

The challenge and judging criteria are in `assets/`. Preserve those source files. Keep the application in this repository root; do not create a nested project directory.

## Stack and commands

- Next.js App Router, React, strict TypeScript, npm with `package-lock.json`.
- Tailwind CSS v4 and shadcn/ui with Radix primitives and Lucide icons.
- Better Auth for individual accounts and sessions; the native MongoDB driver and Better Auth MongoDB adapter for persistence.
- Zod for input and environment validation. Vitest and a disposable MongoDB server for auth integration tests.
- Use Node.js 24 LTS for development and deployment.
- `npm run dev`: development server.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`: validation.
- `npm run check`: all four checks. `npm run format`: format source and docs.

## Current foundation

Implemented: landing page, email/password sign-up and sign-in, sign-out, server-validated dashboard access, pooled MongoDB connection, database-backed auth rate limiting, shadcn components, health endpoint, and a standalone Docker build.

The dashboard is an empty starting point. Care circles, invite passcodes, medicine CRUD, adherence records, appointments, email delivery, and reminder scheduling are not implemented yet. Do not represent planned features as working features.

## Planned product

The implementation handoff for Google Antigravity is in `antigravity/README.md`. Read its brief, task checklist, acceptance checks, and progress log before starting feature work.

- Create or join a care circle through secure, expiring invitations/passcodes.
- Give each person an individual account. A circle passcode is an invitation, never a replacement for authentication.
- Authorize elder, caregiver, and family access per circle and action, respecting the elder's choices.
- Build a simple Today view with medication confirmations and upcoming appointments.
- Support medication schedules, adherence history, and appointments.
- Send email reminders for upcoming doses, missed doses, and appointments.
- Let a caregiver acknowledge an alert with "I'll handle this" so the family can see who is following up.

## Structure and implementation rules

- `src/app`: pages, layouts, and route handlers. Keep pages as Server Components unless browser interaction requires otherwise.
- `src/components/ui`: shadcn primitives. Add components through the CLI using the existing `components.json`.
- `src/components/auth`: interactive account forms.
- `src/lib`: shared helpers. `auth.ts`, `db.ts`, `env.ts`, and `session.ts` are server-only. `auth-client.ts` is the browser entry point.
- Use `@/` imports. Keep strict types; avoid `any` and unnecessary dependencies.
- Read relevant installed Next.js documentation in `node_modules/next/dist/docs/` when changing framework behavior.
- Call `getAuth()` and `getDb()` at runtime. Builds must work without production credentials or a running database.
- Reuse the MongoDB client pool; do not create or close a connection per request.
- The adapter currently supports standalone MongoDB without transactions. When switching to replica sets, consider passing the MongoClient to enable transactions and verify multi-document operations.
- Better Auth owns its auth collections and password hashing. Do not implement custom password or session storage.

## Security and care data

- The user maintains configuration in the root `.env`. Preserve it; do not overwrite it or recreate removed environment templates. Never commit or print environment values, secrets, connection strings, real patient data, or identifiable medical information. Document variable names in README.md.
- Validate inputs on the server. Client validation is only a usability aid.
- Validate sessions in every protected server entry point. Circle membership and permissions must also be checked in every future data query or mutation; page protection alone is insufficient.
- Hash invitation passcodes, expire them, rate-limit attempts, and avoid exposing them in logs or URLs.
- Never log passwords, tokens, medication details, or private care records.
- Store timestamps in UTC and preserve the care recipient's IANA time zone for schedules. Make reminders idempotent to avoid duplicate emails.
- Use a scheduler/worker for reminders; do not rely on in-process timers in Cloud Run.
- Add server-side email verification and password recovery before a public production launch. They are not configured in this starter.
- Do not generate medical advice, change prescribed doses automatically, or invent adherence records.

## Accessibility and UI

- Use clear language, readable text, labelled inputs, visible focus indicators, and touch targets of at least 44px on primary user controls.
- Support keyboard navigation and announce form errors. Use semantic headings and describe icon-only controls.
- Use shared theme tokens rather than scattered colors. The starter uses a light green theme; do not add a theme switch until it works throughout the app.
- Show honest empty, loading, success, and failure states. Never disguise example data as real records.

## Validation and delivery

- Run checks appropriate to changes and fix failures before reporting completion. Prefer tests that exercise authentication, authorization, scheduling, and persistence behavior over tests that repeat implementation details.
- Auth tests launch an isolated MongoDB server and may download MongoDB binaries on first run. They must never use the developer's database.
- Preserve the public-repository requirement, a working Cloud Run deployment, and a short submission description. Do not publish or deploy merely because deployment files exist.
- The event allows two scored submissions; the last submission counts. Treat submission as a separate user action.
- State what was tested and any unverified integrations plainly.

## Writing

Write naturally and concisely. Use simple words and specific facts. Avoid generic introductions, unnecessary conclusions, promotional language, canned contrasts, repetitive explanations, excessive headings, and decorative emphasis. Do not invent details or sources.
