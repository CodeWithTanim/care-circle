import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { getEmailProvider } from "@/lib/email/provider";
import {
  appointmentReminderTemplate,
  missedDoseAlertTemplate,
  upcomingDoseTemplate,
} from "@/lib/email/templates";
import type {
  Appointment,
  Circle,
  DoseOccurrence,
  Membership,
  ReminderJob,
} from "@/lib/models";

/**
 * Generates idempotent reminder jobs for a care circle's doses and appointments.
 */
export async function generateReminderJobsForCircle(
  circleId: string,
  now: Date = new Date(),
): Promise<number> {
  const db = getDb();
  const circle = await db
    .collection<Circle>("circles")
    .findOne({ _id: circleId });
  if (!circle) return 0;

  const members = await db
    .collection<Membership>("memberships")
    .find({ circleId })
    .toArray();

  if (members.length === 0) return 0;

  let createdCount = 0;
  const next24h = new Date(now.getTime() + 24 * 3600 * 1000);
  const past24h = new Date(now.getTime() - 24 * 3600 * 1000);

  // 1. Doses scheduled within the past 24h to next 24h
  const doses = await db
    .collection<DoseOccurrence>("dose_occurrences")
    .find({
      circleId,
      scheduledTimestamp: { $gte: past24h, $lte: next24h },
    })
    .toArray();

  for (const dose of doses) {
    if (dose.status === "scheduled" || dose.status === "snoozed") {
      // Reminder 15 minutes before scheduled dose
      const remindTime = new Date(
        dose.scheduledTimestamp.getTime() - 15 * 60 * 1000,
      );

      for (const m of members) {
        if (!m.notifications?.upcomingDoses) continue;

        const idempotencyKey = `upcoming_dose:${dose._id}:${m.email}`;
        const job: ReminderJob = {
          _id: randomUUID(),
          circleId,
          jobType: "upcoming_dose",
          referenceId: dose._id,
          idempotencyKey,
          recipientEmail: m.email,
          recipientName: m.name,
          recipientUserId: m.userId,
          scheduledFor: remindTime,
          status: "pending",
          attempts: 0,
          maxAttempts: 3,
          createdAt: now,
          updatedAt: now,
        };

        const res = await db
          .collection<ReminderJob>("reminder_jobs")
          .updateOne(
            { idempotencyKey },
            { $setOnInsert: job },
            { upsert: true },
          );
        if (res.upsertedCount > 0) createdCount++;
      }
    } else if (dose.status === "unconfirmed_missed") {
      // Missed dose alerts for opted-in members
      for (const m of members) {
        if (!m.notifications?.missedDoses) continue;

        const idempotencyKey = `missed_dose:${dose._id}:${m.email}`;
        const job: ReminderJob = {
          _id: randomUUID(),
          circleId,
          jobType: "missed_dose",
          referenceId: dose._id,
          idempotencyKey,
          recipientEmail: m.email,
          recipientName: m.name,
          recipientUserId: m.userId,
          scheduledFor: now, // send promptly
          status: "pending",
          attempts: 0,
          maxAttempts: 3,
          createdAt: now,
          updatedAt: now,
        };

        const res = await db
          .collection<ReminderJob>("reminder_jobs")
          .updateOne(
            { idempotencyKey },
            { $setOnInsert: job },
            { upsert: true },
          );
        if (res.upsertedCount > 0) createdCount++;
      }
    }
  }

  // 2. Upcoming appointments: appointments in next 24h
  const appointments = await db
    .collection<Appointment>("appointments")
    .find({
      circleId,
      status: "scheduled",
      scheduledTimestamp: { $gte: past24h, $lte: next24h },
    })
    .toArray();

  for (const appt of appointments) {
    // 2 hours before appointment
    const remindTime = new Date(
      appt.scheduledTimestamp.getTime() - 2 * 3600 * 1000,
    );

    for (const m of members) {
      if (!m.notifications?.appointments) continue;

      const idempotencyKey = `appointment:${appt._id}:${m.email}`;
      const job: ReminderJob = {
        _id: randomUUID(),
        circleId,
        jobType: "appointment",
        referenceId: appt._id,
        idempotencyKey,
        recipientEmail: m.email,
        recipientName: m.name,
        recipientUserId: m.userId,
        scheduledFor: remindTime,
        status: "pending",
        attempts: 0,
        maxAttempts: 3,
        createdAt: now,
        updatedAt: now,
      };

      const res = await db
        .collection<ReminderJob>("reminder_jobs")
        .updateOne({ idempotencyKey }, { $setOnInsert: job }, { upsert: true });
      if (res.upsertedCount > 0) createdCount++;
    }
  }

  return createdCount;
}

