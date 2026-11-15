import "server-only";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/lib/db";
import { getEmailProvider } from "@/lib/email/provider";
import { getServerEnv } from "@/lib/env";

function createAuth() {
  const env = getServerEnv();
  return betterAuth({
    appName: "Care Circle",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [new URL(env.BETTER_AUTH_URL).origin],
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    // No client option: works with standalone local MongoDB without transactions.
    database: mongodbAdapter(getDb()),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      sendResetPassword: async ({ user, url }) => {
        const provider = getEmailProvider();
        await provider.sendEmail({
          to: user.email,
          toName: user.name,
          subject: "Reset your Care Circle password",
          text: `Hello ${user.name},\n\nYou requested a password reset for Care Circle. Set a new password using this link:\n${url}\n\nThis link will expire soon. If you did not make this request, please ignore this email.`,
          html: `<p>Hello ${user.name},</p><p>You requested a password reset for Care Circle.</p><p><a href="${url}" style="display:inline-block;padding:10px 20px;background-color:#15803d;color:#fff;text-decoration:none;border-radius:4px;">Reset Password</a></p><p style="color:#666;font-size:12px;">This link will expire soon.</p>`,
        });
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        const provider = getEmailProvider();
        await provider.sendEmail({
          to: user.email,
          toName: user.name,
          subject: "Verify your email for Care Circle",
          text: `Hello ${user.name},\n\nPlease verify your email for Care Circle:\n${url}\n\nThis link will expire soon.`,
          html: `<p>Hello ${user.name},</p><p>Welcome to Care Circle. Please verify your email:</p><p><a href="${url}" style="display:inline-block;padding:10px 20px;background-color:#15803d;color:#fff;text-decoration:none;border-radius:4px;">Verify Email</a></p>`,
        });
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/forget-password": { window: 60, max: 3 },
      },
    },
    plugins: [nextCookies()],
  });
}

let authInstance: ReturnType<typeof createAuth> | undefined;

// Initialize at runtime so builds do not need database credentials or secrets.
export function getAuth() {
  return (authInstance ??= createAuth());
}
