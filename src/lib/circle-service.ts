import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type {
  Circle,
  CircleRole,
  Invite,
  Membership,
  MemberNotificationPreferences,
} from "@/lib/models";
import { AuthorizationError, requireCircleAccess } from "@/lib/permissions";
import {
  createCircleSchema,
  createInviteSchema,
  joinCircleSchema,
  transferOwnershipSchema,
  updateCircleSchema,
  updateNotificationPreferencesSchema,
} from "@/lib/validation";

/**
 * Generate a friendly, readable secure passcode.
 * E.g., CARE-7M4K-9P2R
 */
export function generatePasscode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 30 non-ambiguous chars
  const bytes = randomBytes(8);
  let code = "CARE-";
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
    if (i === 3) code += "-";
  }
  return code;
}

export function hashPasscode(passcode: string): string {
  const normalized = passcode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export async function createCircle(params: {
  userId: string;
  userEmail: string;
  userName: string;
  input: unknown;
}): Promise<{ circle: Circle; membership: Membership }> {
  const validated = createCircleSchema.parse(params.input);
  const db = getDb();
  const now = new Date();
  const circleId = randomUUID();

  const circle: Circle = {
    _id: circleId,
    name: validated.name,
    recipientName: validated.recipientName,
    recipientRelationship: validated.recipientRelationship,
    isRecipientUser: validated.isRecipientUser,
    recipientUserId: validated.isRecipientUser ? params.userId : null,
    timezone: validated.timezone,
    sharingConsent: validated.sharingConsent,
    consentNotes: validated.consentNotes,
    createdAt: now,
    updatedAt: now,
    createdBy: params.userId,
  };

  const membership: Membership = {
    _id: randomUUID(),
    circleId,
    userId: params.userId,
    role: "owner",
    email: params.userEmail,
    name: params.userName,
    joinedAt: now,
    notifications: {
      upcomingDoses: true,
      missedDoses: true,
      appointments: true,
    },
  };

  await db.collection<Circle>("circles").insertOne(circle);
  await db.collection<Membership>("memberships").insertOne(membership);

  return { circle, membership };
}

export async function updateCircle(params: {
  userId: string;
  circleId: string;
  input: unknown;
}): Promise<Circle> {
  await requireCircleAccess(params.userId, params.circleId, [
    "owner",
    "caregiver",
  ]);
  const validated = updateCircleSchema.parse(params.input);
  const db = getDb();
  const now = new Date();

  const updateFields: Partial<Circle> = { updatedAt: now };
  if (validated.name !== undefined) updateFields.name = validated.name;
  if (validated.timezone !== undefined)
    updateFields.timezone = validated.timezone;
  if (validated.sharingConsent !== undefined)
    updateFields.sharingConsent = validated.sharingConsent;
  if (validated.consentNotes !== undefined)
    updateFields.consentNotes = validated.consentNotes;

  const result = await db
    .collection<Circle>("circles")
    .findOneAndUpdate(
      { _id: params.circleId },
      { $set: updateFields },
      { returnDocument: "after" },
    );

  if (!result) {
    throw new AuthorizationError("Care circle not found", 404);
  }
  return result;
}

export async function getUserCircles(
  userId: string,
): Promise<Array<{ circle: Circle; role: CircleRole; memberCount: number }>> {
  const db = getDb();
  const memberships = await db
    .collection<Membership>("memberships")
    .find({ userId })
    .toArray();

  if (memberships.length === 0) return [];

  const circleIds = memberships.map((m) => m.circleId);
  const circles = await db
    .collection<Circle>("circles")
    .find({ _id: { $in: circleIds } })
    .toArray();

  const circleMap = new Map(circles.map((c) => [c._id, c]));

  // Get member counts for each circle
  const counts = await db
    .collection<Membership>("memberships")
    .aggregate<{ _id: string; count: number }>([
      { $match: { circleId: { $in: circleIds } } },
      { $group: { _id: "$circleId", count: { $sum: 1 } } },
    ])
    .toArray();

  const countMap = new Map(counts.map((c) => [c._id, c.count]));

  return memberships
    .map((m) => {
      const circle = circleMap.get(m.circleId);
      if (!circle) return null;
      return {
        circle,
        role: m.role,
        memberCount: countMap.get(m.circleId) ?? 1,
      };
    })
    .filter(
      (
        item,
      ): item is { circle: Circle; role: CircleRole; memberCount: number } =>
        item !== null,
    );
}

export async function getCircleDetails(
  userId: string,
  circleId: string,
): Promise<{
  circle: Circle;
  membership: Membership;
  members: Membership[];
  activeInvites?: Invite[];
}> {
  const { membership, circle } = await requireCircleAccess(userId, circleId);
  const db = getDb();

  const members = await db
    .collection<Membership>("memberships")
    .find({ circleId })
    .sort({ joinedAt: 1 })
    .toArray();

  let activeInvites: Invite[] | undefined = undefined;
  if (membership.role === "owner") {
    activeInvites = await db
      .collection<Invite>("invites")
      .find({
        circleId,
        revoked: false,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  return { circle, membership, members, activeInvites };
}

export async function createInvite(params: {
  userId: string;
  circleId: string;
  input: unknown;
}): Promise<{ invite: Invite; rawPasscode: string }> {
  await requireCircleAccess(params.userId, params.circleId, ["owner"]);
  const validated = createInviteSchema.parse(params.input);

  const rawPasscode = generatePasscode();
  const codeHash = hashPasscode(rawPasscode);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + validated.expiresInHours * 3600 * 1000,
  );

  const invite: Invite = {
    _id: randomUUID(),
    circleId: params.circleId,
    codeHash,
    role: validated.role,
    label: validated.label,
    isRecipientInvite: validated.isRecipientInvite || false,
    createdBy: params.userId,
    createdAt: now,
    expiresAt,
    maxUses: validated.maxUses,
    useCount: 0,
    failedAttempts: 0,
    revoked: false,
  };

  const db = getDb();
  await db.collection<Invite>("invites").insertOne(invite);

  return { invite, rawPasscode };
}

export async function revokeInvite(params: {
  userId: string;
  circleId: string;
  inviteId: string;
}): Promise<void> {
  await requireCircleAccess(params.userId, params.circleId, ["owner"]);
  const db = getDb();
  const result = await db
    .collection<Invite>("invites")
    .updateOne(
      { _id: params.inviteId, circleId: params.circleId },
      { $set: { revoked: true } },
    );
  if (result.matchedCount === 0) {
    throw new AuthorizationError("Invite not found", 404);
  }
}

export async function joinCircleWithPasscode(params: {
  userId: string;
  userEmail: string;
  userName: string;
  passcode: string;
}): Promise<{
  circle: Circle;
  membership: Membership;
  alreadyMember: boolean;
}> {
  const validated = joinCircleSchema.parse({ passcode: params.passcode });
  const codeHash = hashPasscode(validated.passcode);
  const db = getDb();

  // Rate limiting attempts: track failed attempts on IP/user if needed
  const invite = await db.collection<Invite>("invites").findOne({ codeHash });

  if (!invite) {
    throw new AuthorizationError("Invalid or expired invitation passcode", 400);
  }

  const circle = await db.collection<Circle>("circles").findOne({
    _id: invite.circleId,
  });
  if (!circle) {
    throw new AuthorizationError("Associated care circle not found", 404);
  }

  // Check if user is already a member before checking use count/expiry
  const existingMembership = await db
    .collection<Membership>("memberships")
    .findOne({ circleId: circle._id, userId: params.userId });

  if (existingMembership) {
    return {
      circle,
      membership: existingMembership,
      alreadyMember: true,
    };
  }

  if (invite.revoked) {
    throw new AuthorizationError("This invitation has been revoked", 400);
  }

  if (new Date() > invite.expiresAt) {
    throw new AuthorizationError("This invitation passcode has expired", 400);
  }

  if (invite.useCount >= invite.maxUses) {
    throw new AuthorizationError(
      "This invitation passcode has already reached its maximum uses",
      400,
    );
  }

  // Atomically claim one use of the invite to prevent race conditions
  const claimResult = await db.collection<Invite>("invites").findOneAndUpdate(
    {
      _id: invite._id,
      useCount: { $lt: invite.maxUses },
      revoked: false,
      expiresAt: { $gt: new Date() },
    },
    { $inc: { useCount: 1 } },
    { returnDocument: "after" },
  );

  if (!claimResult) {
    throw new AuthorizationError(
      "This invitation code has just expired or reached its maximum uses",
      400,
    );
  }

  const membership: Membership = {
    _id: randomUUID(),
    circleId: circle._id,
    userId: params.userId,
    role: invite.role,
    email: params.userEmail,
    name: params.userName,
    joinedAt: new Date(),
    notifications: {
      upcomingDoses: true,
      missedDoses: true,
      appointments: true,
    },
  };

  try {
    await db.collection<Membership>("memberships").insertOne(membership);
    if (invite.isRecipientInvite) {
      await db
        .collection<Circle>("circles")
        .updateOne(
          { _id: circle._id },
          { $set: { recipientUserId: params.userId, updatedAt: new Date() } },
        );
    }
  } catch (err: unknown) {
    // Duplicate key safety
    const existing = await db
      .collection<Membership>("memberships")
      .findOne({ circleId: circle._id, userId: params.userId });
    if (existing) {
      return { circle, membership: existing, alreadyMember: true };
    }
    throw err;
  }

  return { circle, membership, alreadyMember: false };
}

export async function transferOwnership(params: {
  userId: string;
  circleId: string;
  input: unknown;
}): Promise<void> {
  const { membership } = await requireCircleAccess(
    params.userId,
    params.circleId,
    ["owner"],
  );
  const validated = transferOwnershipSchema.parse(params.input);

  if (validated.newOwnerUserId === params.userId) {
    throw new AuthorizationError(
      "You are already the owner of this circle",
      400,
    );
  }

  const db = getDb();
  const targetMember = await db.collection<Membership>("memberships").findOne({
    circleId: params.circleId,
    userId: validated.newOwnerUserId,
  });

  if (!targetMember) {
    throw new AuthorizationError("Target member not found in this circle", 404);
  }

  // Update new owner
  await db
    .collection<Membership>("memberships")
    .updateOne({ _id: targetMember._id }, { $set: { role: "owner" } });

  // Demote previous owner to caregiver
  await db
    .collection<Membership>("memberships")
    .updateOne({ _id: membership._id }, { $set: { role: "caregiver" } });

  // Update circle recipientUserId if the new owner is the recipient
  await db.collection<Circle>("circles").updateOne(
    { _id: params.circleId },
    {
      $set: {
        updatedAt: new Date(),
        recipientUserId: validated.newOwnerUserId,
      },
    },
  );
}

export async function updateMemberRole(params: {
  userId: string;
  circleId: string;
  targetUserId: string;
  newRole: "caregiver" | "family";
}): Promise<void> {
  await requireCircleAccess(params.userId, params.circleId, ["owner"]);
  if (params.targetUserId === params.userId) {
    throw new AuthorizationError(
      "Cannot change your own role as owner. Transfer ownership instead.",
      400,
    );
  }

  const db = getDb();
  const result = await db
    .collection<Membership>("memberships")
    .updateOne(
      { circleId: params.circleId, userId: params.targetUserId },
      { $set: { role: params.newRole } },
    );

  if (result.matchedCount === 0) {
    throw new AuthorizationError("Member not found in this circle", 404);
  }
}

export async function removeMember(params: {
  userId: string;
  circleId: string;
  targetUserId: string;
}): Promise<void> {
  const { membership } = await requireCircleAccess(
    params.userId,
    params.circleId,
  );
  const isSelf = params.userId === params.targetUserId;
  const isOwner = membership.role === "owner";

  if (!isSelf && !isOwner) {
    throw new AuthorizationError(
      "Only the circle owner can remove other members",
      403,
    );
  }

  const db = getDb();
  const target = await db.collection<Membership>("memberships").findOne({
    circleId: params.circleId,
    userId: params.targetUserId,
  });

  if (!target) {
    throw new AuthorizationError("Member not found", 404);
  }

  if (target.role === "owner") {
    throw new AuthorizationError(
      "Circle owner cannot leave or be removed without transferring ownership first",
      400,
    );
  }

  await db.collection<Membership>("memberships").deleteOne({ _id: target._id });
}

export async function updateNotificationPreferences(params: {
  userId: string;
  circleId: string;
  input: unknown;
}): Promise<MemberNotificationPreferences> {
  const { membership } = await requireCircleAccess(
    params.userId,
    params.circleId,
  );
  const validated = updateNotificationPreferencesSchema.parse(params.input);

  const db = getDb();
  await db
    .collection<Membership>("memberships")
    .updateOne({ _id: membership._id }, { $set: { notifications: validated } });

  return validated;
}
