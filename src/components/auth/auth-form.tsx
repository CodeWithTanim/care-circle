"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(2, "Please enter your name."),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
});

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <form onSubmit={onSubmit} className="space-y-5" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-5">
        <legend className="sr-only">
          {isSignUp ? "Create your account" : "Sign in"}
        </legend>
        {isSignUp && (
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              className="h-12"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-12"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={isSignUp ? 12 : 1}
            maxLength={128}
            required
            className="h-12"
            aria-describedby={isSignUp ? "password-help" : undefined}
          />
          {isSignUp && (
            <p id="password-help" className="text-sm text-muted-foreground">
              Use at least 12 characters.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="min-h-12 w-full text-base">
          {pending && (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          )}
          {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
        </Button>
      </fieldset>
      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "New to Care Circle?"}{" "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
