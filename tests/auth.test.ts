import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let mongo: MongoMemoryServer;
let auth: ReturnType<(typeof import("../src/lib/auth"))["getAuth"]>;
const baseURL = "http://localhost:3000";
const email = "caregiver@example.com";
const password = "a-long-test-password-123";

function request(path: string, body?: Record<string, string>, cookie?: string) {
  return auth.handler(
    new Request(`${baseURL}/api/auth${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Origin: baseURL,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv("MONGODB_URI", mongo.getUri());
  vi.stubEnv("MONGODB_DB", "care_circle_test");
  vi.stubEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("BETTER_AUTH_URL", baseURL);
  const { getAuth } = await import("../src/lib/auth");
  auth = getAuth();
});

afterAll(async () => {
  if (auth) {
    const { getMongoClient } = await import("../src/lib/db");
    await getMongoClient().close();
  }
  await mongo?.stop();
  vi.unstubAllEnvs();
});

it("rejects a short password at the server", async () => {
  const response = await request("/sign-up/email", {
    name: "Care Giver",
    email,
    password: "short",
  });
  expect(response.ok).toBe(false);
});

it("creates a user and stores a password hash rather than the password", async () => {
  const response = await request("/sign-up/email", {
    name: "Care Giver",
    email,
    password,
  });
  expect(response.status).toBe(200);
  expect((await response.json()).user.email).toBe(email);
  const { getDb } = await import("../src/lib/db");
  const user = await getDb().collection("user").findOne({ email });
  const account = await getDb()
    .collection("account")
    .findOne({ userId: user!._id });
  expect(account?.password).toBeTruthy();
  expect(account?.password).not.toBe(password);
});

it("rejects incorrect credentials", async () => {
  const response = await request("/sign-in/email", {
    email,
    password: "wrong-password-123",
  });
  expect(response.status).toBe(401);
});

it("validates a session and revokes it on sign-out", async () => {
  const response = await request("/sign-in/email", { email, password });
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const session = await request("/get-session", undefined, cookie);
  expect((await session.json()).user.email).toBe(email);
  expect((await request("/sign-out", {}, cookie)).ok).toBe(true);
  expect(
    await (await request("/get-session", undefined, cookie)).json(),
  ).toBeNull();
});

it("rejects requests from an untrusted origin", async () => {
  const response = await auth.handler(
    new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://untrusted.example",
      },
      body: JSON.stringify({ email, password }),
    }),
  );
  expect(response.status).toBe(403);
});
