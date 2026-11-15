"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, HeartHandshake, Menu, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

interface HomeNavbarProps {
  initialLoggedIn?: boolean;
}

export function HomeNavbar({ initialLoggedIn }: HomeNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  // Prefer live client session; fall back to SSR initial value while pending
  const isLoggedIn = isPending ? (initialLoggedIn ?? false) : !!session;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-[#0f4c47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#0f4c47] text-white shadow-md shadow-teal-900/10">
            <HeartHandshake className="size-6" aria-hidden="true" />
          </div>
          <span className="font-extrabold tracking-tight text-foreground">
            Care<span className="text-[#0f4c47]">Circle</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav
          aria-label="Main Navigation"
          className="hidden lg:flex items-center gap-8 text-sm font-medium text-foreground/80"
        >
          <Link
            href="#about"
            className="transition-colors hover:text-[#0f4c47]"
          >
            About Us
          </Link>
          <Link
            href="#process"
            className="transition-colors hover:text-[#0f4c47]"
          >
            How It Works
          </Link>
          <Link
            href="#features"
            className="transition-colors hover:text-[#0f4c47]"
          >
            Features
          </Link>
          <Link
            href="#testimonials"
            className="transition-colors hover:text-[#0f4c47]"
          >
            Stories
          </Link>
          {isLoggedIn && (
            <Link
              href="/dashboard"
              className="font-semibold text-[#0f4c47] transition-colors hover:underline"
            >
              Dashboard
            </Link>
          )}
        </nav>

        {/* Desktop Action CTAs */}
        <div className="hidden sm:flex items-center gap-3">
          {isLoggedIn ? (
            <Button
              asChild
              className="min-h-[44px] rounded-full bg-[#0f4c47] px-6 text-sm font-semibold text-white shadow-md hover:bg-[#0c3d39] hover:shadow-lg transition-all"
            >
              <Link href="/dashboard">
                Dashboard
                <ArrowRight className="ml-1.5 size-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                className="min-h-[44px] text-sm font-semibold"
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button
                asChild
                className="min-h-[44px] rounded-full bg-[#0f4c47] px-6 text-sm font-semibold text-white shadow-md hover:bg-[#0c3d39] hover:shadow-lg transition-all"
              >
                <Link href="/sign-up">
                  Get Started
                  <ArrowRight className="ml-1.5 size-4" aria-hidden="true" />
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Controls */}
        <div className="flex sm:hidden items-center gap-2">
          {isLoggedIn ? (
            <Button
              asChild
              size="sm"
              className="rounded-full bg-[#0f4c47] text-white text-xs font-semibold"
            >
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-full text-xs font-semibold"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            className="size-10"
          >
            {mobileMenuOpen ? (
              <X className="size-6" />
            ) : (
              <Menu className="size-6" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-border/60 bg-background px-4 py-4 sm:hidden space-y-3">
          <nav className="flex flex-col space-y-3 text-base font-medium">
            <Link
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 transition-colors hover:text-[#0f4c47]"
            >
              About Us
            </Link>
            <Link
              href="#process"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 transition-colors hover:text-[#0f4c47]"
            >
              How It Works
            </Link>
            <Link
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 transition-colors hover:text-[#0f4c47]"
            >
              Features
            </Link>
            <Link
              href="#testimonials"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 transition-colors hover:text-[#0f4c47]"
            >
              Stories
            </Link>
            {isLoggedIn && (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 font-bold text-[#0f4c47]"
              >
                Dashboard
              </Link>
            )}
          </nav>
          {!isLoggedIn && (
            <div className="pt-2 border-t flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                  Sign In
                </Link>
              </Button>
              <Button
                asChild
                className="w-full bg-[#0f4c47] text-white hover:bg-[#0c3d39]"
              >
                <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>
                  Get Started
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
