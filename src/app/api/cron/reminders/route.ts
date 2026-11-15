import { randomUUID } from "node:crypto";
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
  // Fail closed on Scheduler authorization
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    return NextResponse.json(
      { error: "Cron authorization is not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const now = new Date();
    const workerId = `cron-worker-${randomUUID()}`;

    // Bounded circle cursor generation with time budget (max 15s) so dispatch is never starved
    const cursor = db.collection<Circle>("circles").find({}).batchSize(20);
    let circlesChecked = 0;
    let totalGenerated = 0;
    const generationBudgetMs = 15000;
    const startTime = Date.now();

    while (await cursor.hasNext()) {
      if (Date.now() - startTime > generationBudgetMs) {
        break; // Yield generation so worker dispatch can proceed within serverless limits
      }
      const circle = await cursor.next();
      if (!circle) break;
      circlesChecked++;
      const count = await generateReminderJobsForCircle(circle._id, now);
      totalGenerated += count;
    }

    const result = await processDueReminderJobs(workerId, now);

    return NextResponse.json({
      ok: true,
      circlesChecked,
      jobsGenerated: totalGenerated,
      ...result,
      workerId,
      timestamp: now.toISOString(),
    });
  } catch (err: unknown) {
    console.error("Cron reminders processing error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error during reminder processing" },
      { status: 500 },
    );
  }
}
