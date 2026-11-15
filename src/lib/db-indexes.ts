import "server-only";
import type { Db } from "mongodb";

/**
 * Ensures required unique and performance indexes exist in MongoDB.
 * Called lazily or at initialization time.
 */
export async function ensureDatabaseIndexes(db: Db): Promise<void> {
  // Memberships: unique compound index prevents duplicate circle membership
  await db
    .collection("memberships")
    .createIndex(
      { circleId: 1, userId: 1 },
      { unique: true, name: "uniq_circle_user" },
    );
  await db
    .collection("memberships")
    .createIndex({ userId: 1 }, { name: "idx_user_circles" });

  // Invites: fast lookup by code hash, expiry and circle lookup
  await db
    .collection("invites")
    .createIndex({ codeHash: 1 }, { name: "idx_invite_codehash" });
  await db
    .collection("invites")
    .createIndex({ circleId: 1 }, { name: "idx_circle_invites" });

  // Medications: active medications per circle
  await db
    .collection("medications")
    .createIndex(
      { circleId: 1, active: 1 },
      { name: "idx_circle_active_meds" },
    );

  // Dose occurrences: unique compound index prevents duplicate schedule entries
  await db
    .collection("dose_occurrences")
    .createIndex(
      { medicationId: 1, scheduledDate: 1, scheduledTime: 1 },
      { unique: true, name: "uniq_med_date_time" },
    );
  await db
    .collection("dose_occurrences")
    .createIndex(
      { circleId: 1, scheduledDate: 1 },
      { name: "idx_circle_scheduled_date" },
    );
  await db
    .collection("dose_occurrences")
    .createIndex(
      { status: 1, scheduledTimestamp: 1 },
      { name: "idx_status_scheduled_timestamp" },
    );

  // Appointments: query upcoming appointments per circle
  await db
    .collection("appointments")
    .createIndex(
      { circleId: 1, scheduledTimestamp: 1 },
      { name: "idx_circle_appts_time" },
    );

  // Care alerts: lookup alerts by circle and status (e.g. pending follow-ups)
  await db
    .collection("care_alerts")
    .createIndex(
      { circleId: 1, status: 1 },
      { name: "idx_circle_alert_status" },
    );
  await db
    .collection("care_alerts")
    .createIndex({ referenceId: 1 }, { name: "idx_alert_reference" });

  // Reminder delivery jobs: unique idempotencyKey ensures duplicate jobs are never created
  await db
    .collection("reminder_jobs")
    .createIndex(
      { idempotencyKey: 1 },
      { unique: true, name: "uniq_reminder_idempotency" },
    );
  await db
    .collection("reminder_jobs")
    .createIndex({ status: 1, scheduledFor: 1 }, { name: "idx_due_reminders" });
  await db
    .collection("reminder_jobs")
    .createIndex({ circleId: 1 }, { name: "idx_circle_reminders" });
}
