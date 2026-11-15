"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function signOut() {
    setPending(true);
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <Button
        variant="outline"
        onClick={signOut}
        disabled={pending}
        className="min-h-11"
      >
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Couldn&apos;t sign out. Please try again.
        </p>
      )}
    </div>
  );
}
