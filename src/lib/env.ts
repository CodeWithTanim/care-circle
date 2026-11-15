import "server-only";
import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  MONGODB_DB: z.string().min(1).default("care_circle"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
});

export function getServerEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Missing or invalid configuration: ${fields}. Check your root .env; see README.md for variable names.`,
    );
  }
  const authURL = new URL(result.data.BETTER_AUTH_URL);
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    authURL.hostname,
  );
  if (
    process.env.NODE_ENV === "production" &&
    authURL.protocol !== "https:" &&
    !isLoopback
  ) {
    throw new Error("BETTER_AUTH_URL must use HTTPS in production.");
  }
  return result.data;
}
