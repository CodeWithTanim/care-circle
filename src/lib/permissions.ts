import "server-only";
import { getDb } from "@/lib/db";
import type { Circle, CircleRole, Membership } from "@/lib/models";

export class AuthorizationError extends Error {
  status: number;
  constructor(message: string, status: number = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

/**
 * Fetch a user's membership in a specific circle.
 */
export async function getCircleMembership(
  userId: string,
  circleId: string,
): Promise<Membership | null> {
  const db = getDb();
  const membership = await db.collection<Membership>("memberships").findOne({
    circleId,
    userId,
  });
  return membership;
}

/**
 * Require that a user has active membership in a circle, and optionally check role.
 * Throws AuthorizationError if unauthenticated or forbidden.
 */
export async function requireCircleAccess(
  userId: string,
  circleId: string,
  allowedRoles?: CircleRole[],
): Promise<{ membership: Membership; circle: Circle }> {
  if (!userId) {
    throw new AuthorizationError("Authentication required", 401);
  }
  if (!circleId) {
    throw new AuthorizationError("Circle ID is required", 400);
  }

  const db = getDb();
  const [membership, circle] = await Promise.all([
    db.collection<Membership>("memberships").findOne({ circleId, userId }),
    db.collection<Circle>("circles").findOne({ _id: circleId }),
  ]);

  if (!circle) {
    throw new AuthorizationError("Care circle not found", 404);
  }

  if (!membership) {
    throw new AuthorizationError(
      "You are not a member of this care circle",
      403,
    );
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new AuthorizationError(
      `Role '${membership.role}' does not have permission for this action`,
      403,
    );
  }

  return { membership, circle };
}

/**
 * Checks whether a member can confirm doses (take/snooze).
 * Allowed for:
 * 1. Owner
 * 2. Caregiver
 * 3. The elder/care recipient themselves if they are linked as recipientUserId
 */
export function canConfirmDose(
  membership: Membership,
  circle: Circle,
): boolean {
  if (membership.role === "owner" || membership.role === "caregiver") {
    return true;
  }
  if (circle.isRecipientUser && circle.createdBy === membership.userId) {
    return true;
  }
  if (circle.recipientUserId && circle.recipientUserId === membership.userId) {
    return true;
  }
  return false;
}
