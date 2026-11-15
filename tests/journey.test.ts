import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  acknowledgeAlert,
  getAlerts,
  resolveAlert,
} from "../src/lib/alert-service";
import {
  createAppointment,
  getAppointments,
} from "../src/lib/appointment-service";
import {
  createCircle,
  createInvite,
  getCircleDetails,
  joinCircleWithPasscode,
} from "../src/lib/circle-service";
import { ensureDatabaseIndexes } from "../src/lib/db-indexes";
import { testEmailTransport } from "../src/lib/email/provider";
import {
  addMedication,
  getTodayDoses,
  recordDose,
} from "../src/lib/medication-service";
import { requireCircleAccess } from "../src/lib/permissions";
import {
  generateReminderJobsForCircle,
  processDueReminderJobs,
} from "../src/lib/reminder-service";
import type { DoseOccurrence } from "../src/lib/models";

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
  testEmailTransport.clear();
});

afterAll(async () => {
  if (client) {
    await client.close();
  }
  await mongo?.stop();
  vi.unstubAllEnvs();
});

describe("Complete Acceptance Journey", () => {
  const elder = {
    userId: "elder-user-id",
    userEmail: "eleanor@example.com",
    userName: "Eleanor Vance",
  };

  const familyDaughter = {
    userId: "family-daughter-id",
    userEmail: "sarah@example.com",
    userName: "Sarah Vance",
  };

  let circleId: string;
  let inviteCode: string;
  let medicationId: string;
  let doseId: string;
  let appointmentId: string;

  // Step 1: Create a care circle
  it("Step 1: Elder creates their care circle with explicit consent", async () => {
    const res = await createCircle({
      ...elder,
      input: {
        name: "Eleanor's Care Circle",
        recipientName: "Eleanor Vance",
        recipientRelationship: "self",
        isRecipientUser: true,
        timezone: "America/New_York",
        sharingConsent: true,
        consentNotes: "Eleanor consented to family coordination.",
      },
    });

    expect(res.circle._id).toBeDefined();
    expect(res.membership.role).toBe("owner");
    circleId = res.circle._id;
  });

  // Step 2: Invite family member and join with passcode
  it("Step 2: Elder invites family member who joins with passcode", async () => {
    const inviteRes = await createInvite({
      userId: elder.userId,
      circleId,
      input: {
        role: "family",
        label: "Daughter Sarah",
        expiresInHours: 48,
        maxUses: 1,
      },
    });

    expect(inviteRes.rawPasscode).toBeDefined();
    inviteCode = inviteRes.rawPasscode;

    const joinRes = await joinCircleWithPasscode({
      ...familyDaughter,
      passcode: inviteCode,
    });

    expect(joinRes.circle._id).toBe(circleId);
    expect(joinRes.membership.role).toBe("family");

    // Check members list
    const details = await getCircleDetails(elder.userId, circleId);
    expect(details.members.length).toBe(2);
  });

  // Step 3: Add medication & verify on Today
  it("Step 3: Add medication and verify on Today at correct local time", async () => {
    const med = await addMedication({
      userId: elder.userId,
      circleId,
      input: {
        name: "Lisinopril",
        dosage: "10mg",
        instructions: "Take with water after breakfast",
        scheduleTimes: ["08:30"],
        startDate: "2026-11-01",
      },
    });

    expect(med._id).toBeDefined();
    medicationId = med._id;

    const todayRes = await getTodayDoses({
      userId: familyDaughter.userId,
      circleId,
      targetDate: "2026-11-15",
    });

    expect(todayRes.doses.length).toBeGreaterThanOrEqual(1);
    const d = todayRes.doses.find((x) => x.medicationId === medicationId);
    expect(d).toBeDefined();
    expect(d?.scheduledTime).toBe("08:30");
    doseId = d!._id;
  });

  // Step 4: Mark dose taken and verify persistence across members
  it("Step 4: Mark dose taken and verify actor and timestamp across members", async () => {
    const taken = await recordDose({
      userId: elder.userId,
      userName: elder.userName,
      circleId,
      occurrenceId: doseId,
      input: { action: "taken" },
    });

    expect(taken.status).toBe("taken");
    expect(taken.takenBy?.userId).toBe(elder.userId);

    // Family daughter views Today
    const todayRes = await getTodayDoses({
      userId: familyDaughter.userId,
      circleId,
      targetDate: "2026-11-15",
    });

    const d = todayRes.doses.find((x) => x._id === doseId);
    expect(d?.status).toBe("taken");
    expect(d?.takenBy?.name).toBe("Eleanor Vance");
  });

  // Step 5: Add an appointment
  it("Step 5: Add an appointment and verify on appointment list", async () => {
    const appt = await createAppointment({
      userId: elder.userId,
      circleId,
      input: {
        title: "Cardiologist Consultation",
        provider: "Dr. Robert Smith",
        location: "Medical Plaza, Suite 400",
        localDate: "2026-11-25",
        localTime: "11:00",
        notes: "Bring current medication list",
      },
    });

    expect(appt._id).toBeDefined();
    appointmentId = appt._id;

    const appts = await getAppointments({
      userId: familyDaughter.userId,
      circleId,
    });
    expect(appts.some((a) => a._id === appointmentId)).toBe(true);
  });

  // Step 6: Overdue dose generates alert and email reminder
  it("Step 6: Controlled overdue dose scenario triggers alert and email reminder", async () => {
    // Add an afternoon medication
    const med2 = await addMedication({
      userId: elder.userId,
      circleId,
      input: {
        name: "Blood Thinner",
        dosage: "5mg",
        scheduleTimes: ["15:00"],
        startDate: "2026-11-01",
      },
    });

    const todayRes = await getTodayDoses({
      userId: elder.userId,
      circleId,
      targetDate: "2026-11-15",
    });
    const dose2 = todayRes.doses.find((x) => x.medicationId === med2._id)!;

    // Simulate overdue: set scheduledTimestamp 3 hours in the past
    await db.collection<DoseOccurrence>("dose_occurrences").updateOne(
      { _id: dose2._id },
      {
        $set: { scheduledTimestamp: new Date(Date.now() - 3 * 3600 * 1000) },
      },
    );

    // Calling getTodayDoses evaluates overdue and automatically creates care alert
    await getTodayDoses({
      userId: elder.userId,
      circleId,
      targetDate: "2026-11-15",
    });

    // Check care alert was created
    const alerts = await getAlerts({
      userId: familyDaughter.userId,
      circleId,
      status: "pending",
    });
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const alert = alerts.find((a) => a.referenceId === dose2._id);
    expect(alert).toBeDefined();

    // Generate and dispatch reminders
    await generateReminderJobsForCircle(circleId, new Date());
    const dispatchRes = await processDueReminderJobs("eval-worker", new Date());
    expect(dispatchRes.processed).toBeGreaterThanOrEqual(1);

    const sent = testEmailTransport.getSentEmails();
    expect(sent.length).toBeGreaterThanOrEqual(1);
  });

  // Step 7: Caregiver/Family selects "I'll handle this"
  it("Step 7: Family member selects 'I'll handle this' - status becomes acknowledged without altering dose", async () => {
    const alerts = await getAlerts({
      userId: familyDaughter.userId,
      circleId,
      status: "pending",
    });
    const alert = alerts[0];

    const acknowledged = await acknowledgeAlert({
      userId: familyDaughter.userId,
      userName: familyDaughter.userName,
      circleId,
      alertId: alert._id,
    });

    expect(acknowledged.status).toBe("acknowledged");
    expect(acknowledged.acknowledgedBy?.name).toBe("Sarah Vance");

    // Verify dose status was NOT marked taken (acknowledgement is coordination, not falsified clinical record)
    const doseOcc = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .findOne({ _id: alert.referenceId });
    expect(doseOcc?.status).not.toBe("taken");
  });

  // Step 8: Resolve follow-up and verify authorization barrier
  it("Step 8: Resolve follow-up with notes and verify unauthenticated access denial", async () => {
    const alerts = await getAlerts({
      userId: familyDaughter.userId,
      circleId,
      status: "acknowledged",
    });
    const alert = alerts[0];

    const resolved = await resolveAlert({
      userId: familyDaughter.userId,
      userName: familyDaughter.userName,
      circleId,
      alertId: alert._id,
      input: { notes: "Called mother, helped her take her dose with tea." },
    });

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolutionNotes).toContain("Called mother");

    // Verify unauthenticated access barrier
    await expect(requireCircleAccess("", circleId)).rejects.toThrow();
  });
});
