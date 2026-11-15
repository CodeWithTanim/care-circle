import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import {
  type EmailDeliveryResult,
  getEmailProvider,
} from "@/lib/email/provider";
import {
  appointmentReminderTemplate,
  missedDoseAlertTemplate,
  upcomingDoseTemplate,
} from "@/lib/email/templates";
import { syncCircleDosesAndOverdue } from "@/lib/medication-service";
import type {
  Appointment,
  Circle,
  DoseOccurrence,
  Medication,
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

  // Proactively create due occurrences and advance overdue doses across local window
  // completely independent of page visits.
  await syncCircleDosesAndOverdue(circleId, now);

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

    const revision = appt.revision ?? 1;
    for (const m of members) {
      if (!m.notifications?.appointments) continue;

      const idempotencyKey = `appointment:${appt._id}:r${revision}:${m.email}`;
      const job: ReminderJob = {
        _id: randomUUID(),
        circleId,
        jobType: "appointment",
        referenceId: appt._id,
        idempotencyKey,
        scheduleRevision: revision,
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

  const maxBatch = 50;
  const startTime = Date.now();
  const leaseCutoff = new Date(now.getTime() - 5 * 60 * 1000); // 5 min lease

  // 1. Reconcile exhausted stale claims where a worker crashed on its final attempt
  await db.collection<ReminderJob>("reminder_jobs").updateMany(
    {
      status: "processing",
      claimedAt: { $lt: leaseCutoff },
      $expr: { $gte: ["$attempts", { $ifNull: ["$maxAttempts", 3] }] },
    },
    {
      $set: {
        status: "failed",
        lastError: "Worker lease expired with retry attempts exhausted",
        updatedAt: now,
      },
    },
  );

  // 2. Process due jobs with atomic claim and lease recovery
  while (processed < maxBatch && Date.now() - startTime < 25000) {
    const claimToken = `${workerId}-${randomUUID()}`;
    const job = await db
      .collection<ReminderJob>("reminder_jobs")
      .findOneAndUpdate(
        {
          $or: [
            {
              status: "pending",
              scheduledFor: { $lte: now },
              $expr: { $lt: ["$attempts", { $ifNull: ["$maxAttempts", 3] }] },
            },
            {
              status: "processing",
              claimedAt: { $lt: leaseCutoff },
              $expr: { $lt: ["$attempts", { $ifNull: ["$maxAttempts", 3] }] },
            },
          ],
        },
        {
          $set: {
            status: "processing",
            claimedAt: now,
            claimedByWorker: workerId,
            claimToken: claimToken,
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
      // 1. Recheck circle and sharing consent
      const circle = await db
        .collection<Circle>("circles")
        .findOne({ _id: job.circleId });
      if (!circle) {
        await cancelJob(
          job._id,
          "Care circle deleted",
          workerId,
          job.claimToken,
        );
        cancelled++;
        continue;
      }

      if (!circle.sharingConsent) {
        await cancelJob(
          job._id,
          "Circle sharing consent revoked",
          workerId,
          job.claimToken,
        );
        cancelled++;
        continue;
      }

      // 2. Recheck current recipient membership and notification preferences
      const member = await db
        .collection<Membership>("memberships")
        .findOne({ circleId: job.circleId, userId: job.recipientUserId });

      if (!member) {
        await cancelJob(
          job._id,
          "Recipient is no longer a member of this care circle",
          workerId,
          job.claimToken,
        );
        cancelled++;
        continue;
      }

      if (
        job.jobType === "upcoming_dose" &&
        !member.notifications?.upcomingDoses
      ) {
        await cancelJob(
          job._id,
          "Recipient opted out of upcoming dose notifications",
          workerId,
          job.claimToken,
        );
        cancelled++;
        continue;
      }

      if (job.jobType === "missed_dose" && !member.notifications?.missedDoses) {
        await cancelJob(
          job._id,
          "Recipient opted out of missed dose alerts",
          workerId,
          job.claimToken,
        );
        cancelled++;
        continue;
      }

      if (
        job.jobType === "appointment" &&
        !member.notifications?.appointments
      ) {
        await cancelJob(
          job._id,
          "Recipient opted out of appointment reminders",
          workerId,
          job.claimToken,
        );
        cancelled++;
        continue;
      }

      // Ensure fresh contact identity
      const recipientEmail = member.email;
      const recipientName = member.name;

      // 3. Recheck reference record status before dispatch
      let deliveryRes: EmailDeliveryResult | undefined;

      if (job.jobType === "upcoming_dose") {
        const dose = await db
          .collection<DoseOccurrence>("dose_occurrences")
          .findOne({ _id: job.referenceId });

        if (
          !dose ||
          dose.status === "taken" ||
          dose.status === "unconfirmed_missed"
        ) {
          await cancelJob(
            job._id,
            !dose
              ? "Dose record not found"
              : dose.status === "taken"
                ? "Dose already confirmed taken"
                : "Dose is overdue and marked missed",
            workerId,
            job.claimToken,
          );
          cancelled++;
          continue;
        }

        const med = await db
          .collection<Medication>("medications")
          .findOne({ _id: dose.medicationId });
        if (!med || !med.active) {
          await cancelJob(
            job._id,
            "Medication was archived or deleted",
            workerId,
            job.claimToken,
          );
          cancelled++;
          continue;
        }
        if (med.endDate && med.endDate < dose.scheduledDate) {
          await cancelJob(
            job._id,
            "Medication schedule ended",
            workerId,
            job.claimToken,
          );
          cancelled++;
          continue;
        }

        const template = upcomingDoseTemplate({
          recipientName,
          careRecipientName: circle.recipientName,
          medicationName: dose.medicationName,
          dosage: dose.dosage,
          scheduledTime: dose.scheduledTime,
          circleId: job.circleId,
        });

        deliveryRes = await provider.sendEmail({
          to: recipientEmail,
          toName: recipientName,
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
          await cancelJob(
            job._id,
            !dose ? "Dose record not found" : "Dose already taken",
            workerId,
            job.claimToken,
          );
          cancelled++;
          continue;
        }

        const template = missedDoseAlertTemplate({
          recipientName,
          careRecipientName: circle.recipientName,
          medicationName: dose.medicationName,
          scheduledTime: dose.scheduledTime,
          circleId: job.circleId,
        });

        deliveryRes = await provider.sendEmail({
          to: recipientEmail,
          toName: recipientName,
          subject: template.subject,
          text: template.text,
          html: template.html,
          idempotencyKey: job.idempotencyKey,
        });
      } else if (job.jobType === "appointment") {
        const appt = await db
          .collection<Appointment>("appointments")
          .findOne({ _id: job.referenceId });

        if (
          !appt ||
          appt.status === "cancelled" ||
          appt.status === "completed" ||
          (job.scheduleRevision !== undefined &&
            appt.revision !== undefined &&
            job.scheduleRevision !== appt.revision)
        ) {
          await cancelJob(
            job._id,
            !appt
              ? "Appointment not found"
              : appt.status !== "scheduled"
                ? `Appointment is ${appt.status}`
                : "Appointment schedule superseded by newer revision",
            workerId,
            job.claimToken,
          );
          cancelled++;
          continue;
        }

        const template = appointmentReminderTemplate({
          recipientName,
          careRecipientName: circle.recipientName,
          title: appt.title,
          provider: appt.provider,
          location: appt.location,
          dateStr: appt.localDate,
          timeStr: appt.localTime,
          circleId: job.circleId,
        });

        deliveryRes = await provider.sendEmail({
          to: recipientEmail,
          toName: recipientName,
          subject: template.subject,
          text: template.text,
          html: template.html,
          idempotencyKey: job.idempotencyKey,
        });
      }

      // Mark sent successfully with worker fencing and claim token check
      const updateRes = await db
        .collection<ReminderJob>("reminder_jobs")
        .updateOne(
          {
            _id: job._id,
            status: "processing",
            claimedByWorker: workerId,
            ...(job.claimToken ? { claimToken: job.claimToken } : {}),
          },
          {
            $set: {
              status: "sent",
              sentAt: new Date(),
              deliveryMode: deliveryRes?.isTestTransport
                ? "test_transport"
                : "live",
              providerMessageId: deliveryRes?.messageId ?? null,
              updatedAt: new Date(),
            },
          },
        );

      if (updateRes.matchedCount > 0) {
        sent++;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      failed++;
      // Delayed retry: exponential backoff (5m, 10m, 20m)
      const backoffMinutes = Math.pow(2, job.attempts) * 5;
      const nextScheduledFor = new Date(
        now.getTime() + backoffMinutes * 60 * 1000,
      );

      await db.collection<ReminderJob>("reminder_jobs").updateOne(
        {
          _id: job._id,
          status: "processing",
          claimedByWorker: workerId,
          ...(job.claimToken ? { claimToken: job.claimToken } : {}),
        },
        {
          $set: {
            status: job.attempts < job.maxAttempts ? "pending" : "failed",
            scheduledFor: nextScheduledFor,
            lastError: errMsg,
            updatedAt: new Date(),
          },
        },
      );
    }
  }

  return { processed, sent, cancelled, failed };
}

async function cancelJob(
  jobId: string,
  reason: string,
  workerId?: string,
  claimToken?: string | null,
): Promise<void> {
  const db = getDb();
  const filter: Record<string, unknown> = { _id: jobId };
  if (workerId) {
    filter.claimedByWorker = workerId;
    filter.status = "processing";
  }
  if (claimToken) {
    filter.claimToken = claimToken;
  }
  await db.collection<ReminderJob>("reminder_jobs").updateOne(filter, {
    $set: {
      status: "cancelled",
      lastError: reason,
      updatedAt: new Date(),
    },
  });
}
