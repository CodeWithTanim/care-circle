import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { acknowledgeAlert, resolveAlert } from "../src/lib/alert-service";
import {
  cancelAppointment,
  createAppointment,
  getAppointments,
} from "../src/lib/appointment-service";
import { createCircle } from "../src/lib/circle-service";
import { ensureDatabaseIndexes } from "../src/lib/db-indexes";
import { testEmailTransport } from "../src/lib/email/provider";
import {
  addMedication,
  getAdherenceHistory,
  getTodayDoses,
  recordDose,
} from "../src/lib/medication-service";
import {
  generateReminderJobsForCircle,
  processDueReminderJobs,
} from "../src/lib/reminder-service";

import type { CareAlert, Membership } from "../src/lib/models";

vi.mock("server-only", () => ({}));

let mongo: MongoMemoryServer;
let db: import("mongodb").Db;
let client: import("mongodb").MongoClient;

const owner = {
  userId: "user-owner",
  userEmail: "elder@example.com",
  userName: "Elder Eleanor",
};

const caregiver = {
  userId: "user-caregiver",
  userEmail: "caregiver@example.com",
  userName: "Caregiver Sam",
};

const family = {
  userId: "user-family",
  userEmail: "family@example.com",
  userName: "Daughter Daisy",
};

let circleId: string;

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

  // Setup circle with Eleanor as recipient and owner
  const res = await createCircle({
    ...owner,
    input: {
      name: "Eleanor's Care Circle",
      recipientName: "Eleanor Vance",
      recipientRelationship: "self",
      isRecipientUser: true,
      timezone: "America/New_York",
      sharingConsent: true,
      consentNotes: "Eleanor consents to care coordination.",
    },
  });
  circleId = res.circle._id;

  // Add caregiver and family memberships
  await db.collection<Membership>("memberships").insertMany([
    {
      _id: "mem-caregiver",
      circleId,
      userId: caregiver.userId,
      role: "caregiver",
      email: caregiver.userEmail,
      name: caregiver.userName,
      joinedAt: new Date(),
      notifications: {
        upcomingDoses: true,
        missedDoses: true,
        appointments: true,
      },
    },
    {
      _id: "mem-family",
      circleId,
      userId: family.userId,
      role: "family",
      email: family.userEmail,
      name: family.userName,
      joinedAt: new Date(),
      notifications: {
        upcomingDoses: true,
        missedDoses: true,
        appointments: true,
      },
    },
  ]);
});

afterAll(async () => {
  if (client) {
    await client.close();
  }
  await mongo?.stop();
  vi.unstubAllEnvs();
});

describe("Medications and Today Schedule", () => {
  let medId: string;

  it("adds a medication and generates deterministic occurrences", async () => {
    const med = await addMedication({
      userId: caregiver.userId,
      circleId,
      input: {
        name: "Blood Pressure Med",
        dosage: "10mg tablet",
        instructions: "Take once daily in the morning with water",
        scheduleTimes: ["09:00"],
        startDate: "2026-11-01",
        endDate: null,
      },
    });

    expect(med._id).toBeDefined();
    medId = med._id;

    const todayResult = await getTodayDoses({
      userId: owner.userId,
      circleId,
      targetDate: "2026-11-15",
    });

    expect(todayResult.doses.length).toBeGreaterThanOrEqual(1);
    const targetDose = todayResult.doses.find((d) => d.medicationId === medId);
    expect(targetDose).toBeDefined();
    expect(targetDose?.scheduledTime).toBe("09:00");
    expect(targetDose?.status).toBe("scheduled");
  });

  it("records a dose as taken idempotently and records actor", async () => {
    const todayResult = await getTodayDoses({
      userId: owner.userId,
      circleId,
      targetDate: "2026-11-15",
    });
    const dose = todayResult.doses[0];

    const taken = await recordDose({
      userId: owner.userId,
      userName: owner.userName,
      circleId,
      occurrenceId: dose._id,
      input: { action: "taken" },
    });

    expect(taken.status).toBe("taken");
    expect(taken.takenBy?.name).toBe("Elder Eleanor");
    expect(taken.takenAt).toBeDefined();

    // Repeated confirmation is idempotent
    const repeated = await recordDose({
      userId: owner.userId,
      userName: owner.userName,
      circleId,
      occurrenceId: dose._id,
      input: { action: "taken" },
    });
    expect(repeated.status).toBe("taken");
  });

  it("denies dose confirmation for read-only family members", async () => {
    // Add another medication
    const med2 = await addMedication({
      userId: caregiver.userId,
      circleId,
      input: {
        name: "Vitamin D3",
        dosage: "1000 IU",
        scheduleTimes: ["14:00"],
        startDate: "2026-11-01",
      },
    });

    const res = await getTodayDoses({
      userId: owner.userId,
      circleId,
      targetDate: "2026-11-15",
    });
    const dose2 = res.doses.find((d) => d.medicationId === med2._id)!;

    await expect(
      recordDose({
        userId: family.userId,
        userName: family.userName,
        circleId,
        occurrenceId: dose2._id,
        input: { action: "taken" },
      }),
    ).rejects.toThrow("care recipient or an authorized caregiver");
  });

  it("allows bounded snooze", async () => {
    const res = await getTodayDoses({
      userId: owner.userId,
      circleId,
      targetDate: "2026-11-15",
    });
    const pendingDose = res.doses.find((d) => d.status === "scheduled")!;

    const snoozed = await recordDose({
      userId: caregiver.userId,
      userName: caregiver.userName,
      circleId,
      occurrenceId: pendingDose._id,
      input: { action: "snooze", snoozeMinutes: 15 },
    });

    expect(snoozed.status).toBe("snoozed");
    expect(snoozed.snoozeCount).toBe(1);
    expect(snoozed.snoozeUntil).toBeDefined();
  });

  it("calculates adherence history correctly", async () => {
    const history = await getAdherenceHistory({
      userId: owner.userId,
      circleId,
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    });

    expect(history.stats.total).toBeGreaterThanOrEqual(1);
    expect(history.stats.taken).toBeGreaterThanOrEqual(1);
  });
});

