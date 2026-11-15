"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6"
    >
      <h1 className="text-3xl font-semibold">
        We couldn&apos;t load this page
      </h1>
      <p className="text-muted-foreground">Please try again in a moment.</p>
      <Button className="min-h-12" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
