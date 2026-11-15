import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Circle } from "@/lib/models";
import {
  generateReminderJobsForCircle,
  processDueReminderJobs,
} from "@/lib/reminder-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  // Validate Scheduler authorization
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const bearer = `Bearer ${cronSecret}`;
    if (authHeader !== bearer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const db = getDb();
    const circles = await db.collection<Circle>("circles").find({}).toArray();

    let totalGenerated = 0;
    const now = new Date();
    for (const circle of circles) {
      const count = await generateReminderJobsForCircle(circle._id, now);
      totalGenerated += count;
    }

    const result = await processDueReminderJobs("cron-worker", now);

    return NextResponse.json({
      ok: true,
      circlesChecked: circles.length,
      jobsGenerated: totalGenerated,
      ...result,
      timestamp: now.toISOString(),
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
