import { NextResponse } from "next/server";
import { addMedication, getMedications } from "@/lib/medication-service";
import { AuthorizationError } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string }>;
}

export async function GET(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId } = await params;
  try {
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("includeArchived") === "true";
    const medications = await getMedications({
      userId: session.user.id,
      circleId,
      includeArchived,
    });
    return NextResponse.json({ medications });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to load medications";
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
    const body = await request.json();
    const medication = await addMedication({
      userId: session.user.id,
      circleId,
      input: body,
    });
    return NextResponse.json({ medication }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to add medication";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
