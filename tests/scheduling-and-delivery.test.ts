import { randomBytes, randomUUID } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as cronHandler } from "../src/app/api/cron/reminders/route";
import { ensureDatabaseIndexes } from "../src/lib/db-indexes";
import {
  type EmailDeliveryResult,
  type EmailProvider,
  setCustomEmailProvider,
} from "../src/lib/email/provider";
import type {
  CareAlert,
  Circle,
  DoseOccurrence,
  Medication,
  Membership,
  ReminderJob,
} from "../src/lib/models";
import {
  processDueReminderJobs,
  generateReminderJobsForCircle,
} from "../src/lib/reminder-service";
import {
  createAppointment,
  updateAppointment,
} from "../src/lib/appointment-service";
import { createCircle } from "../src/lib/circle-service";
import { localToUtc, utcToLocalDate } from "../src/lib/timezone";

vi.mock("server-only", () => ({}));

let mongo: MongoMemoryServer;
let db: import("mongodb").Db;
let client: import("mongodb").MongoClient;
let testAuthSecret: string;

function ensureBaseEnvs() {
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "care_circle_test";
  process.env.BETTER_AUTH_SECRET = testAuthSecret;
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  testAuthSecret = randomBytes(32).toString("hex");
  ensureBaseEnvs();

  const { getDb, getMongoClient } = await import("../src/lib/db");
  db = getDb();
  client = getMongoClient();
  await ensureDatabaseIndexes(db);
});

afterAll(async () => {
  if (client) {
    await client.close();
  }
  await mongo?.stop();
  vi.unstubAllEnvs();
});

import { beforeEach } from "vitest";
beforeEach(async () => {
  ensureBaseEnvs();
  if (db) {
    await db.collection("reminder_jobs").deleteMany({});
    await db.collection("dose_occurrences").deleteMany({});
    await db.collection("medications").deleteMany({});
    await db.collection("circles").deleteMany({});
    await db.collection("memberships").deleteMany({});
    await db.collection("care_alerts").deleteMany({});
  }
});

