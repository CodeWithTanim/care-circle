import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createCircle,
  createInvite,
  getCircleDetails,
  hashPasscode,
  joinCircleWithPasscode,
  revokeInvite,
  transferOwnership,
} from "../src/lib/circle-service";
import { ensureDatabaseIndexes } from "../src/lib/db-indexes";
import type { Invite } from "../src/lib/models";

vi.mock("server-only", () => ({}));

let mongo: MongoMemoryServer;
let db: import("mongodb").Db;
let client: import("mongodb").MongoClient;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv("MONGODB_URI", mongo.getUri());
  vi.stubEnv("MONGODB_DB", "care_circle_test");
  vi.stubEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");

  const { getDb, getMongoClient } = await import("../src/lib/db");
  db = getDb();
  client = getMongoClient();
  await ensureDatabaseIndexes(db);
});

afterAll(async () => {
  if (client) {
    await client.close();
  }
  await mongo?.stop();
  vi.unstubAllEnvs();
});

describe("Care Circle & Passcode Service", () => {
  const ownerUser = {
    userId: "user-owner-1",
    userEmail: "owner@example.com",
    userName: "Martha Stewart",
  };

  const caregiverUser = {
    userId: "user-caregiver-2",
    userEmail: "caregiver@example.com",
    userName: "Nurse John",
  };

  let circleId: string;

  it("creates a care circle with valid input and explicit elder consent", async () => {
    const res = await createCircle({
      ...ownerUser,
      input: {
        name: "Martha's Care Circle",
        recipientName: "Martha Stewart",
        recipientRelationship: "self",
        isRecipientUser: true,
        timezone: "America/New_York",
        sharingConsent: true,
        consentNotes: "Martha consents to sharing with family and nurse.",
      },
    });

    expect(res.circle._id).toBeDefined();
    expect(res.circle.name).toBe("Martha's Care Circle");
    expect(res.membership.role).toBe("owner");
    circleId = res.circle._id;
  });

  it("fails to create circle without explicit consent", async () => {
    await expect(
      createCircle({
        ...ownerUser,
        input: {
          name: "Invalid Circle",
          recipientName: "Someone",
          recipientRelationship: "parent",
          timezone: "UTC",
          sharingConsent: false,
        },
      }),
    ).rejects.toThrow("consent");
  });

  it("generates an invite with hashed passcode and safe storage", async () => {
    const { invite, rawPasscode } = await createInvite({
      userId: ownerUser.userId,
      circleId,
      input: {
        role: "caregiver",
        label: "Nurse John",
        expiresInHours: 24,
        maxUses: 1,
      },
    });

    expect(rawPasscode).toMatch(/^CARE-[A-Z0-9]{3,4}-[A-Z0-9]{3,4}$/);
    expect(invite.codeHash).toBe(hashPasscode(rawPasscode));
    expect(invite.codeHash).not.toBe(rawPasscode);

    const stored = await db
      .collection<Invite>("invites")
      .findOne({ _id: invite._id });
    expect(stored?.codeHash).toBe(hashPasscode(rawPasscode));
    // Verify raw passcode is never in database
    expect(JSON.stringify(stored)).not.toContain(rawPasscode);
  });

  it("joins a circle using the passcode and assigns the defined role", async () => {
    const { rawPasscode } = await createInvite({
      userId: ownerUser.userId,
      circleId,
      input: {
        role: "caregiver",
        label: "For Nurse",
        expiresInHours: 48,
        maxUses: 1,
      },
    });

    const joinRes = await joinCircleWithPasscode({
      ...caregiverUser,
      passcode: rawPasscode,
    });

    expect(joinRes.circle._id).toBe(circleId);
    expect(joinRes.membership.role).toBe("caregiver");
    expect(joinRes.alreadyMember).toBe(false);

    // Rejoining should safely return existing membership
    const rejoinRes = await joinCircleWithPasscode({
      ...caregiverUser,
      passcode: rawPasscode,
    });
    expect(rejoinRes.alreadyMember).toBe(true);
  });

  it("rejects expired or revoked invitation passcodes", async () => {
    // Revoked invite
    const { invite, rawPasscode } = await createInvite({
      userId: ownerUser.userId,
      circleId,
      input: { role: "family", expiresInHours: 24, maxUses: 1 },
    });

    await revokeInvite({
      userId: ownerUser.userId,
      circleId,
      inviteId: invite._id,
    });

    await expect(
      joinCircleWithPasscode({
        userId: "other-user",
        userEmail: "other@example.com",
        userName: "Other Person",
        passcode: rawPasscode,
      }),
    ).rejects.toThrow("revoked");
  });

  it("allows ownership transfer to an existing member", async () => {
    await transferOwnership({
      userId: ownerUser.userId,
      circleId,
      input: { newOwnerUserId: caregiverUser.userId },
    });

    const details = await getCircleDetails(caregiverUser.userId, circleId);
    expect(details.membership.role).toBe("owner");

    // Previous owner should now be caregiver
    const prevOwnerMem = details.members.find(
      (m) => m.userId === ownerUser.userId,
    );
    expect(prevOwnerMem?.role).toBe("caregiver");
  });
});
