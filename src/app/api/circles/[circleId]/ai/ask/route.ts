import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { askGeminiCareQuestion, hasGeminiApiKey } from "@/lib/gemini-ai";
import type { Medication } from "@/lib/models";
import { AuthorizationError, requireCircleAccess } from "@/lib/permissions";
import { reserveAtomicQuota } from "@/lib/rate-limiter";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string }>;
}

const askRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(2, "Question cannot be empty")
    .max(500, "Question is too long (maximum 500 characters)"),
});

export async function POST(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId } = await params;
  try {
    await requireCircleAccess(session.user.id, circleId);

    // Enforce shared atomic AI rate quota: 20 requests per 10 minutes per user
    const quota = await reserveAtomicQuota({
      key: `ai_quota:${session.user.id}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });

    if (!quota.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many AI assistant requests. Please wait a few minutes before asking another question.",
        },
        { status: 429 },
      );
    }

    // Body limit: reject payloads > 4KB before parsing
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 4096) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const body = await request.json();
    const parsed = askRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const db = getDb();
    const medications = await db
      .collection<Medication>("medications")
      .find({ circleId, active: true })
      .toArray();

    const medicationsSummary = medications
      .map((m: Medication) => `${m.name} (${m.dosage})`)
      .join(", ");

    // Data minimization: omit personally identifiable names in AI external calls
    const result = await askGeminiCareQuestion({
      question: parsed.data.question,
      circleName: "Family Care Circle",
      recipientName: "Care Recipient",
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
