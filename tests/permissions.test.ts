import { randomBytes, randomUUID } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureDatabaseIndexes } from "../src/lib/db-indexes";
import type { Circle, Membership } from "../src/lib/models";
import { canConfirmDose, requireCircleAccess } from "../src/lib/permissions";

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

describe("Database Indexes & Uniqueness", () => {
  it("enforces unique membership per circle and user", async () => {
    const circleId = "circle-1";
    const userId = "user-1";
    const membership: Membership = {
      _id: randomUUID(),
      circleId,
      userId,
      role: "owner",
      name: "Alice Owner",
      email: "alice@example.com",
      joinedAt: new Date(),
      notifications: {
        upcomingDoses: true,
        missedDoses: true,
        appointments: true,
      },
    };

    await db.collection<Membership>("memberships").insertOne(membership);

    // Attempt duplicate insert
    await expect(
      db.collection<Membership>("memberships").insertOne({
        ...membership,
        _id: randomUUID(),
      }),
    ).rejects.toThrow();
  });
});

describe("Circle Authorization & Permissions", () => {
  const circleIdA = "circle-A";
  const circleIdB = "circle-B";
  const ownerId = "owner-1";
  const caregiverId = "caregiver-1";
  const familyId = "family-1";
  const strangerId = "stranger-1";

  beforeAll(async () => {
    const circleA: Circle = {
      _id: circleIdA,
      name: "Grandma Rose",
      recipientName: "Rose",
      recipientRelationship: "parent",
      isRecipientUser: false,
      timezone: "America/New_York",
      sharingConsent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: ownerId,
    };
    const circleB: Circle = {
      _id: circleIdB,
      name: "Grandpa Jack",
      recipientName: "Jack",
      recipientRelationship: "parent",
      isRecipientUser: true,
      timezone: "UTC",
      sharingConsent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: strangerId,
    };

    await db.collection<Circle>("circles").insertMany([circleA, circleB]);

    const memberships: Membership[] = [
      {
        _id: randomUUID(),
        circleId: circleIdA,
        userId: ownerId,
        role: "owner",
        name: "Circle Owner",
        email: "owner@example.com",
        joinedAt: new Date(),
        notifications: {
          upcomingDoses: true,
          missedDoses: true,
          appointments: true,
        },
      },
      {
        _id: randomUUID(),
        circleId: circleIdA,
        userId: caregiverId,
        role: "caregiver",
        name: "Nurse Nina",
        email: "nina@example.com",
        joinedAt: new Date(),
        notifications: {
          upcomingDoses: true,
          missedDoses: true,
          appointments: true,
        },
      },
      {
        _id: randomUUID(),
        circleId: circleIdA,
        userId: familyId,
        role: "family",
        name: "Grandson George",
        email: "george@example.com",
        joinedAt: new Date(),
        notifications: {
          upcomingDoses: true,
          missedDoses: true,
          appointments: true,
        },
      },
    ];

    await db.collection<Membership>("memberships").insertMany(memberships);
  });

  it("rejects unauthenticated requests", async () => {
    await expect(requireCircleAccess("", circleIdA)).rejects.toThrow(
      "Authentication required",
    );
  });

  it("denies cross-circle access for non-members", async () => {
    // Owner of Circle A tries to access Circle B
    await expect(requireCircleAccess(ownerId, circleIdB)).rejects.toThrow(
      "You are not a member of this care circle",
    );
    // Stranger tries to access Circle A
    await expect(requireCircleAccess(strangerId, circleIdA)).rejects.toThrow(
      "You are not a member of this care circle",
    );
  });

  it("allows access for valid members", async () => {
    const { membership, circle } = await requireCircleAccess(
      ownerId,
      circleIdA,
    );
    expect(membership.role).toBe("owner");
    expect(circle.name).toBe("Grandma Rose");
  });

  it("rejects role escalation attempts when role is restricted", async () => {
    // Family member attempts owner-only action
    await expect(
      requireCircleAccess(familyId, circleIdA, ["owner"]),
    ).rejects.toThrow("does not have permission");

    // Caregiver attempts owner-only action
    await expect(
      requireCircleAccess(caregiverId, circleIdA, ["owner"]),
    ).rejects.toThrow("does not have permission");

    // Caregiver can access caregiver-allowed action
    const { membership } = await requireCircleAccess(caregiverId, circleIdA, [
      "owner",
      "caregiver",
    ]);
    expect(membership.role).toBe("caregiver");
  });

  it("verifies dose confirmation permissions", async () => {
    const circle = (await db
      .collection<Circle>("circles")
      .findOne({ _id: circleIdA }))!;
    const ownerMem = (await db
      .collection<Membership>("memberships")
      .findOne({ userId: ownerId }))!;
    const caregiverMem = (await db
      .collection<Membership>("memberships")
      .findOne({ userId: caregiverId }))!;
    const familyMem = (await db
      .collection<Membership>("memberships")
      .findOne({ userId: familyId }))!;

    expect(canConfirmDose(ownerMem, circle)).toBe(true);
    expect(canConfirmDose(caregiverMem, circle)).toBe(true);
    expect(canConfirmDose(familyMem, circle)).toBe(false);
  });
});
