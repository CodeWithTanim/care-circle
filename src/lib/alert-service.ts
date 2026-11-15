import "server-only";
import { getDb } from "@/lib/db";
import type { CareAlert } from "@/lib/models";
import { AuthorizationError, requireCircleAccess } from "@/lib/permissions";

export async function getAlerts(params: {
  userId: string;
  circleId: string;
  status?: "pending" | "acknowledged" | "resolved";
}): Promise<CareAlert[]> {
  await requireCircleAccess(params.userId, params.circleId);
  const db = getDb();

  const query: Record<string, unknown> = { circleId: params.circleId };
  if (params.status) {
    query.status = params.status;
  }

  return db
    .collection<CareAlert>("care_alerts")
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();
}

/**
 * Atomically acknowledge an alert ("I'll handle this").
 * Guarantees that only ONE person can claim the alert if simultaneous users attempt to claim.
 */
export async function acknowledgeAlert(params: {
  userId: string;
  userName: string;
  circleId: string;
  alertId: string;
}): Promise<CareAlert> {
  await requireCircleAccess(params.userId, params.circleId); // Any circle member can claim
  const db = getDb();
  const now = new Date();

  // Atomic claim on pending alert
  const claimed = await db
    .collection<CareAlert>("care_alerts")
    .findOneAndUpdate(
      {
        _id: params.alertId,
        circleId: params.circleId,
        status: "pending",
      },
      {
        $set: {
          status: "acknowledged",
          acknowledgedBy: { userId: params.userId, name: params.userName },
          acknowledgedAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );

  if (claimed) {
    return claimed;
  }

  // If not claimed, check why
  const existing = await db
    .collection<CareAlert>("care_alerts")
    .findOne({ _id: params.alertId, circleId: params.circleId });

  if (!existing) {
    throw new AuthorizationError("Alert not found", 404);
  }

  if (existing.status === "acknowledged") {
    throw new AuthorizationError(
      `This alert was already claimed by ${existing.acknowledgedBy?.name ?? "another member"}`,
      409,
    );
  }

  if (existing.status === "resolved") {
    throw new AuthorizationError("This alert has already been resolved", 400);
  }

  throw new AuthorizationError("Unable to claim alert", 400);
}

/**
 * Resolve an alert with optional follow-up notes.
 * Note: Resolving an alert does NOT mark the medication taken.
 */
export async function resolveAlert(params: {
  userId: string;
  userName: string;
  circleId: string;
  alertId: string;
  input?: unknown;
}): Promise<CareAlert> {
  const { membership } = await requireCircleAccess(
    params.userId,
    params.circleId,
  );
  const db = getDb();
  const now = new Date();

  let notes: string | null = null;
  if (
    params.input &&
    typeof params.input === "object" &&
    "notes" in params.input
  ) {
    const rawNotes = (params.input as { notes?: unknown }).notes;
    if (typeof rawNotes === "string" && rawNotes.trim().length > 0) {
      notes = rawNotes.trim().slice(0, 300);
    }
  }

  const alert = await db
    .collection<CareAlert>("care_alerts")
    .findOne({ _id: params.alertId, circleId: params.circleId });

  if (!alert) {
    throw new AuthorizationError("Alert not found", 404);
  }

  // Can resolve if user claimed it, or user is owner/caregiver
  const isClaimer = alert.acknowledgedBy?.userId === params.userId;
  const isPrivileged =
    membership.role === "owner" || membership.role === "caregiver";

  if (!isClaimer && !isPrivileged) {
    throw new AuthorizationError(
      "Only the person who claimed this alert, or a caregiver/owner, can resolve it",
      403,
    );
  }

  const updated = await db
    .collection<CareAlert>("care_alerts")
    .findOneAndUpdate(
      { _id: params.alertId },
      {
        $set: {
          status: "resolved",
          resolvedBy: { userId: params.userId, name: params.userName },
          resolvedAt: now,
          resolutionNotes: notes,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );

  return updated!;
}
