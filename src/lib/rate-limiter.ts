import { getDb } from "./db";

export interface RateLimitRecord {
  _id: string;
  attempts: number;
  windowStart: Date;
  expiresAt: Date;
  updatedAt: Date;
}

/**
 * Atomically reserve quota using database-level conditions.
 * Prevents race conditions where multiple parallel requests can all pass a separate check.
 */
export async function reserveAtomicQuota(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  const db = getDb();
  const now = new Date();
  const windowThreshold = new Date(now.getTime() - params.windowMs);

  // 1. Attempt atomic increment if record exists within active window and attempts < limit
  const incResult = await db
    .collection<RateLimitRecord>("rate_limits")
    .findOneAndUpdate(
      {
        _id: params.key,
        windowStart: { $gte: windowThreshold },
        attempts: { $lt: params.limit },
      },
      {
        $inc: { attempts: 1 },
        $set: { updatedAt: now },
      },
      { returnDocument: "after" },
    );

  if (incResult) {
    return {
      allowed: true,
      remaining: Math.max(0, params.limit - incResult.attempts),
    };
  }

  // 2. If no active record with capacity was matched:
  // Try atomic reset or upsert for expired window or fresh key
  try {
    const resetResult = await db
      .collection<RateLimitRecord>("rate_limits")
      .findOneAndUpdate(
        {
          _id: params.key,
          $or: [
            { windowStart: { $lt: windowThreshold } },
            { windowStart: { $exists: false } },
          ],
        },
        {
          $set: {
            attempts: 1,
            windowStart: now,
            expiresAt: new Date(now.getTime() + params.windowMs * 2),
            updatedAt: now,
          },
        },
        { upsert: true, returnDocument: "after" },
      );

    if (resetResult) {
      return {
        allowed: true,
        remaining: Math.max(0, params.limit - 1),
      };
    }
  } catch {
    // E11000 duplicate key on concurrent upsert race means another request won the reset;
    // fall through to check limit
  }

  // Quota is exhausted for active window
  return {
    allowed: false,
    remaining: 0,
  };
}

/**
 * Check if quota is exhausted without incrementing.
 */
export async function checkRateLimitExhausted(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<boolean> {
  const db = getDb();
  const now = new Date();
  const windowThreshold = new Date(now.getTime() - params.windowMs);

  const doc = await db
    .collection<RateLimitRecord>("rate_limits")
    .findOne({ _id: params.key });
  if (!doc) return false;
  if (doc.windowStart < windowThreshold) return false;
  return doc.attempts >= params.limit;
}

/**
 * Increment failed attempts counter atomically (for join passcodes).
 */
export async function recordFailedAttempt(params: {
  key: string;
  windowMs: number;
}): Promise<number> {
  const db = getDb();
  const now = new Date();
  const windowThreshold = new Date(now.getTime() - params.windowMs);

  const inc = await db
    .collection<RateLimitRecord>("rate_limits")
    .findOneAndUpdate(
      { _id: params.key, windowStart: { $gte: windowThreshold } },
      { $inc: { attempts: 1 }, $set: { updatedAt: now } },
      { returnDocument: "after" },
    );

  if (inc) return inc.attempts;

  try {
    const res = await db
      .collection<RateLimitRecord>("rate_limits")
      .findOneAndUpdate(
        {
          _id: params.key,
          $or: [
            { windowStart: { $lt: windowThreshold } },
            { windowStart: { $exists: false } },
          ],
        },
        {
          $set: {
            attempts: 1,
            windowStart: now,
            expiresAt: new Date(now.getTime() + params.windowMs * 2),
            updatedAt: now,
          },
        },
        { upsert: true, returnDocument: "after" },
      );
    return res ? res.attempts : 1;
  } catch {
    return 1;
  }
}
