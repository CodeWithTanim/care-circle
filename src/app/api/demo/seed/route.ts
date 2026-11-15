import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedFictionalDemoData } from "@/lib/demo-data";
import { getApiSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const result = await seedFictionalDemoData(
      db,
      session.user.id,
      session.user.email,
      session.user.name,
    );

    return NextResponse.json({
      success: true,
      message: "Fictional demo data seeded successfully",
      ...result,
    });
  } catch (err: unknown) {
    const errMsg =
      err instanceof Error ? err.message : "Failed to seed demo data";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
