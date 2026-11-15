import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DashboardView, isValidTab } from "@/components/circle/dashboard-view";
import { OnboardingView } from "@/components/circle/onboarding-view";
import { getUserCircles } from "@/lib/circle-service";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { user } = await requireSession();
  const search = await searchParams;
  const requestedCircleId =
    typeof search.circle === "string" ? search.circle : undefined;
  const requestedTab =
    typeof search.tab === "string" && isValidTab(search.tab)
      ? search.tab
      : undefined;
  const showOnboarding = search.onboarding === "true";

  const circles = await getUserCircles(user.id);

  if (circles.length === 0 || showOnboarding) {
    return (
      <main
        id="main-content"
        className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-8 md:py-12"
      >
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-2xl font-bold text-primary"
          >
            <HeartHandshake
              className="size-8 text-primary"
              aria-hidden="true"
            />
            Care Circle
          </Link>
          <div className="flex items-center gap-3">
            {circles.length > 0 && (
              <Link
                href="/dashboard"
                className="text-sm font-medium text-primary hover:underline"
              >
                ← Back to Circle
              </Link>
            )}
            <SignOutButton />
          </div>
        </header>
        <OnboardingView userName={user.name} />
      </main>
    );
  }

  // Find target circle or fall back to the first one
  const targetCircleId =
    requestedCircleId && circles.some((c) => c.circle._id === requestedCircleId)
      ? requestedCircleId
      : circles[0].circle._id;

  return (
    <DashboardView
      initialCircles={circles}
      currentCircleId={targetCircleId}
      initialTab={requestedTab}
      userName={user.name}
      userId={user.id}
    />
  );
}
