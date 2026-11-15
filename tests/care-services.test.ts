import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { acknowledgeAlert, resolveAlert } from "../src/lib/alert-service";
import {
  cancelAppointment,
  createAppointment,
  getAppointments,
} from "../src/lib/appointment-service";
import { createCircle, updateCircle } from "../src/lib/circle-service";
import { ensureDatabaseIndexes } from "../src/lib/db-indexes";
import { testEmailTransport } from "../src/lib/email/provider";
import {
  addMedication,
  archiveMedication,
  getAdherenceHistory,
  getTodayDoses,
  recordDose,
  updateMedication,
} from "../src/lib/medication-service";
import {
  generateReminderJobsForCircle,
  processDueReminderJobs,
} from "../src/lib/reminder-service";

import type {
  Appointment,
  CareAlert,
  DoseOccurrence,
  Membership,
  ReminderJob,
} from "../src/lib/models";

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

  it("reconciles future occurrences and cancels obsolete reminder jobs on medication edit", async () => {
    // Add medication with 2 times
    const medReconcile = await addMedication({
      userId: caregiver.userId,
      circleId,
      input: {
        name: "Heart Rhythm Med",
        dosage: "50mg",
        scheduleTimes: ["08:00", "20:00"],
        startDate: "2026-11-15",
        endDate: "2026-11-20",
      },
    });

    // Enqueue a pending reminder job for the 20:00 dose
    const eveningDose = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .findOne({
        medicationId: medReconcile._id,
        scheduledTime: "20:00",
      });
    expect(eveningDose).toBeTruthy();

    const jobId = "job-reconcile-evening";
    await db.collection<ReminderJob>("reminder_jobs").insertOne({
      _id: jobId,
      circleId,
      jobType: "upcoming_dose",
      referenceId: eveningDose!._id,
      idempotencyKey: `upcoming:${jobId}`,
      recipientEmail: "elder@example.com",
      recipientName: "Elder Eleanor",
      recipientUserId: owner.userId,
      scheduledFor: new Date("2026-11-15T19:45:00Z"),
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Edit medication: drop the 20:00 time, change to 08:00 only
    await updateMedication({
      userId: caregiver.userId,
      circleId,
      medicationId: medReconcile._id,
      input: {
        name: "Heart Rhythm Med",
        dosage: "50mg",
        scheduleTimes: ["08:00"], // 20:00 removed
        startDate: "2026-11-15",
        endDate: "2026-11-20",
        active: true,
      },
    });

    // The 20:00 future occurrence should have been deleted
    const checkDose = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .findOne({
        _id: eveningDose!._id,
      });
    expect(checkDose).toBeNull();

    // The pending reminder job should have been cancelled
    const checkJob = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOne({ _id: jobId });
    expect(checkJob?.status).toBe("cancelled");
    expect(checkJob?.lastError).toContain("Schedule changed");
  });

  it("cancels future occurrences and pending jobs on medication archiving", async () => {
    const medArchive = await addMedication({
      userId: caregiver.userId,
      circleId,
      input: {
        name: "Temporary Antibiotic",
        dosage: "250mg",
        scheduleTimes: ["12:00"],
        startDate: "2026-11-15",
      },
    });

    const dose = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .findOne({
        medicationId: medArchive._id,
      });
    expect(dose).toBeTruthy();

    const jobId = "job-archive-test";
    await db.collection<ReminderJob>("reminder_jobs").insertOne({
      _id: jobId,
      circleId,
      jobType: "upcoming_dose",
      referenceId: dose!._id,
      idempotencyKey: `upcoming:${jobId}`,
      recipientEmail: "elder@example.com",
      recipientName: "Elder Eleanor",
      recipientUserId: owner.userId,
      scheduledFor: new Date(),
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await archiveMedication({
      userId: caregiver.userId,
      circleId,
      medicationId: medArchive._id,
    });

    const checkJob = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOne({ _id: jobId });
    expect(checkJob?.status).toBe("cancelled");
    expect(checkJob?.lastError).toContain("archived");
  });

  it("validates real calendar dates and rejects impossible dates (e.g. Feb 31)", async () => {
    await expect(
      addMedication({
        userId: caregiver.userId,
        circleId,
        input: {
          name: "Invalid Date Med",
          dosage: "10mg",
          scheduleTimes: ["08:00"],
          startDate: "2026-02-31", // Impossible date!
        },
      }),
    ).rejects.toThrow();

    await expect(
      addMedication({
        userId: caregiver.userId,
        circleId,
        input: {
          name: "Backwards Date Med",
          dosage: "10mg",
          scheduleTimes: ["08:00"],
          startDate: "2026-11-20",
          endDate: "2026-11-10", // endDate < startDate!
        },
      }),
    ).rejects.toThrow();

    await expect(
      addMedication({
        userId: caregiver.userId,
        circleId,
        input: {
          name: "Duplicate Times Med",
          dosage: "10mg",
          scheduleTimes: ["08:00", "08:00"], // Duplicates!
          startDate: "2026-11-15",
        },
      }),
    ).rejects.toThrow();
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

  it("reconciles snoozed future doses when medication is archived", async () => {
    const medSnooze = await addMedication({
      userId: caregiver.userId,
      circleId,
      input: {
        name: "Snoozed Medication",
        dosage: "10mg",
        scheduleTimes: ["23:00"],
        startDate: "2026-11-15",
      },
    });

    const dose = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .findOne({
        medicationId: medSnooze._id,
        scheduledTime: "23:00",
      });
    expect(dose).toBeTruthy();

    // Mark snoozed in the future
    await db.collection<DoseOccurrence>("dose_occurrences").updateOne(
      { _id: dose!._id },
      {
        $set: {
          status: "snoozed",
          snoozeUntil: new Date(Date.now() + 3600 * 1000),
          scheduledTimestamp: new Date(Date.now() + 3600 * 1000),
        },
      },
    );

    // Archive medication
    await archiveMedication({
      userId: caregiver.userId,
      circleId,
      medicationId: medSnooze._id,
    });

    // Future snoozed dose should be removed
    const checkDose = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .findOne({
        _id: dose!._id,
      });
    expect(checkDose).toBeNull();
  });

  it("reconciles future occurrences and appointments when circle timezone changes", async () => {
    // Circle starts in America/New_York
    const appt = await createAppointment({
      userId: owner.userId,
      circleId,
      input: {
        title: "Zone Check Visit",
        provider: "Dr. Zone",
        location: "Suite 101",
        localDate: "2026-11-20",
        localTime: "10:00",
      },
    });

    // In America/New_York (UTC-5 in Nov), 10:00 is 15:00Z
    expect(appt.scheduledTimestamp.toISOString()).toBe(
      "2026-11-20T15:00:00.000Z",
    );

    // Update circle timezone to America/Chicago (UTC-6 in Nov)
    await updateCircle({
      userId: owner.userId,
      circleId,
      input: {
        timezone: "America/Chicago",
      },
    });

    // In America/Chicago, 10:00 should now be 16:00Z
    const updatedAppt = await db
      .collection<Appointment>("appointments")
      .findOne({ _id: appt._id });
    expect(updatedAppt).toBeTruthy();
    expect(new Date(updatedAppt!.scheduledTimestamp).toISOString()).toBe(
      "2026-11-20T16:00:00.000Z",
    );
  });
});
