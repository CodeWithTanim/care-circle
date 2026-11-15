import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { Appointment } from "@/lib/models";
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

  const scheduledTimestamp = localToUtc(
    validated.localDate,
    validated.localTime,
    circle.timezone,
  );

  const updateFields: Partial<Appointment> = {
    title: validated.title,
    provider: validated.provider,
    location: validated.location,
    scheduledTimestamp,
    localDate: validated.localDate,
    localTime: validated.localTime,
    notes: validated.notes,
    status: validated.status,
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
