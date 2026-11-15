import "server-only";
import { getDb } from "@/lib/db";
import type { DailyRoutine } from "@/lib/models";

export async function getDailyRoutine(
  circleId: string,
  date: string,
): Promise<DailyRoutine | null> {
  const db = getDb();
  return db
    .collection<DailyRoutine>("daily_routines")
    .findOne({ circleId, date });
}

export async function upsertDailyRoutine(
  circleId: string,
  date: string,
  data: Partial<Omit<DailyRoutine, "_id" | "circleId" | "date" | "createdAt">>,
  actor: { userId: string; name: string },
): Promise<DailyRoutine> {
  const db = getDb();
  const now = new Date();

  const updateDoc = {
    $set: {
      ...data,
      circleId,
      date,
      recordedBy: actor,
      updatedAt: now,
    },
    $setOnInsert: {
      _id: `routine_${circleId}_${date}`,
      createdAt: now,
    },
  };

  await db
    .collection<DailyRoutine>("daily_routines")
    .updateOne({ circleId, date }, updateDoc, { upsert: true });

  const updated = await db
    .collection<DailyRoutine>("daily_routines")
    .findOne({ circleId, date });

  return updated!;
}
