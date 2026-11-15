import "server-only";
import { MongoClient } from "mongodb";
import { getServerEnv } from "@/lib/env";
import { ensureDatabaseIndexes } from "@/lib/db-indexes";

const mongoGlobal = globalThis as typeof globalThis & {
  careCircleMongo?: MongoClient;
  careCircleIndexesPromise?: Promise<void>;
};

export function getMongoClient() {
  if (!mongoGlobal.careCircleMongo) {
    mongoGlobal.careCircleMongo = new MongoClient(getServerEnv().MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
  }
  return mongoGlobal.careCircleMongo;
}

// The driver connects on first use; reuse its pool across requests and dev reloads.
export function getDb() {
  return getMongoClient().db(getServerEnv().MONGODB_DB);
}

export async function initDb() {
  const db = getDb();
  if (!mongoGlobal.careCircleIndexesPromise) {
    mongoGlobal.careCircleIndexesPromise = ensureDatabaseIndexes(db).catch(
      (err) => {
        // Reset on error so next request can retry
        mongoGlobal.careCircleIndexesPromise = undefined;
        console.error("Failed to initialize database indexes:", err);
      },
    );
  }
  await mongoGlobal.careCircleIndexesPromise;
  return db;
}
