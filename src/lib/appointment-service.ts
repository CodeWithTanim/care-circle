import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { Appointment, ReminderJob } from "@/lib/models";
import { AuthorizationError, requireCircleAccess } from "@/lib/permissions";
import { localToUtc } from "@/lib/timezone";
import {
  createAppointmentSchema,
  updateAppointmentSchema,
} from "@/lib/validation";

export async function createAppointment(params: {
  userId: string;
  circleId: string;
  input: unknown;
}): Promise<Appointment> {
  const { circle } = await requireCircleAccess(params.userId, params.circleId, [
    "owner",
    "caregiver",
  ]);
  const validated = createAppointmentSchema.parse(params.input);
  const db = getDb();
  const now = new Date();

  const scheduledTimestamp = localToUtc(
    validated.localDate,
    validated.localTime,
    circle.timezone,
  );

  const appointment: Appointment = {
    _id: randomUUID(),
    circleId: params.circleId,
    title: validated.title,
    provider: validated.provider,
    location: validated.location,
    scheduledTimestamp,
    localDate: validated.localDate,
    localTime: validated.localTime,
    notes: validated.notes,
    status: "scheduled",
    revision: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: params.userId,
  };

  await db.collection<Appointment>("appointments").insertOne(appointment);
  return appointment;
}

export async function updateAppointment(params: {
  userId: string;
  circleId: string;
  appointmentId: string;
  input: unknown;
}): Promise<Appointment> {
  const { circle } = await requireCircleAccess(params.userId, params.circleId, [
    "owner",
    "caregiver",
  ]);
  const validated = updateAppointmentSchema.parse(params.input);
  const db = getDb();
  const now = new Date();

  const existing = await db
    .collection<Appointment>("appointments")
    .findOne({ _id: params.appointmentId, circleId: params.circleId });
  if (!existing) {
    throw new AuthorizationError("Appointment not found", 404);
  }

  const scheduledTimestamp = localToUtc(
    validated.localDate,
    validated.localTime,
    circle.timezone,
  );

  const nextRevision = (existing.revision ?? 1) + 1;

  const updateFields: Partial<Appointment> = {
    title: validated.title,
    provider: validated.provider,
    location: validated.location,
    scheduledTimestamp,
    localDate: validated.localDate,
    localTime: validated.localTime,
    notes: validated.notes,
    status: validated.status,
    revision: nextRevision,
    updatedAt: now,
  };

  const result = await db
    .collection<Appointment>("appointments")
    .findOneAndUpdate(
      { _id: params.appointmentId, circleId: params.circleId },
      { $set: updateFields },
      { returnDocument: "after" },
    );

  if (!result) {
    throw new AuthorizationError("Appointment not found", 404);
  }

  // Reconcile reminder jobs: cancel pending and processing jobs for previous schedule
  if (result.status === "cancelled" || result.status === "completed") {
    await db.collection<ReminderJob>("reminder_jobs").updateMany(
      {
        referenceId: params.appointmentId,
        status: { $in: ["pending", "processing"] },
      },
      {
        $set: {
          status: "cancelled",
          lastError: `Appointment marked as ${result.status}`,
          updatedAt: now,
        },
      },
    );
  } else {
    // If appointment time/date changed, cancel obsolete reminders so fresh revision is scheduled
    await db.collection<ReminderJob>("reminder_jobs").updateMany(
      {
        referenceId: params.appointmentId,
        status: { $in: ["pending", "processing"] },
      },
      {
        $set: {
          status: "cancelled",
          lastError: `Appointment schedule updated to revision ${nextRevision}`,
          updatedAt: now,
        },
      },
    );
  }

  return result;
}

export async function cancelAppointment(params: {
  userId: string;
  circleId: string;
  appointmentId: string;
}): Promise<Appointment> {
  await requireCircleAccess(params.userId, params.circleId, [
    "owner",
    "caregiver",
  ]);
  const db = getDb();
  const now = new Date();

  const result = await db
    .collection<Appointment>("appointments")
    .findOneAndUpdate(
      { _id: params.appointmentId, circleId: params.circleId },
      { $set: { status: "cancelled", updatedAt: now } },
      { returnDocument: "after" },
    );

  if (!result) {
    throw new AuthorizationError("Appointment not found", 404);
  }

  // Cancel any pending reminder jobs for this appointment
  await db.collection<ReminderJob>("reminder_jobs").updateMany(
    { referenceId: params.appointmentId, status: "pending" },
    {
      $set: {
        status: "cancelled",
        lastError: "Appointment was cancelled",
        updatedAt: now,
      },
    },
  );

  return result;
}

export async function getAppointments(params: {
  userId: string;
  circleId: string;
  upcomingOnly?: boolean;
}): Promise<Appointment[]> {
  await requireCircleAccess(params.userId, params.circleId);
  const db = getDb();

  const query: Record<string, unknown> = { circleId: params.circleId };
  if (params.upcomingOnly) {
    // Include appointments from 2 hours ago onwards
    const cutoff = new Date(Date.now() - 2 * 3600 * 1000);
    query.scheduledTimestamp = { $gte: cutoff };
    query.status = "scheduled";
  }

  return db
    .collection<Appointment>("appointments")
    .find(query)
    .sort({ scheduledTimestamp: 1 })
    .toArray();
}
