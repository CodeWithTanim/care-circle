import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type {
  CareAlert,
  Circle,
  DoseOccurrence,
  Medication,
} from "@/lib/models";
import {
  AuthorizationError,
  canConfirmDose,
  requireCircleAccess,
} from "@/lib/permissions";
import {
  DEFAULT_GRACE_PERIOD_MINUTES,
  getTodayLocalDate,
  isDoseOverdue,
  localToUtc,
} from "@/lib/timezone";
import {
  createMedicationSchema,
  recordDoseSchema,
  updateMedicationSchema,
} from "@/lib/validation";

/**
 * Deterministically generates dose occurrences for a given circle and date (YYYY-MM-DD).
 * Idempotent: inserts only occurrences that do not already exist.
 */
export async function ensureDoseOccurrencesForDate(
  circleId: string,
  dateStr: string,
): Promise<void> {
  const db = getDb();
  const circle = await db
    .collection<Circle>("circles")
    .findOne({ _id: circleId });
  if (!circle) return;

  // Find all active medications valid for dateStr
  const medications = await db
    .collection<Medication>("medications")
    .find({
      circleId,
      active: true,
      startDate: { $lte: dateStr },
      $or: [{ endDate: null }, { endDate: { $gte: dateStr } }],
    })
    .toArray();

  for (const med of medications) {
    for (const timeStr of med.scheduleTimes) {
      const scheduledUtc = localToUtc(dateStr, timeStr, circle.timezone);
      const now = new Date();

      await db.collection<DoseOccurrence>("dose_occurrences").updateOne(
        {
          medicationId: med._id,
          scheduledDate: dateStr,
          scheduledTime: timeStr,
        },
        {
          $setOnInsert: {
            _id: randomUUID(),
            circleId,
            medicationId: med._id,
            medicationName: med.name,
            dosage: med.dosage,
            instructions: med.instructions,
            scheduledDate: dateStr,
            scheduledTime: timeStr,
            scheduledTimestamp: scheduledUtc,
            status: "scheduled",
            takenAt: null,
            takenBy: null,
            snoozeUntil: null,
            snoozeCount: 0,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }
  }
}

export async function addMedication(params: {
  userId: string;
  circleId: string;
  input: unknown;
}): Promise<Medication> {
  await requireCircleAccess(params.userId, params.circleId, [
    "owner",
    "caregiver",
  ]);
  const validated = createMedicationSchema.parse(params.input);
  const db = getDb();
  const now = new Date();
  const medId = randomUUID();

  const medication: Medication = {
    _id: medId,
    circleId: params.circleId,
    name: validated.name,
    dosage: validated.dosage,
    instructions: validated.instructions,
    scheduleTimes: validated.scheduleTimes.sort(),
    startDate: validated.startDate,
    endDate: validated.endDate ?? null,
    active: true,
    createdAt: now,
    updatedAt: now,
    createdBy: params.userId,
  };

  await db.collection<Medication>("medications").insertOne(medication);

  // Pre-generate today's doses if medication is active today
  const circle = await db
    .collection<Circle>("circles")
    .findOne({ _id: params.circleId });
  if (circle) {
    const today = getTodayLocalDate(circle.timezone);
    if (
      medication.startDate <= today &&
      (!medication.endDate || medication.endDate >= today)
    ) {
      await ensureDoseOccurrencesForDate(params.circleId, today);
    }
  }

  return medication;
}

export async function updateMedication(params: {
  userId: string;
  circleId: string;
  medicationId: string;
  input: unknown;
}): Promise<Medication> {
  await requireCircleAccess(params.userId, params.circleId, [
    "owner",
    "caregiver",
  ]);
  const validated = updateMedicationSchema.parse(params.input);
  const db = getDb();
  const now = new Date();

  const updateFields: Partial<Medication> = {
    name: validated.name,
    dosage: validated.dosage,
    instructions: validated.instructions,
    scheduleTimes: validated.scheduleTimes.sort(),
    startDate: validated.startDate,
    endDate: validated.endDate ?? null,
    active: validated.active,
    updatedAt: now,
  };

  if (validated.active === false) {
    updateFields.archivedAt = now;
  }

  const result = await db
    .collection<Medication>("medications")
    .findOneAndUpdate(
      { _id: params.medicationId, circleId: params.circleId },
      { $set: updateFields },
      { returnDocument: "after" },
    );

  if (!result) {
    throw new AuthorizationError("Medication not found", 404);
  }

  // If archived, cancel any future pending doses
  if (validated.active === false) {
    await db.collection<DoseOccurrence>("dose_occurrences").deleteMany({
      medicationId: params.medicationId,
      status: "scheduled",
      scheduledTimestamp: { $gt: now },
    });
  }

  return result;
}

export async function archiveMedication(params: {
  userId: string;
  circleId: string;
  medicationId: string;
}): Promise<void> {
  await requireCircleAccess(params.userId, params.circleId, [
    "owner",
    "caregiver",
  ]);
  const db = getDb();
  const now = new Date();

  const result = await db
    .collection<Medication>("medications")
    .updateOne(
      { _id: params.medicationId, circleId: params.circleId },
      { $set: { active: false, archivedAt: now, updatedAt: now } },
    );

  if (result.matchedCount === 0) {
    throw new AuthorizationError("Medication not found", 404);
  }

  // Remove future unconfirmed scheduled occurrences
  await db.collection<DoseOccurrence>("dose_occurrences").deleteMany({
    medicationId: params.medicationId,
    status: "scheduled",
    scheduledTimestamp: { $gt: now },
  });
}

export async function getMedications(params: {
  userId: string;
  circleId: string;
  includeArchived?: boolean;
}): Promise<Medication[]> {
  await requireCircleAccess(params.userId, params.circleId);
  const db = getDb();

  const query: Record<string, unknown> = { circleId: params.circleId };
  if (!params.includeArchived) {
    query.active = true;
  }

  return db
    .collection<Medication>("medications")
    .find(query)
    .sort({ name: 1 })
    .toArray();
}

/**
 * Get Today's doses for a circle, automatically updating overdue doses.
 */
export async function getTodayDoses(params: {
  userId: string;
  circleId: string;
  targetDate?: string; // Optional override e.g. for testing or viewing specific day
}): Promise<{
  dateStr: string;
  timezone: string;
  doses: DoseOccurrence[];
}> {
  const { circle } = await requireCircleAccess(params.userId, params.circleId);
  const db = getDb();
  const timezone = circle.timezone;
  const dateStr = params.targetDate ?? getTodayLocalDate(timezone);

  await ensureDoseOccurrencesForDate(params.circleId, dateStr);

  const doses = await db
    .collection<DoseOccurrence>("dose_occurrences")
    .find({ circleId: params.circleId, scheduledDate: dateStr })
    .sort({ scheduledTime: 1, medicationName: 1 })
    .toArray();

  const now = new Date();
  // Check and update overdue doses to 'unconfirmed_missed'
  for (const dose of doses) {
    if (dose.status === "scheduled" || dose.status === "snoozed") {
      if (
        isDoseOverdue(
          dose.scheduledTimestamp,
          dose.snoozeUntil,
          DEFAULT_GRACE_PERIOD_MINUTES,
          now,
        )
      ) {
        dose.status = "unconfirmed_missed";
        dose.updatedAt = now;
        await db
          .collection<DoseOccurrence>("dose_occurrences")
          .updateOne(
            { _id: dose._id, status: { $in: ["scheduled", "snoozed"] } },
            { $set: { status: "unconfirmed_missed", updatedAt: now } },
          );

        // Auto-create missed dose alert if one doesn't exist
        const existingAlert = await db
          .collection<CareAlert>("care_alerts")
          .findOne({
            referenceId: dose._id,
          });
        if (!existingAlert) {
          await db.collection<CareAlert>("care_alerts").insertOne({
            _id: randomUUID(),
            circleId: params.circleId,
            type: "missed_dose",
            referenceId: dose._id,
            title: `Missed dose: ${dose.medicationName}`,
            details: `${dose.medicationName} (${dose.dosage}) was scheduled for ${dose.scheduledTime} and is past the grace period.`,
            status: "pending",
            acknowledgedBy: null,
            acknowledgedAt: null,
            resolutionNotes: null,
            resolvedAt: null,
            resolvedBy: null,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
  }

  return { dateStr, timezone, doses };
}

/**
 * Record a dose as taken or snoozed.
 * Enforces permissions: elder or caregiver only.
 * Idempotent: repeated taken action returns current state safely.
 */
export async function recordDose(params: {
  userId: string;
  userName: string;
  circleId: string;
  occurrenceId: string;
  input: unknown;
}): Promise<DoseOccurrence> {
  const { membership, circle } = await requireCircleAccess(
    params.userId,
    params.circleId,
  );

  if (!canConfirmDose(membership, circle)) {
    throw new AuthorizationError(
      "Only the care recipient or an authorized caregiver can confirm or snooze medications",
      403,
    );
  }

  const validated = recordDoseSchema.parse(params.input);
  const db = getDb();
  const now = new Date();

  const occurrence = await db
    .collection<DoseOccurrence>("dose_occurrences")
    .findOne({ _id: params.occurrenceId, circleId: params.circleId });

  if (!occurrence) {
    throw new AuthorizationError("Dose occurrence not found", 404);
  }

  if (validated.action === "taken") {
    // Idempotent confirmation
    if (occurrence.status === "taken") {
      return occurrence;
    }

    const updated = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .findOneAndUpdate(
        { _id: params.occurrenceId },
        {
          $set: {
            status: "taken",
            takenAt: now,
            takenBy: { userId: params.userId, name: params.userName },
            updatedAt: now,
          },
        },
        { returnDocument: "after" },
      );

    return updated!;
  }

  if (validated.action === "snooze") {
    if (occurrence.status === "taken") {
      throw new AuthorizationError(
        "Cannot snooze a medication that is already taken",
        400,
      );
    }

    if (occurrence.snoozeCount >= 3) {
      throw new AuthorizationError(
        "Maximum snooze limit reached (3 times). Please confirm or review this dose.",
        400,
      );
    }

    const snoozeMinutes = validated.snoozeMinutes ?? 15;
    const snoozeUntil = new Date(now.getTime() + snoozeMinutes * 60 * 1000);

    const updated = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .findOneAndUpdate(
        { _id: params.occurrenceId },
        {
          $set: {
            status: "snoozed",
            snoozeUntil,
            updatedAt: now,
          },
          $inc: { snoozeCount: 1 },
        },
        { returnDocument: "after" },
      );

    return updated!;
  }

  throw new AuthorizationError("Invalid dose action", 400);
}

/**
 * Adherence history query with date range and summary statistics.
 */
export async function getAdherenceHistory(params: {
  userId: string;
  circleId: string;
  startDate: string;
  endDate: string;
}): Promise<{
  occurrences: DoseOccurrence[];
  stats: {
    total: number;
    taken: number;
    unconfirmedMissed: number;
    pending: number;
    adherenceRatePercent: number;
  };
}> {
  await requireCircleAccess(params.userId, params.circleId);
  const db = getDb();

  const occurrences = await db
    .collection<DoseOccurrence>("dose_occurrences")
    .find({
      circleId: params.circleId,
      scheduledDate: { $gte: params.startDate, $lte: params.endDate },
    })
    .sort({ scheduledDate: -1, scheduledTime: -1 })
    .toArray();

  let taken = 0;
  let unconfirmedMissed = 0;
  let pending = 0;

  for (const occ of occurrences) {
    if (occ.status === "taken") taken++;
    else if (occ.status === "unconfirmed_missed") unconfirmedMissed++;
    else pending++;
  }

  const evaluated = taken + unconfirmedMissed;
  const adherenceRatePercent =
    evaluated > 0 ? Math.round((taken / evaluated) * 100) : 100;

  return {
    occurrences,
    stats: {
      total: occurrences.length,
      taken,
      unconfirmedMissed,
      pending,
      adherenceRatePercent,
    },
  };
}
