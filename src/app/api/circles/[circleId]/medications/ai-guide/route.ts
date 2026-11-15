import { NextResponse } from "next/server";
import { z } from "zod";
import { getMedicationAiGuide } from "@/lib/gemini-ai";
import { AuthorizationError, requireCircleAccess } from "@/lib/permissions";
import { reserveAtomicQuota } from "@/lib/rate-limiter";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string }>;
}

const aiGuideRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Medication name is required")
    .max(100, "Medication name too long (max 100 characters)"),
  dosage: z
    .string()
    .trim()
    .max(60, "Dosage string too long (max 60 characters)")
    .optional(),
  instructions: z
    .string()
    .trim()
    .max(300, "Instructions string too long (max 300 characters)")
    .optional(),
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
            "Too many AI requests. Please wait a few minutes before requesting more guides.",
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
    const parsed = aiGuideRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const guide = await getMedicationAiGuide({
      name: parsed.data.name,
      dosage: parsed.data.dosage,
      instructions: parsed.data.instructions,
    });

    return NextResponse.json({ guide });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to generate AI guide";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