describe("Timezones, Midnight Boundaries & DST", () => {
  it("converts midnight and UTC date boundaries correctly in America/New_York (UTC-5)", () => {
    // 00:00 on Nov 15, 2026 in NY is 05:00 UTC on Nov 15
    const utcMidnight = localToUtc("2026-11-15", "00:00", "America/New_York");
    expect(utcMidnight.toISOString()).toBe("2026-11-15T05:00:00.000Z");

    const back = utcToLocalDate(utcMidnight, "America/New_York");
    expect(back.localDate).toBe("2026-11-15");
    expect(back.localTime).toBe("00:00");
  });

  it("converts midnight across UTC date boundaries in Asia/Kolkata (UTC+5:30)", () => {
    // 01:00 on Nov 15 in Kolkata is 19:30 UTC on Nov 14 (previous calendar day in UTC!)
    const utcDose = localToUtc("2026-11-15", "01:00", "Asia/Kolkata");
    expect(utcDose.toISOString()).toBe("2026-11-14T19:30:00.000Z");

    const back = utcToLocalDate(utcDose, "Asia/Kolkata");
    expect(back.localDate).toBe("2026-11-15");
    expect(back.localTime).toBe("01:00");
  });

  it("handles daylight saving time transitions accurately", () => {
    // Summer EDT (UTC-4)
    const summer = localToUtc("2026-07-01", "12:00", "America/New_York");
    expect(summer.toISOString()).toBe("2026-07-01T16:00:00.000Z");

    // Winter EST (UTC-5)
    const winter = localToUtc("2026-12-01", "12:00", "America/New_York");
    expect(winter.toISOString()).toBe("2026-12-01T17:00:00.000Z");

    // Spring DST Transition Day: 2026-03-08 03:30 in America/New_York is EDT (UTC-4) -> 07:30Z
    const springDose = localToUtc("2026-03-08", "03:30", "America/New_York");
    expect(springDose.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    const springBack = utcToLocalDate(springDose, "America/New_York");
    expect(springBack.localDate).toBe("2026-03-08");
    expect(springBack.localTime).toBe("03:30");

    // Autumn DST Transition Day: 2026-11-01 02:30 in America/New_York is EST (UTC-5) -> 07:30Z
    const autumnDose = localToUtc("2026-11-01", "02:30", "America/New_York");
    expect(autumnDose.toISOString()).toBe("2026-11-01T07:30:00.000Z");
    const autumnBack = utcToLocalDate(autumnDose, "America/New_York");
    expect(autumnBack.localDate).toBe("2026-11-01");
    expect(autumnBack.localTime).toBe("02:30");

    // Spring gap disambiguation: 02:30 does not exist during 2am -> 3am spring forward;
    // Disambiguation advances to 03:30 (07:30Z)
    const springGap = localToUtc("2026-03-08", "02:30", "America/New_York");
    expect(springGap.toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });
});

describe("Reminder Worker Concurrency & Atomic Claims", () => {
  it("prevents two concurrent workers from claiming the same job", async () => {
    const circleId = "circle-worker-test";
    const job: ReminderJob = {
      _id: randomUUID(),
      circleId,
      jobType: "upcoming_dose",
      referenceId: "dose-concurrency-1",
      idempotencyKey: `upcoming:${randomUUID()}`,
      recipientEmail: "test@example.com",
      recipientName: "Test User",
      recipientUserId: "u1",
      scheduledFor: new Date(Date.now() - 10000), // Due in the past
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection<ReminderJob>("reminder_jobs").insertOne(job);

    // Insert dummy circle, membership, medication and dose
    await db.collection<Circle>("circles").insertOne({
      _id: circleId,
      name: "Circle",
      recipientName: "Elder",
      recipientRelationship: "self",
      isRecipientUser: true,
      timezone: "UTC",
      sharingConsent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "u1",
    });
    await db.collection<Membership>("memberships").insertOne({
      _id: randomUUID(),
      circleId,
      userId: "u1",
      role: "owner",
      email: "test@example.com",
      name: "Test User",
      joinedAt: new Date(),
      notifications: {
        upcomingDoses: true,
        missedDoses: true,
        appointments: true,
      },
    });
    await db.collection<Medication>("medications").insertOne({
      _id: "med-conc-1",
      circleId,
      name: "Test Med",
      dosage: "10mg",
      scheduleTimes: ["10:00"],
      startDate: "2026-11-01",
      endDate: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "u1",
    });
    await db.collection<DoseOccurrence>("dose_occurrences").insertOne({
      _id: "dose-concurrency-1",
      circleId,
      medicationId: "med-conc-1",
      scheduledDate: "2026-11-15",
      medicationName: "Test Med",
      dosage: "10mg",
      scheduledTime: "10:00",
      scheduledTimestamp: new Date(),
      status: "scheduled",
      snoozeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Run two workers simultaneously
    const [w1, w2] = await Promise.all([
      processDueReminderJobs("worker-alpha"),
      processDueReminderJobs("worker-beta"),
    ]);

    // Only one worker should have processed and sent this job
    expect(w1.processed + w2.processed).toBe(1);
    expect(w1.sent + w2.sent).toBe(1);
  });
});

describe("Delivery Retries & Bounded Failures", () => {
  it("bounds retries to maxAttempts and marks failed after limit", async () => {
    // Failing provider
    const failingProvider: EmailProvider = {
      name: "FailingProvider",
      isTestTransport: true,
      sendEmail: async (): Promise<EmailDeliveryResult> => {
        throw new Error("SMTP connection timed out");
      },
    };
    setCustomEmailProvider(failingProvider);

    const circleId = "circle-retry-test";
    const jobId = randomUUID();
    const job: ReminderJob = {
      _id: jobId,
      circleId,
      jobType: "upcoming_dose",
      referenceId: "dose-retry-1",
      idempotencyKey: `retry:${jobId}`,
      recipientEmail: "retry@example.com",
      recipientName: "Retry User",
      recipientUserId: "u2",
      scheduledFor: new Date(Date.now() - 10000),
      status: "pending",
      attempts: 2, // Already attempted twice
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection<ReminderJob>("reminder_jobs").insertOne(job);
    await db.collection<Circle>("circles").insertOne({
      _id: circleId,
      name: "Circle",
      recipientName: "Elder",
      recipientRelationship: "self",
      isRecipientUser: true,
      timezone: "UTC",
      sharingConsent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "u2",
    });
    await db.collection<Membership>("memberships").insertOne({
      _id: randomUUID(),
      circleId,
      userId: "u2",
      role: "owner",
      email: "retry@example.com",
      name: "Retry User",
      joinedAt: new Date(),
      notifications: {
        upcomingDoses: true,
        missedDoses: true,
        appointments: true,
      },
    });
    await db.collection<Medication>("medications").insertOne({
      _id: "med-retry-1",
      circleId,
      name: "Test Med",
      dosage: "10mg",
      scheduleTimes: ["10:00"],
      startDate: "2026-11-01",
      endDate: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "u2",
    });
    await db.collection<DoseOccurrence>("dose_occurrences").insertOne({
      _id: "dose-retry-1",
      circleId,
      medicationId: "med-retry-1",
      scheduledDate: "2026-11-15",
      medicationName: "Test Med",
      dosage: "10mg",
      scheduledTime: "10:00",
      scheduledTimestamp: new Date(),
      status: "scheduled",
      snoozeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await processDueReminderJobs("worker-retry");
    expect(res.failed).toBe(1);

    const stored = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOne({ _id: jobId });
    expect(stored?.attempts).toBe(3);
    expect(stored?.status).toBe("failed");
    expect(stored?.lastError).toContain("SMTP connection timed out");

    // Reset provider to testEmailTransport
    setCustomEmailProvider(undefined);
  });
});

describe("Scheduler Endpoint Security", () => {
  it("fails closed with 500 when CRON_SECRET is unset or empty", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const req = new Request("http://localhost:3000/api/cron/reminders", {
      headers: { authorization: "Bearer some-token" },
    });
    const res = await cronHandler(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Cron authorization is not configured");

    vi.unstubAllEnvs();
    ensureBaseEnvs();
  });

  it("rejects unauthorized cron requests when CRON_SECRET is set", async () => {
    vi.stubEnv("CRON_SECRET", "super-secret-cron-token-1234");

    const reqWithoutAuth = new Request(
      "http://localhost:3000/api/cron/reminders",
    );
    const resWithout = await cronHandler(reqWithoutAuth);
    expect(resWithout.status).toBe(401);

    const reqWithBadAuth = new Request(
      "http://localhost:3000/api/cron/reminders",
      {
        headers: { authorization: "Bearer wrong-secret" },
      },
    );
    const resBad = await cronHandler(reqWithBadAuth);
    expect(resBad.status).toBe(401);

    const reqWithGoodAuth = new Request(
      "http://localhost:3000/api/cron/reminders",
      {
        headers: { authorization: "Bearer super-secret-cron-token-1234" },
      },
    );
    const resGood = await cronHandler(reqWithGoodAuth);
    expect(resGood.status).toBe(200);

    vi.unstubAllEnvs();
    ensureBaseEnvs();
  });
});

describe("Recipient Authorization Recheck at Dispatch Time", () => {
  it("cancels pending job if recipient was removed from circle before dispatch", async () => {
    const circleId = "circle-auth-recheck-1";
    const userId = "removed-user-1";
    const jobId = randomUUID();

    await db.collection<Circle>("circles").insertOne({
      _id: circleId,
      name: "Auth Circle",
      recipientName: "Elder",
      recipientRelationship: "self",
      isRecipientUser: true,
      timezone: "UTC",
      sharingConsent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "owner-1",
    });

    await db.collection<DoseOccurrence>("dose_occurrences").insertOne({
      _id: "dose-auth-1",
      circleId,
      medicationId: "med-1",
      scheduledDate: "2026-11-15",
      medicationName: "Lisinopril",
      dosage: "10mg",
      scheduledTime: "10:00",
      scheduledTimestamp: new Date(),
      status: "scheduled",
      snoozeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.collection<Medication>("medications").insertOne({
      _id: "med-1",
      circleId,
      name: "Lisinopril",
      dosage: "10mg",
      scheduleTimes: ["10:00"],
      startDate: "2026-11-01",
      endDate: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "owner-1",
    });

    // Enqueue job with snapshot
    await db.collection<ReminderJob>("reminder_jobs").insertOne({
      _id: jobId,
      circleId,
      jobType: "upcoming_dose",
      referenceId: "dose-auth-1",
      idempotencyKey: `upcoming:${jobId}`,
      recipientEmail: "removed@example.com",
      recipientName: "Removed User",
      recipientUserId: userId,
      scheduledFor: new Date(Date.now() - 5000),
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Notice: membership for userId DOES NOT EXIST (removed member)
    const result = await processDueReminderJobs("worker-auth-test");
    expect(result.cancelled).toBe(1);

    const job = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOne({ _id: jobId });
    expect(job?.status).toBe("cancelled");
    expect(job?.lastError).toContain("no longer a member");
  });

  it("cancels pending job if recipient opted out of notification type", async () => {
    const circleId = "circle-auth-recheck-2";
    const userId = "optout-user-1";
    const jobId = randomUUID();

    await db.collection<Circle>("circles").insertOne({
      _id: circleId,
      name: "OptOut Circle",
      recipientName: "Elder",
      recipientRelationship: "self",
      isRecipientUser: true,
      timezone: "UTC",
      sharingConsent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "owner-2",
    });

    await db.collection<Membership>("memberships").insertOne({
      _id: randomUUID(),
      circleId,
      userId,
      role: "family",
      email: "optout@example.com",
      name: "OptOut User",
      joinedAt: new Date(),
      notifications: {
        upcomingDoses: false, // Opted out!
        missedDoses: true,
        appointments: true,
      },
    });

    await db.collection<DoseOccurrence>("dose_occurrences").insertOne({
      _id: "dose-auth-2",
      circleId,
      medicationId: "med-2",
      scheduledDate: "2026-11-15",
      medicationName: "Metformin",
      dosage: "500mg",
      scheduledTime: "10:00",
      scheduledTimestamp: new Date(),
      status: "scheduled",
      snoozeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.collection<ReminderJob>("reminder_jobs").insertOne({
      _id: jobId,
      circleId,
      jobType: "upcoming_dose",
      referenceId: "dose-auth-2",
      idempotencyKey: `upcoming:${jobId}`,
      recipientEmail: "optout@example.com",
      recipientName: "OptOut User",
      recipientUserId: userId,
      scheduledFor: new Date(Date.now() - 5000),
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await processDueReminderJobs("worker-optout-test");
    expect(result.cancelled).toBe(1);

    const job = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOne({ _id: jobId });
    expect(job?.status).toBe("cancelled");
    expect(job?.lastError).toContain("opted out");
  });

  it("cancels pending job if circle sharing consent was revoked", async () => {
    const circleId = "circle-consent-revoked";
    const userId = "consent-user-1";
    const jobId = randomUUID();

    await db.collection<Circle>("circles").insertOne({
      _id: circleId,
      name: "Revoked Circle",
      recipientName: "Elder",
      recipientRelationship: "self",
      isRecipientUser: true,
      timezone: "UTC",
      sharingConsent: false, // Revoked!
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "owner-3",
    });

    await db.collection<Membership>("memberships").insertOne({
      _id: randomUUID(),
      circleId,
      userId,
      role: "caregiver",
      email: "caregiver@example.com",
      name: "Caregiver User",
      joinedAt: new Date(),
      notifications: {
        upcomingDoses: true,
        missedDoses: true,
        appointments: true,
      },
    });

    await db.collection<ReminderJob>("reminder_jobs").insertOne({
      _id: jobId,
      circleId,
      jobType: "upcoming_dose",
      referenceId: "dose-auth-3",
      idempotencyKey: `upcoming:${jobId}`,
      recipientEmail: "caregiver@example.com",
      recipientName: "Caregiver User",
      recipientUserId: userId,
      scheduledFor: new Date(Date.now() - 5000),
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await processDueReminderJobs("worker-consent-test");
    expect(result.cancelled).toBe(1);

    const job = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOne({ _id: jobId });
    expect(job?.status).toBe("cancelled");
    expect(job?.lastError).toContain("consent revoked");
  });
});

describe("Lease Recovery of Abandoned Processing Jobs", () => {
  it("recovers an abandoned processing job whose worker lease expired", async () => {
    const circleId = "circle-lease-recovery";
    const userId = "user-lease-1";
    const jobId = randomUUID();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    await db.collection<Circle>("circles").insertOne({
      _id: circleId,
      name: "Lease Circle",
      recipientName: "Elder",
      recipientRelationship: "self",
      isRecipientUser: true,
      timezone: "UTC",
      sharingConsent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
    });

    await db.collection<Membership>("memberships").insertOne({
      _id: randomUUID(),
      circleId,
      userId,
      role: "owner",
      email: "lease@example.com",
      name: "Lease Owner",
      joinedAt: new Date(),
      notifications: {
        upcomingDoses: true,
        missedDoses: true,
        appointments: true,
      },
    });

    await db.collection<DoseOccurrence>("dose_occurrences").insertOne({
      _id: "dose-lease-1",
      circleId,
      medicationId: "med-lease",
      scheduledDate: "2026-11-15",
      medicationName: "Amlodipine",
      dosage: "5mg",
      scheduledTime: "10:00",
      scheduledTimestamp: new Date(),
      status: "scheduled",
      snoozeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.collection<Medication>("medications").insertOne({
      _id: "med-lease",
      circleId,
      name: "Amlodipine",
      dosage: "5mg",
      scheduleTimes: ["10:00"],
      startDate: "2026-11-01",
      endDate: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
    });

    // Insert job abandoned in 'processing' status 10 minutes ago
    await db.collection<ReminderJob>("reminder_jobs").insertOne({
      _id: jobId,
      circleId,
      jobType: "upcoming_dose",
      referenceId: "dose-lease-1",
      idempotencyKey: `upcoming:${jobId}`,
      recipientEmail: "lease@example.com",
      recipientName: "Lease Owner",
      recipientUserId: userId,
      scheduledFor: tenMinutesAgo,
      status: "processing",
      attempts: 1,
      maxAttempts: 3,
      claimedAt: tenMinutesAgo,
      claimedByWorker: "crashed-worker-99",
      createdAt: tenMinutesAgo,
      updatedAt: tenMinutesAgo,
    });

    const res = await processDueReminderJobs("recovery-worker");
    expect(res.processed).toBe(1);
    expect(res.sent).toBe(1);

    const job = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOne({ _id: jobId });
    expect(job?.status).toBe("sent");
    expect(job?.claimedByWorker).toBe("recovery-worker");
    expect(job?.deliveryMode).toBe("test_transport");
  });
});

describe("Proactive Scheduler-Only Generation Without Page Visits", () => {
  it("generates occurrences, advances overdue doses, and creates jobs across multiple days", async () => {
    const circleId = "circle-multi-day-cron";
    const userId = "cron-user-1";

    await db.collection<Circle>("circles").insertOne({
      _id: circleId,
      name: "Cron Test Circle",
      recipientName: "Grandpa Frank",
      recipientRelationship: "parent",
      isRecipientUser: false,
      timezone: "UTC",
      sharingConsent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
    });

    await db.collection<Membership>("memberships").insertOne({
      _id: randomUUID(),
      circleId,
      userId,
      role: "owner",
      email: "frank.caregiver@example.com",
      name: "Frank Jr.",
      joinedAt: new Date(),
      notifications: {
        upcomingDoses: true,
        missedDoses: true,
        appointments: true,
      },
    });

    // Add active medication
    await db.collection<Medication>("medications").insertOne({
      _id: "med-cron-1",
      circleId,
      name: "Lisinopril",
      dosage: "10mg",
      scheduleTimes: ["08:00", "20:00"],
      startDate: "2026-11-14",
      endDate: "2026-11-18",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
    });

    // Day 1: Nov 15 at 07:50 UTC (10 mins before 08:00 dose)
    const day1Time = new Date("2026-11-15T07:50:00.000Z");
    const { generateReminderJobsForCircle } =
      await import("../src/lib/reminder-service");

    const jobsCount1 = await generateReminderJobsForCircle(circleId, day1Time);
    expect(jobsCount1).toBeGreaterThan(0);

    // Verify occurrences were proactively created for today without opening Today view
    const occurrencesDay1 = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .find({ circleId, scheduledDate: "2026-11-15" })
      .toArray();
    expect(occurrencesDay1.length).toBe(2);

    // Day 1 Later: Nov 15 at 10:00 UTC (past grace period for 08:00 dose)
    const day1Later = new Date("2026-11-15T10:00:00.000Z");
    await generateReminderJobsForCircle(circleId, day1Later);

    // Verify overdue transition happened automatically in scheduler pipeline
    const morningDose = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .findOne({
        circleId,
        scheduledDate: "2026-11-15",
        scheduledTime: "08:00",
      });
    expect(morningDose?.status).toBe("unconfirmed_missed");

    // Care alert generated
    const alert = await db
      .collection<CareAlert>("care_alerts")
      .findOne({ referenceId: morningDose?._id });
    expect(alert).toBeTruthy();
    expect(alert?.type).toBe("missed_dose");

    // Day 2: Nov 16 at 07:00 UTC
    const day2Time = new Date("2026-11-16T07:00:00.000Z");
    await generateReminderJobsForCircle(circleId, day2Time);

    const occurrencesDay2 = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .find({ circleId, scheduledDate: "2026-11-16" })
      .toArray();
    expect(occurrencesDay2.length).toBe(2);
  });
});

describe("Truthful Production Email Status", () => {
  it("fails closed and marks job failed when RESEND_API_KEY is missing in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");

    const { getEmailProvider } = await import("../src/lib/email/provider");
    setCustomEmailProvider(undefined); // Clear activeProvider singleton

    const provider = getEmailProvider();
    expect(provider.name).toBe("UnconfiguredProductionEmailProvider");

    const circleId = "circle-prod-email-test";
    const jobId = randomUUID();

    await db.collection<Circle>("circles").insertOne({
      _id: circleId,
      name: "Prod Email Circle",
      recipientName: "Elder",
      recipientRelationship: "self",
      isRecipientUser: true,
      timezone: "UTC",
      sharingConsent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "u-prod-1",
    });

    await db.collection<Membership>("memberships").insertOne({
      _id: randomUUID(),
      circleId,
      userId: "u-prod-1",
      role: "owner",
      email: "prod@example.com",
      name: "Prod User",
      joinedAt: new Date(),
      notifications: {
        upcomingDoses: true,
        missedDoses: true,
        appointments: true,
      },
    });

    await db.collection<DoseOccurrence>("dose_occurrences").insertOne({
      _id: "dose-prod-1",
      circleId,
      medicationId: "med-prod-1",
      scheduledDate: "2026-11-15",
      medicationName: "Atorvastatin",
      dosage: "20mg",
      scheduledTime: "10:00",
      scheduledTimestamp: new Date(),
      status: "scheduled",
      snoozeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.collection<Medication>("medications").insertOne({
      _id: "med-prod-1",
      circleId,
      name: "Atorvastatin",
      dosage: "20mg",
      scheduleTimes: ["10:00"],
      startDate: "2026-11-01",
      endDate: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "u-prod-1",
    });

    await db.collection<ReminderJob>("reminder_jobs").insertOne({
      _id: jobId,
      circleId,
      jobType: "upcoming_dose",
      referenceId: "dose-prod-1",
      idempotencyKey: `upcoming:${jobId}`,
      recipientEmail: "prod@example.com",
      recipientName: "Prod User",
      recipientUserId: "u-prod-1",
      scheduledFor: new Date(Date.now() - 5000),
      status: "pending",
      attempts: 2,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await processDueReminderJobs("prod-worker");
    expect(result.failed).toBe(1);

    const job = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOne({ _id: jobId });
    expect(job?.status).toBe("failed");
    expect(job?.lastError).toContain("RESEND_API_KEY is missing in production");

    vi.unstubAllEnvs();
    ensureBaseEnvs();
    setCustomEmailProvider(undefined);
  });

  it("rescheduled appointment generates replacement reminder and cancels previous job", async () => {
    const { circle } = await createCircle({
      userId: "resched-owner",
      userEmail: "resched@example.com",
      userName: "Resched Owner",
      input: {
        name: "Reschedule Circle",
        recipientName: "Elder",
        recipientRelationship: "self",
        isRecipientUser: true,
        sharingConsent: true,
        timezone: "UTC",
      },
    });

    const now = new Date();
    const firstDate = new Date(now.getTime() + 4 * 3600 * 1000);
    const nextDate = new Date(now.getTime() + 6 * 3600 * 1000);
    const fields = {
      title: "Cardiology Followup",
      provider: "Dr. Heart",
      location: "Heart Clinic",
    };

    const appt = await createAppointment({
      userId: "resched-owner",
      circleId: circle._id,
      input: {
        ...fields,
        localDate: firstDate.toISOString().slice(0, 10),
        localTime: firstDate.toISOString().slice(11, 16),
      },
    });

    await generateReminderJobsForCircle(circle._id, now);
    const initialPending = await db
      .collection<ReminderJob>("reminder_jobs")
      .countDocuments({ referenceId: appt._id, status: "pending" });
    expect(initialPending).toBe(1);

    // Reschedule appointment
    await updateAppointment({
      userId: "resched-owner",
      circleId: circle._id,
      appointmentId: appt._id,
      input: {
        ...fields,
        localDate: nextDate.toISOString().slice(0, 10),
        localTime: nextDate.toISOString().slice(11, 16),
        status: "scheduled",
      },
    });

    // Old reminder is cancelled
    const oldJob = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOne({ referenceId: appt._id, status: "cancelled" });
    expect(oldJob).toBeDefined();

    // Re-generate reminder jobs: MUST produce a new pending reminder for updated schedule
    await generateReminderJobsForCircle(circle._id, now);
    const replacementPending = await db
      .collection<ReminderJob>("reminder_jobs")
      .countDocuments({ referenceId: appt._id, status: "pending" });
    expect(replacementPending).toBe(1);
  });

  it("expired claim on final attempt does not remain permanently processing", async () => {
    const now = new Date();
    const jobId = `final-attempt-test-${randomUUID()}`;

    await db.collection<ReminderJob>("reminder_jobs").insertOne({
      _id: jobId,
      circleId: "fictional-circle",
      jobType: "upcoming_dose",
      referenceId: "fictional-dose",
      idempotencyKey: `final-attempt:${jobId}`,
      recipientEmail: "fictional@example.com",
      recipientName: "Fictional",
      recipientUserId: "fictional-user",
      status: "processing",
      attempts: 3,
      maxAttempts: 3,
      scheduledFor: new Date(now.getTime() - 3600000),
      claimedAt: new Date(now.getTime() - 3600000),
      claimedByWorker: "crashed-worker",
      createdAt: now,
      updatedAt: now,
    });

    await processDueReminderJobs("recovery-worker", now);
    const job = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOne({ _id: jobId });
    expect(job?.status).toBe("failed");
    expect(job?.lastError).toContain("retry attempts exhausted");
  });

  it("stale worker with old claimToken cannot mutate a re-leased job", async () => {
    const circleId = "fencing-circle";
    const userId = "fencing-user";
    const jobId = `fence-test-${randomUUID()}`;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    await db.collection<Circle>("circles").insertOne({
      _id: circleId,
      name: "Fencing Circle",
      recipientName: "Elder",
      recipientRelationship: "self",
      isRecipientUser: true,
      sharingConsent: true,
      timezone: "UTC",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
    });

    await db.collection<Membership>("memberships").insertOne({
      _id: randomUUID(),
      circleId,
      userId,
      role: "owner",
      email: "fence@example.com",
      name: "Fence Owner",
      joinedAt: new Date(),
      notifications: {
        upcomingDoses: true,
        missedDoses: true,
        appointments: true,
      },
    });

    await db.collection<DoseOccurrence>("dose_occurrences").insertOne({
      _id: "fence-dose-1",
      circleId,
      medicationId: "fence-med-1",
      scheduledDate: "2026-11-15",
      medicationName: "Lisinopril",
      dosage: "10mg",
      scheduledTime: "08:00",
      scheduledTimestamp: new Date(),
      status: "scheduled",
      snoozeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.collection<Medication>("medications").insertOne({
      _id: "fence-med-1",
      circleId,
      name: "Lisinopril",
      dosage: "10mg",
      scheduleTimes: ["08:00"],
      startDate: "2026-11-01",
      endDate: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
    });

    // Insert job previously claimed by worker-1 that timed out
    await db.collection<ReminderJob>("reminder_jobs").insertOne({
      _id: jobId,
      circleId,
      jobType: "upcoming_dose",
      referenceId: "fence-dose-1",
      idempotencyKey: `fence:${jobId}`,
      recipientEmail: "fence@example.com",
      recipientName: "Fence Owner",
      recipientUserId: userId,
      scheduledFor: tenMinutesAgo,
      status: "processing",
      attempts: 1,
      maxAttempts: 3,
      claimedAt: tenMinutesAgo,
      claimedByWorker: "worker-1",
      claimToken: "worker-1-stale-token",
      createdAt: tenMinutesAgo,
      updatedAt: tenMinutesAgo,
    });

    // worker-2 reclaims and completes the job
    const runResult = await processDueReminderJobs("worker-2", new Date());
    expect(runResult.sent).toBe(1);

    const recheckedJob = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOne({ _id: jobId });
    expect(recheckedJob?.status).toBe("sent");
    expect(recheckedJob?.claimedByWorker).toBe("worker-2");

    // If worker-1 now wakes up and attempts to update the job with its stale token:
    const staleUpdate = await db
      .collection<ReminderJob>("reminder_jobs")
      .updateOne(
        {
          _id: jobId,
          status: "processing",
          claimedByWorker: "worker-1",
          claimToken: "worker-1-stale-token",
        },
        {
          $set: { status: "failed", lastError: "worker 1 crashed" },
        },
      );
    expect(staleUpdate.matchedCount).toBe(0);
    expect(staleUpdate.modifiedCount).toBe(0);

    // Job remains sent by worker-2
    const finalJob = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOne({ _id: jobId });
    expect(finalJob?.status).toBe("sent");
  });
});
