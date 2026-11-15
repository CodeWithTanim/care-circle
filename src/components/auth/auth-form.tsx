"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const signInSchema = z.object({
  email: z.email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(2, "Please enter your full name."),
  password: z
    .string()
    .min(12, "Use at least 12 characters for medical privacy.")
    .max(128),
});

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");

  const hasMinLength = passwordValue.length >= 12;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = (isSignUp ? signUpSchema : signInSchema).safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }
    setPending(true);
    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            ...parsed.data,
            name: String(data.name).trim(),
          })
        : await authClient.signIn.email(parsed.data);
      if (result.error) {
        setError(
          result.error.message ?? "We couldn't sign you in. Please try again.",
        );
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("We couldn't connect. Please try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4.5" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-4.5">
        <legend className="sr-only">
          {isSignUp ? "Create your account" : "Sign in"}
        </legend>

        {/* Name Field (Sign-up only) */}
        {isSignUp && (
          <div className="space-y-1.5">
            <Label
              htmlFor="name"
              className="text-xs font-semibold text-foreground/80 tracking-wide"
            >
              Full name
            </Label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70"
                aria-hidden="true"
              />
              <Input
                id="name"
                name="name"
                autoComplete="name"
                required
                minLength={2}
                placeholder="e.g. Eleanor Vance"
                className="h-11 pl-10 text-sm bg-background border-input/80 rounded-xl focus-visible:ring-[#0f4c47]/20 focus-visible:border-[#0f4c47]"
              />
            </div>
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-xs font-semibold text-foreground/80 tracking-wide"
          >
            Email address
          </Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70"
              aria-hidden="true"
            />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="h-11 pl-10 text-sm bg-background border-input/80 rounded-xl focus-visible:ring-[#0f4c47]/20 focus-visible:border-[#0f4c47]"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-xs font-semibold text-foreground/80 tracking-wide"
            >
              Password
            </Label>
          </div>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70"
              aria-hidden="true"
            />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={isSignUp ? 12 : 1}
              maxLength={128}
              required
              placeholder={
                isSignUp ? "At least 12 characters" : "Enter your password"
              }
              className="h-11 pl-10 pr-11 text-sm bg-background border-input/80 rounded-xl focus-visible:ring-[#0f4c47]/20 focus-visible:border-[#0f4c47]"
              aria-describedby={isSignUp ? "password-help" : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0f4c47]/20"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Sign-up Password Live Feedback */}
          {isSignUp && (
            <div id="password-help" className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`flex items-center gap-1.5 font-medium transition-colors ${
                    hasMinLength ? "text-emerald-700" : "text-muted-foreground"
                  }`}
                >
                  {hasMinLength ? (
                    <Check
                      className="size-3.5 text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="size-1.5 rounded-full bg-muted-foreground/60"
                      aria-hidden="true"
                    />
                  )}
                  {hasMinLength
                    ? "Password length verified"
                    : "At least 12 characters"}
                </span>
                <span
                  className={`tabular-nums text-[11px] font-medium ${
                    hasMinLength
                      ? "text-emerald-700 font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {passwordValue.length}/12
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all duration-300 ${
                    hasMinLength
                      ? "bg-emerald-500 w-full"
                      : passwordValue.length > 0
                        ? "bg-amber-500 w-1/2"
                        : "w-0"
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/10 p-3.5 text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-1"
          >
            <AlertCircle
              className="size-4.5 shrink-0 mt-0.5 text-destructive"
              aria-hidden="true"
            />
            <span className="flex-1 leading-snug">{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          className="min-h-11 w-full rounded-xl bg-[#0f4c47] hover:bg-[#0c3d39] text-white text-sm font-semibold shadow-md shadow-teal-950/15 hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer mt-2"
        >
          {pending ? (
            <>
              <LoaderCircle
                className="mr-2 size-4.5 animate-spin"
                aria-hidden="true"
              />
              <span>{isSignUp ? "Creating account…" : "Signing in…"}</span>
            </>
          ) : (
            <>
              <span>{isSignUp ? "Create account" : "Sign in to account"}</span>
              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </fieldset>

      {/* Switch between sign-in and sign-up */}
      <div className="pt-3 border-t border-border/60 text-center text-xs text-muted-foreground">
        <span>
          {isSignUp ? "Already have an account?" : "New to Care Circle?"}
        </span>{" "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-semibold text-[#0f4c47] hover:text-[#0b3c37] hover:underline underline-offset-4 transition-colors"
        >
          {isSignUp ? "Sign in instead" : "Create an account"}
        </Link>
      </div>
    </form>
  );
}