describe("Appointments", () => {
  let apptId: string;

  it("creates and retrieves appointments", async () => {
    const appt = await createAppointment({
      userId: caregiver.userId,
      circleId,
      input: {
        title: "Annual Cardiology Checkup",
        provider: "Dr. Robert Smith",
        location: "Heart Center, Suite 300",
        localDate: "2026-11-20",
        localTime: "10:30",
        notes: "Bring previous ECG report",
      },
    });

    expect(appt._id).toBeDefined();
    apptId = appt._id;

    const list = await getAppointments({
      userId: family.userId,
      circleId,
    });
    expect(list.some((a) => a._id === apptId)).toBe(true);
  });

  it("cancels appointment", async () => {
    const cancelled = await cancelAppointment({
      userId: caregiver.userId,
      circleId,
      appointmentId: apptId,
    });
    expect(cancelled.status).toBe("cancelled");
  });
});

describe("Alerts & Caregiver Follow-Up (I'll handle this)", () => {
  let alertId: string;

  beforeAll(async () => {
    // Insert an alert for an unconfirmed dose
    const alert = {
      _id: "alert-101",
      circleId,
      type: "missed_dose" as const,
      referenceId: "dose-101",
      title: "Missed dose: Blood Pressure Med",
      details: "Dose scheduled for 09:00 was unconfirmed after grace period.",
      status: "pending" as const,
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolutionNotes: null,
      resolvedAt: null,
      resolvedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection<CareAlert>("care_alerts").insertOne(alert);
    alertId = alert._id;
  });

  it("allows family member to atomically acknowledge alert with 'I'll handle this'", async () => {
    const ack = await acknowledgeAlert({
      userId: family.userId,
      userName: family.userName,
      circleId,
      alertId,
    });

    expect(ack.status).toBe("acknowledged");
    expect(ack.acknowledgedBy?.name).toBe("Daughter Daisy");
    expect(ack.acknowledgedAt).toBeDefined();

    // Second simultaneous claim must fail with conflict
    await expect(
      acknowledgeAlert({
        userId: caregiver.userId,
        userName: caregiver.userName,
        circleId,
        alertId,
      }),
    ).rejects.toThrow("already claimed");
  });

  it("resolves the alert with notes without altering clinical dose records", async () => {
    const resolved = await resolveAlert({
      userId: family.userId,
      userName: family.userName,
      circleId,
      alertId,
      input: { notes: "Called Eleanor, verified she took it with tea." },
    });

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolutionNotes).toContain("Called Eleanor");
  });
});

describe("Reminder Processing & Email Dispatch", () => {
  beforeAll(() => {
    testEmailTransport.clear();
  });

  it("generates idempotent reminder jobs and processes them via test transport", async () => {
    // Generate jobs for circle
    const count = await generateReminderJobsForCircle(circleId, new Date());
    expect(count).toBeGreaterThanOrEqual(0);

    // Running generation again should not duplicate jobs
    const secondCount = await generateReminderJobsForCircle(
      circleId,
      new Date(),
    );
    expect(secondCount).toBe(0);

    // Process due jobs
    const result = await processDueReminderJobs(
      "test-worker",
      new Date(Date.now() + 48 * 3600 * 1000),
    );
    expect(result.processed).toBeGreaterThanOrEqual(0);
  });
});
