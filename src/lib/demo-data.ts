import "server-only";
import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import type {
  Appointment,
  CareAlert,
  Circle,
  DoseOccurrence,
  Medication,
  Membership,
} from "@/lib/models";
import { getTodayLocalDate, localToUtc } from "@/lib/timezone";

export interface DemoSeedResult {
  circleId: string;
  circleName: string;
  recipientName: string;
  passcodeNotice: string;
  medicationsCount: number;
  appointmentsCount: number;
  alertsCount: number;
}

/**
 * Creates clearly labelled fictional records for evaluation demonstrations.
 * Never called automatically; must be invoked explicitly.
 */
export async function seedFictionalDemoData(
  db: Db,
  ownerUserId: string,
  ownerEmail: string,
  ownerName: string,
): Promise<DemoSeedResult> {
  const circleId = `demo-circle-${randomUUID().substring(0, 8)}`;
  const now = new Date();
  const timezone = "America/New_York";
  const today = getTodayLocalDate(timezone, now);

  const circle: Circle = {
    _id: circleId,
    name: "Eleanor Vance's Circle (Fictional Demo)",
    recipientName: "Eleanor Vance (Demo Patient)",
    recipientRelationship: "parent",
    isRecipientUser: false,
    recipientUserId: null,
    timezone,
    sharingConsent: true,
    consentNotes:
      "[DEMO DATA - FICTIONAL RECORD] Eleanor Vance consented to care coordination with daughter Sarah and nurse Sam.",
    createdAt: now,
    updatedAt: now,
    createdBy: ownerUserId,
  };

  const membership: Membership = {
    _id: `demo-mem-${randomUUID().substring(0, 8)}`,
    circleId,
    userId: ownerUserId,
    role: "owner",
    email: ownerEmail,
    name: ownerName,
    joinedAt: now,
    notifications: {
      upcomingDoses: true,
      missedDoses: true,
      appointments: true,
    },
  };

  await db.collection<Circle>("circles").insertOne(circle);
  await db.collection<Membership>("memberships").insertOne(membership);

  // Fictional medications
  const med1Id = `demo-med-lisinopril-${randomUUID().substring(0, 6)}`;
  const med2Id = `demo-med-vitamind-${randomUUID().substring(0, 6)}`;

  const medications: Medication[] = [
    {
      _id: med1Id,
      circleId,
      name: "Lisinopril (Fictional Demo)",
      dosage: "10mg tablet",
      instructions: "Take once daily in the morning with a full glass of water",
      scheduleTimes: ["08:30"],
      startDate: today,
      endDate: null,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy: ownerUserId,
    },
    {
      _id: med2Id,
      circleId,
      name: "Calcium & Vitamin D3 (Fictional Demo)",
      dosage: "600mg / 400 IU chewable",
      instructions: "Take after lunch",
      scheduleTimes: ["13:00"],
      startDate: today,
      endDate: null,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy: ownerUserId,
    },
  ];

  await db.collection<Medication>("medications").insertMany(medications);

  // Generate today's dose occurrences
  const dose1Utc = localToUtc(today, "08:30", timezone);
  const dose2Utc = localToUtc(today, "13:00", timezone);

  const dose1Id = `demo-dose-1-${randomUUID().substring(0, 6)}`;
  const dose2Id = `demo-dose-2-${randomUUID().substring(0, 6)}`;

  const doseOccurrences: DoseOccurrence[] = [
    {
      _id: dose1Id,
      circleId,
      medicationId: med1Id,
      medicationName: "Lisinopril (Fictional Demo)",
      dosage: "10mg tablet",
      instructions: "Take once daily in the morning with a full glass of water",
      scheduledDate: today,
      scheduledTime: "08:30",
      scheduledTimestamp: dose1Utc,
      status: "unconfirmed_missed", // past grace period for demonstration of 'I'll handle this'
      takenAt: null,
      takenBy: null,
      snoozeUntil: null,
      snoozeCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: dose2Id,
      circleId,
      medicationId: med2Id,
      medicationName: "Calcium & Vitamin D3 (Fictional Demo)",
      dosage: "600mg / 400 IU chewable",
      instructions: "Take after lunch",
      scheduledDate: today,
      scheduledTime: "13:00",
      scheduledTimestamp: dose2Utc,
      status: "scheduled",
      takenAt: null,
      takenBy: null,
      snoozeUntil: null,
      snoozeCount: 0,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await db
    .collection<DoseOccurrence>("dose_occurrences")
    .insertMany(doseOccurrences);

  // Fictional appointment
  const apptDate = today;
  const apptTime = "14:30";
  const apptUtc = localToUtc(apptDate, apptTime, timezone);

  const appointment: Appointment = {
    _id: `demo-appt-${randomUUID().substring(0, 6)}`,
    circleId,
    title: "Routine Cardiology Follow-up (Fictional)",
    provider: "Dr. Robert Smith, MD (Heart & Wellness Clinic)",
    location: "450 Memorial Drive, Suite 300, Boston MA",
    scheduledTimestamp: apptUtc,
    localDate: apptDate,
    localTime: apptTime,
    notes:
      "[DEMO RECORD] Fasting not required. Review recent blood pressure log.",
    status: "scheduled",
    createdAt: now,
    updatedAt: now,
    createdBy: ownerUserId,
  };

  await db.collection<Appointment>("appointments").insertOne(appointment);

  // Fictional Care Alert for the unconfirmed morning dose
  const alert: CareAlert = {
    _id: `demo-alert-${randomUUID().substring(0, 6)}`,
    circleId,
    type: "missed_dose",
    referenceId: dose1Id,
    title: "Unconfirmed Morning Dose: Lisinopril 10mg",
    details:
      '[DEMO SCENARIO] Scheduled for 08:30. Grace period has passed. Select "I\'ll handle this" to coordinate with the family.',
    status: "pending",
    acknowledgedBy: null,
    acknowledgedAt: null,
    resolutionNotes: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<CareAlert>("care_alerts").insertOne(alert);

  return {
    circleId,
    circleName: circle.name,
    recipientName: circle.recipientName,
    passcodeNotice:
      "Generate invitation passcodes from the Circle Members tab.",
    medicationsCount: medications.length,
    appointmentsCount: 1,
    alertsCount: 1,
  };
}
