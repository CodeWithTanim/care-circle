import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6"
    >
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">
        Let&apos;s get you back to Care Circle.
      </p>
      <Button asChild className="min-h-12">
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
