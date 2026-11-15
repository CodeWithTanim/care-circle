import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureDatabaseIndexes } from "../src/lib/db-indexes";
import { seedFictionalDemoData } from "../src/lib/demo-data";
import type { Circle } from "../src/lib/models";

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

describe("Demo Dataset Generator", () => {
  it("seeds a complete fictional scenario with medications, appointments and alerts", async () => {
    const result = await seedFictionalDemoData(
      db,
      "evaluator-user-1",
      "evaluator@example.com",
      "Evaluator",
    );

    expect(result.circleId).toBeDefined();
    expect(result.recipientName).toContain("Eleanor Vance");
    expect(result.medicationsCount).toBe(2);
    expect(result.appointmentsCount).toBe(1);
    expect(result.alertsCount).toBe(1);

    // Verify records exist in database
    const circle = await db
      .collection<Circle>("circles")
      .findOne({ _id: result.circleId });
    expect(circle?.sharingConsent).toBe(true);

    const meds = await db
      .collection("medications")
      .find({ circleId: result.circleId })
      .toArray();
    expect(meds.length).toBe(2);

    const alerts = await db
      .collection("care_alerts")
      .find({ circleId: result.circleId })
      .toArray();
    expect(alerts.length).toBe(1);
    expect(alerts[0].status).toBe("pending");
  });
});
