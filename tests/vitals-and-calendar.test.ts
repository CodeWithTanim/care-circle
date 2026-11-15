import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  generateIcsContent,
  getGoogleCalendarUrl,
  getGoogleMapsUrl,
} from "../src/lib/calendar";
import type { Appointment } from "../src/lib/models";

vi.mock("server-only", () => ({}));

let mongo: MongoMemoryServer;

describe("Calendar and Google Services utilities", () => {
  const dummyAppt: Appointment = {
    _id: "appt-123",
    circleId: "circle-456",
    title: "Cardiology Consultation",
    provider: "Dr. Eleanor Vance",
    location: "City General Hospital, Suite 402",
    scheduledTimestamp: new Date("2026-12-01T14:30:00.000Z"),
    localDate: "2026-12-01",
    localTime: "14:30",
    notes: "Bring previous blood work results",
    status: "scheduled",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
  };

  it("generates a valid 1-click Google Calendar URL with encoded parameters", () => {
    const url = getGoogleCalendarUrl(dummyAppt, "Mom's Care Circle", "Mom");
    expect(url).toContain("https://calendar.google.com/calendar/render");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("Cardiology+Consultation");
    expect(url).toContain("City+General+Hospital");
    expect(url).toContain("20261201T143000Z");
  });

  it("generates a valid Google Maps search navigation URL", () => {
    const mapUrl = getGoogleMapsUrl("City General Hospital, Suite 402");
    expect(mapUrl).toContain("https://www.google.com/maps/search/?api=1");
    expect(mapUrl).toContain("City%20General%20Hospital");
  });

  it("generates RFC 5545 compliant iCalendar content", () => {
    const ics = generateIcsContent(dummyAppt, "Mom's Care Circle", "Mom");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain(
      "SUMMARY:Cardiology Consultation - Dr. Eleanor Vance",
    );
    expect(ics).toContain("LOCATION:City General Hospital, Suite 402");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });
});

describe("Vitals and Healthcare Routine Service", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    vi.stubEnv("MONGODB_URI", mongo.getUri());
    vi.stubEnv("MONGODB_DB", "care_circle_test_vitals");
    vi.stubEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  });

  afterAll(async () => {
    const { getMongoClient } = await import("../src/lib/db");
    await getMongoClient().close();
    await mongo.stop();
    vi.unstubAllEnvs();
  });

  it("persists and retrieves daily routine vitals idempotently", async () => {
    const { getDailyRoutine, upsertDailyRoutine } =
      await import("../src/lib/vitals-service");

    const circleId = "test-circle-vitals";
    const date = "2026-11-15";

    // 1. Initial read should be null
    const initial = await getDailyRoutine(circleId, date);
    expect(initial).toBeNull();

    // 2. Log blood pressure and water glasses
    await upsertDailyRoutine(
      circleId,
      date,
      {
        bloodPressure: { systolic: 120, diastolic: 80 },
        waterGlasses: 4,
      },
      { userId: "user-1", name: "Caregiver Alice" },
    );

    const afterFirst = await getDailyRoutine(circleId, date);
    expect(afterFirst).not.toBeNull();
    expect(afterFirst?.bloodPressure?.systolic).toBe(120);
    expect(afterFirst?.bloodPressure?.diastolic).toBe(80);
    expect(afterFirst?.waterGlasses).toBe(4);
    expect(afterFirst?.recordedBy?.name).toBe("Caregiver Alice");

    // 3. Update blood sugar and walk status without clobbering existing vitals
    await upsertDailyRoutine(
      circleId,
      date,
      {
        bloodSugar: { value: 105, context: "fasting", unit: "mg/dL" },
        wellnessWalkDone: true,
        waterGlasses: 6,
      },
      { userId: "user-2", name: "Elder Eleanor" },
    );

    const updated = await getDailyRoutine(circleId, date);
    expect(updated?.waterGlasses).toBe(6);
    expect(updated?.wellnessWalkDone).toBe(true);
    expect(updated?.bloodSugar?.value).toBe(105);
    expect(updated?.bloodPressure?.systolic).toBe(120);
    expect(updated?.recordedBy?.name).toBe("Elder Eleanor");
  });
});
