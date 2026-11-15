import Link from "next/link";
import { HeartHandshake } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
    >
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-xl font-semibold"
      >
        <HeartHandshake className="size-7 text-primary" aria-hidden="true" />
        Care Circle
      </Link>
      {children}
    </main>
  );
}
