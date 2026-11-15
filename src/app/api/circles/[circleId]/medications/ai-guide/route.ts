import { NextResponse } from "next/server";
import { z } from "zod";
import { getMedicationAiGuide } from "@/lib/gemini-ai";
import { AuthorizationError, requireCircleAccess } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string }>;
}

const aiGuideRequestSchema = z.object({
  name: z.string().trim().min(1, "Medication name is required"),
  dosage: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
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
