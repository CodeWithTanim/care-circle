import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type {
  CareAlert,
  Circle,
  DoseOccurrence,
  Medication,
  ReminderJob,
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
  utcToLocalDate,
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

  // Reconcile future unconfirmed scheduled occurrences and obsolete jobs
  if (validated.active === false) {
    const futureDoses = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .find({
        medicationId: params.medicationId,
        status: { $in: ["scheduled", "snoozed"] },
        scheduledTimestamp: { $gt: now },
      })
      .toArray();

    const futureIds = futureDoses.map((d) => d._id);
    if (futureIds.length > 0) {
      await db.collection<DoseOccurrence>("dose_occurrences").deleteMany({
        _id: { $in: futureIds },
      });
      await db.collection<ReminderJob>("reminder_jobs").updateMany(
        { referenceId: { $in: futureIds }, status: "pending" },
        {
          $set: {
            status: "cancelled",
            lastError: "Medication was archived",
            updatedAt: now,
          },
        },
      );
    }
  } else {
    // Schedule times, dosage, or dates may have changed
    const futureDoses = await db
      .collection<DoseOccurrence>("dose_occurrences")
      .find({
        medicationId: params.medicationId,
        status: { $in: ["scheduled", "snoozed"] },
        scheduledTimestamp: { $gt: now },
      })
      .toArray();

    const allowedTimes = new Set(validated.scheduleTimes);
    const toDeleteIds: string[] = [];

    for (const dose of futureDoses) {
      const isPastEndDate =
        validated.endDate && dose.scheduledDate > validated.endDate;
      const isBeforeStartDate = dose.scheduledDate < validated.startDate;
      const isRemovedTime = !allowedTimes.has(dose.scheduledTime);

      if (isPastEndDate || isBeforeStartDate || isRemovedTime) {
        toDeleteIds.push(dose._id);
      } else {
        await db.collection<DoseOccurrence>("dose_occurrences").updateOne(
          { _id: dose._id },
          {
            $set: {
              medicationName: validated.name,
              dosage: validated.dosage,
              instructions: validated.instructions,
              updatedAt: now,
            },
          },
        );
      }
    }

    if (toDeleteIds.length > 0) {
      await db.collection<DoseOccurrence>("dose_occurrences").deleteMany({
        _id: { $in: toDeleteIds },
      });
      await db.collection<ReminderJob>("reminder_jobs").updateMany(
        { referenceId: { $in: toDeleteIds }, status: "pending" },
        {
          $set: {
            status: "cancelled",
            lastError: "Schedule changed or occurrence removed",
            updatedAt: now,
          },
        },
      );
    }

    // Pre-generate today's occurrences if active today
    const circle = await db
      .collection<Circle>("circles")
      .findOne({ _id: params.circleId });
    if (circle) {
      const today = getTodayLocalDate(circle.timezone);
      await ensureDoseOccurrencesForDate(params.circleId, today);
    }
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

  // Remove future unconfirmed scheduled occurrences and cancel pending reminder jobs
  const futureDoses = await db
    .collection<DoseOccurrence>("dose_occurrences")
    .find({
      medicationId: params.medicationId,
      status: { $in: ["scheduled", "snoozed"] },
      scheduledTimestamp: { $gt: now },
    })
    .toArray();

  const futureIds = futureDoses.map((d) => d._id);
  if (futureIds.length > 0) {
    await db.collection<DoseOccurrence>("dose_occurrences").deleteMany({
      _id: { $in: futureIds },
    });
    await db.collection<ReminderJob>("reminder_jobs").updateMany(
      { referenceId: { $in: futureIds }, status: "pending" },
      {
        $set: {
          status: "cancelled",
          lastError: "Medication was archived",
          updatedAt: now,
        },
      },
    );
  }
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
 * Proactively generates dose occurrences for active medications across a rolling window
 * (2 days catchup, today, and tomorrow) and advances overdue unconfirmed doses to 'unconfirmed_missed'.
 * Operates completely independently of page visits or user browser sessions.
 */
export async function syncCircleDosesAndOverdue(
  circleId: string,
  now: Date = new Date(),
): Promise<void> {
  const db = getDb();
  const circle = await db
    .collection<Circle>("circles")
    .findOne({ _id: circleId });
  if (!circle) return;

  const tz = circle.timezone || "UTC";

  // Rolling window: 2 days catch-up + today + 1 day lookahead
  const dateStrings: string[] = [];
  for (let offsetDays = -2; offsetDays <= 1; offsetDays++) {
    const targetMs = now.getTime() + offsetDays * 24 * 3600 * 1000;
    const { localDate } = utcToLocalDate(new Date(targetMs), tz);
    if (!dateStrings.includes(localDate)) {
      dateStrings.push(localDate);
    }
  }

  for (const dateStr of dateStrings) {
    await ensureDoseOccurrencesForDate(circleId, dateStr);
  }

  // Find all unconfirmed scheduled/snoozed doses whose scheduled time has passed
  const unconfirmedDoses = await db
    .collection<DoseOccurrence>("dose_occurrences")
    .find({
      circleId,
      status: { $in: ["scheduled", "snoozed"] },
      scheduledTimestamp: { $lte: now },
    })
    .toArray();

  for (const dose of unconfirmedDoses) {
    if (
      isDoseOverdue(
        dose.scheduledTimestamp,
        dose.snoozeUntil,
        DEFAULT_GRACE_PERIOD_MINUTES,
        now,
      )
    ) {
      const updateRes = await db
        .collection<DoseOccurrence>("dose_occurrences")
        .updateOne(
          { _id: dose._id, status: { $in: ["scheduled", "snoozed"] } },
          { $set: { status: "unconfirmed_missed", updatedAt: now } },
        );

      if (updateRes.modifiedCount > 0) {
        // Cancel obsolete upcoming_dose reminder jobs
        await db.collection<ReminderJob>("reminder_jobs").updateMany(
          {
            referenceId: dose._id,
            jobType: "upcoming_dose",
            status: "pending",
          },
          {
            $set: {
              status: "cancelled",
              lastError: "Dose is overdue and unconfirmed missed",
              updatedAt: now,
            },
          },
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
            circleId,
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
  const now = new Date();
  const dateStr = params.targetDate ?? getTodayLocalDate(timezone, now);

  await syncCircleDosesAndOverdue(params.circleId, now);
  if (params.targetDate) {
    await ensureDoseOccurrencesForDate(params.circleId, params.targetDate);
  }

  const doses = await db
    .collection<DoseOccurrence>("dose_occurrences")
    .find({ circleId: params.circleId, scheduledDate: dateStr })
    .sort({ scheduledTime: 1, medicationName: 1 })
    .toArray();

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
