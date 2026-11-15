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
import type { Circle, DoseOccurrence, ReminderJob } from "../src/lib/models";
import { processDueReminderJobs } from "../src/lib/reminder-service";
import { localToUtc, utcToLocalDate } from "../src/lib/timezone";

vi.mock("server-only", () => ({}));

let mongo: MongoMemoryServer;
let db: import("mongodb").Db;
let client: import("mongodb").MongoClient;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv("MONGODB_URI", mongo.getUri());
  vi.stubEnv("MONGODB_DB", "care_circle_test");
  vi.stubEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");

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

    // Insert dummy circle and dose
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
  });
});
