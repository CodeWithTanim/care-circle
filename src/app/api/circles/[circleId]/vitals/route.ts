import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthorizationError, requireCircleAccess } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";
import { getTodayLocalDate } from "@/lib/timezone";
import { getDailyRoutine, upsertDailyRoutine } from "@/lib/vitals-service";

interface RouteProps {
  params: Promise<{ circleId: string }>;
}

const vitalsInputSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  bloodPressure: z
    .object({
      systolic: z.number().int().min(50).max(280),
      diastolic: z.number().int().min(30).max(180),
      recordedAt: z.string().optional(),
    })
    .nullable()
    .optional(),
  bloodSugar: z
    .object({
      value: z.number().min(20).max(600),
      unit: z.string().optional(),
      context: z.enum(["fasting", "post_meal", "random"]).optional(),
      recordedAt: z.string().optional(),
    })
    .nullable()
    .optional(),
  waterGlasses: z.number().int().min(0).max(24).optional(),
  wellnessWalkDone: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export async function GET(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId } = await params;
  try {
    const { circle } = await requireCircleAccess(session.user.id, circleId);
    const { searchParams } = new URL(request.url);
    const dateParam =
      searchParams.get("date") || getTodayLocalDate(circle.timezone);

    const routine = await getDailyRoutine(circleId, dateParam);
    return NextResponse.json({ routine, date: dateParam });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to load daily routine";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId } = await params;
  try {
    const { circle } = await requireCircleAccess(session.user.id, circleId);
    const body = await request.json();
    const parsed = vitalsInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid routine vitals" },
        { status: 400 },
      );
    }

    const targetDate = parsed.data.date || getTodayLocalDate(circle.timezone);

    const routine = await upsertDailyRoutine(
      circleId,
      targetDate,
      parsed.data,
      {
        userId: session.user.id,
        name: session.user.name || "Circle Member",
      },
    );

    return NextResponse.json({ routine });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to save daily routine";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