/**
 * Process due reminder jobs atomically.
 * Guarantees that concurrent workers cannot double-process the same job.
 */
export async function processDueReminderJobs(
  workerId: string = `worker-${randomUUID().substring(0, 8)}`,
  now: Date = new Date(),
): Promise<{
  processed: number;
  sent: number;
  cancelled: number;
  failed: number;
}> {
  const db = getDb();
  const provider = getEmailProvider();

  let processed = 0;
  let sent = 0;
  let cancelled = 0;
  let failed = 0;

  // Process due jobs one by one with atomic claim
  while (true) {
    const job = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOneAndUpdate(
        {
          status: "pending",
          scheduledFor: { $lte: now },
          attempts: { $lt: 3 },
        },
        {
          $set: {
            status: "processing",
            claimedAt: now,
            claimedByWorker: workerId,
            updatedAt: now,
          },
          $inc: { attempts: 1 },
        },
        { returnDocument: "after" },
      );

    if (!job) {
      // No more due jobs
      break;
    }

    processed++;

    try {
      const circle = await db
        .collection<Circle>("circles")
        .findOne({ _id: job.circleId });
      if (!circle) {
        await cancelJob(job._id, "Care circle deleted");
        cancelled++;
        continue;
      }

      // Recheck latest state before dispatching
      if (job.jobType === "upcoming_dose") {
        const dose = await db
          .collection<DoseOccurrence>("dose_occurrences")
          .findOne({ _id: job.referenceId });

        if (!dose || dose.status === "taken") {
          // Dose was already taken! Cancel reminder
          await cancelJob(job._id, "Dose already confirmed taken");
          cancelled++;
          continue;
        }

        const template = upcomingDoseTemplate({
          recipientName: job.recipientName,
          careRecipientName: circle.recipientName,
          medicationName: dose.medicationName,
          dosage: dose.dosage,
          scheduledTime: dose.scheduledTime,
          circleId: job.circleId,
        });

        await provider.sendEmail({
          to: job.recipientEmail,
          toName: job.recipientName,
          subject: template.subject,
          text: template.text,
          html: template.html,
          idempotencyKey: job.idempotencyKey,
        });
      } else if (job.jobType === "missed_dose") {
        const dose = await db
          .collection<DoseOccurrence>("dose_occurrences")
          .findOne({ _id: job.referenceId });

        if (!dose || dose.status === "taken") {
          await cancelJob(job._id, "Dose already taken");
          cancelled++;
          continue;
        }

        const template = missedDoseAlertTemplate({
          recipientName: job.recipientName,
          careRecipientName: circle.recipientName,
          medicationName: dose.medicationName,
          scheduledTime: dose.scheduledTime,
          circleId: job.circleId,
        });

        await provider.sendEmail({
          to: job.recipientEmail,
          toName: job.recipientName,
          subject: template.subject,
          text: template.text,
          html: template.html,
          idempotencyKey: job.idempotencyKey,
        });
      } else if (job.jobType === "appointment") {
        const appt = await db
          .collection<Appointment>("appointments")
          .findOne({ _id: job.referenceId });

        if (!appt || appt.status === "cancelled") {
          await cancelJob(job._id, "Appointment cancelled");
          cancelled++;
          continue;
        }

        const template = appointmentReminderTemplate({
          recipientName: job.recipientName,
          careRecipientName: circle.recipientName,
          title: appt.title,
          provider: appt.provider,
          location: appt.location,
          dateStr: appt.localDate,
          timeStr: appt.localTime,
          circleId: job.circleId,
        });

        await provider.sendEmail({
          to: job.recipientEmail,
          toName: job.recipientName,
          subject: template.subject,
          text: template.text,
          html: template.html,
          idempotencyKey: job.idempotencyKey,
        });
      }

      // Mark sent successfully
      await db.collection<ReminderJob>("reminder_jobs").updateOne(
        { _id: job._id },
        {
          $set: {
            status: "sent",
            sentAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
      sent++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      failed++;
      await db.collection<ReminderJob>("reminder_jobs").updateOne(
        { _id: job._id },
        {
          $set: {
            // If attempts < maxAttempts, reset status to pending for retry
            status: job.attempts < job.maxAttempts ? "pending" : "failed",
            lastError: errMsg,
            updatedAt: new Date(),
          },
        },
      );
    }
  }

  return { processed, sent, cancelled, failed };
}

async function cancelJob(jobId: string, reason: string): Promise<void> {
  const db = getDb();
  await db.collection<ReminderJob>("reminder_jobs").updateOne(
    { _id: jobId },
    {
      $set: {
        status: "cancelled",
        lastError: reason,
        updatedAt: new Date(),
      },
    },
  );
}
