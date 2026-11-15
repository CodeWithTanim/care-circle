import { NextResponse } from "next/server";
import { createCircle, getUserCircles } from "@/lib/circle-service";
import { AuthorizationError } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const circles = await getUserCircles(session.user.id);
  return NextResponse.json({ circles });
}

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await createCircle({
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      input: body,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to create circle";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
