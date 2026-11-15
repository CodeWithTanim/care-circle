import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { askGeminiCareQuestion, hasGeminiApiKey } from "@/lib/gemini-ai";
import type { Circle, Medication } from "@/lib/models";
import { AuthorizationError, requireCircleAccess } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string }>;
}

const askRequestSchema = z.object({
  question: z.string().trim().min(1, "Question cannot be empty"),
});

export async function POST(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId } = await params;
  try {
    await requireCircleAccess(session.user.id, circleId);
    const body = await request.json();
    const parsed = askRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const circle = await db
      .collection<Circle>("circles")
      .findOne({ _id: circleId });

    const medications = await db
      .collection<Medication>("medications")
      .find({ circleId, active: true })
      .toArray();

    const medicationsSummary = medications
      .map((m) => `${m.name} (${m.dosage})`)
      .join(", ");

    const result = await askGeminiCareQuestion({
      question: parsed.data.question,
      circleName: circle?.name,
      recipientName: circle?.recipientName,
      medicationsSummary,
    });

    return NextResponse.json({
      data: result,
      hasLiveGeminiKey: hasGeminiApiKey(),
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to process AI question";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
