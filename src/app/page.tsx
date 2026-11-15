import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  HeartHandshake,
  KeyRound,
  Lock,
  Pill,
  ShieldCheck,
  Star,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HomeNavbar } from "@/components/home/home-navbar";
import { getApiSession } from "@/lib/session";

const TICKER_ITEMS = [
  "Medication Coordination",
  "Compassionate Care",
  "Family Transparency",
  "Passcode Invitations",
  '"I\'ll Handle This" Alerts',
  "Doctor Appointments",
  "Elder Dignity & Consent",
  "Cloud Scheduler Reminders",
  "Adherence Analytics",
  "Proactive Notifications",
];

export default async function Home() {
  const session = await getApiSession();
  const isLoggedIn = !!session;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-teal-100 selection:text-teal-900">
      {/* ─── Top Navigation Bar ─────────────────────────────────────────── */}
      <HomeNavbar initialLoggedIn={isLoggedIn} />

      <main id="main-content" className="flex-1">
        {/* ─── Hero Section ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-teal-50/80 via-sky-50/30 to-background pt-12 pb-20 sm:pt-16 sm:pb-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              {/* Left Column: Headlines & CTA */}
              <div className="space-y-6 lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-100/60 px-3.5 py-1.5 text-xs font-semibold text-[#0f4c47]">
                  <span
                    className="size-2 rounded-full bg-[#0f4c47] animate-pulse"
                    aria-hidden="true"
                  />
                  <span>Trusted Elderly Care & Medication Coordination</span>
                </div>

                <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:leading-[1.15]">
                  Get the Care — <br className="hidden sm:inline" />
                  <span className="text-[#0f4c47]">
                    You Need &amp; Deserve.
                  </span>
                </h1>

                <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
                  A calmer, interconnected health coordination platform designed
                  for seniors, family members, and caregivers. Manage daily
                  medications, doctor visits, and immediate alerts — with the
                  person receiving care in complete control.
                </p>

                {/* CTA Group */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  <Button
                    asChild
                    size="lg"
                    className="min-h-[50px] rounded-full bg-[#0f4c47] px-8 text-base font-semibold text-white shadow-lg shadow-teal-900/15 hover:bg-[#0c3d39] hover:shadow-xl transition-all"
                  >
                    <Link href={isLoggedIn ? "/dashboard" : "/sign-up"}>
                      {isLoggedIn ? "Go to Dashboard" : "Start a Care Circle"}
                      <ArrowRight className="ml-2 size-5" aria-hidden="true" />
                    </Link>
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="min-h-[50px] rounded-full border-2 border-[#0f4c47]/30 bg-white/80 px-7 text-base font-semibold text-[#0f4c47] hover:bg-teal-50/70"
                  >
                    <Link href="/dashboard">
                      <KeyRound className="mr-2 size-4" aria-hidden="true" />
                      Join with Passcode
                    </Link>
                  </Button>
                </div>

                {/* Trust Indicators */}
                <div className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-4 text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck
                      className="size-4 text-[#0f4c47]"
                      aria-hidden="true"
                    />
                    Explicit Elder Consent
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Lock
                      className="size-4 text-[#0f4c47]"
                      aria-hidden="true"
                    />
                    Secure Passcode Access
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2
                      className="size-4 text-[#0f4c47]"
                      aria-hidden="true"
                    />
                    100% Free for Families
                  </span>
                </div>
              </div>

              {/* Right Column: Hero Visual with Trust Cards */}
              <div className="relative lg:col-span-5 flex justify-center">
                <div className="relative w-full max-w-md sm:max-w-lg">
                  {/* Decorative soft glow */}
                  <div className="absolute -top-6 -left-6 size-72 rounded-full bg-teal-200/50 blur-3xl" />
                  <div className="absolute -bottom-6 -right-6 size-72 rounded-full bg-sky-200/50 blur-3xl" />

                  {/* Main Portrait Card */}
                  <div className="relative overflow-hidden rounded-3xl border-4 border-white bg-white shadow-2xl shadow-teal-900/10">
                    <Image
                      src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=900&q=80"
                      alt="Compassionate healthcare doctor and caregiver smiling"
                      width={600}
                      height={700}
                      priority
                      className="h-[440px] sm:h-[480px] w-full object-cover object-top"
                    />

                    {/* Gradient overlay for bottom badge blending */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  </div>

                  {/* Floating Badge 1: Top Right Certified Seal */}
                  <div className="absolute -top-3 -right-3 sm:-right-6 flex items-center gap-2.5 rounded-2xl border border-white/80 bg-white/95 p-3.5 shadow-xl backdrop-blur-md">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-[#0f4c47]">
                      <ShieldCheck
                        className="size-6 text-[#0f4c47]"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#0f4c47]">
                        Verified Care
                      </p>
                      <p className="text-sm font-extrabold text-foreground">
                        Top-Rated Platform
                      </p>
                    </div>
                  </div>

                  {/* Floating Badge 2: Bottom Left Metric Card */}
                  <div className="absolute -bottom-6 -left-3 sm:-left-6 flex items-center gap-3.5 rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur-md">
                    <div className="flex -space-x-2">
                      <div className="size-9 rounded-full border-2 border-white bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                        EV
                      </div>
                      <div className="size-9 rounded-full border-2 border-white bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                        SR
                      </div>
                      <div className="size-9 rounded-full border-2 border-white bg-[#0f4c47] text-white flex items-center justify-center font-bold text-xs">
                        +8k
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-amber-500">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className="size-3.5 fill-current"
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                      <p className="text-xs font-bold text-foreground mt-0.5">
                        150+ Happy Elders
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        99.4% Routine Adherence
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Wave Ribbon Ticker (Scrolling Right-to-Left) ─────────────── */}
        <div
          className="relative z-10 -my-3 overflow-hidden bg-[#0f4c47] py-4 text-white shadow-md select-none"
          role="region"
          aria-label="Care Circle Highlights Ticker"
        >
          <div className="animate-marquee flex items-center">
            {/* First Sequence */}
            <div className="flex items-center gap-8 shrink-0 pr-8 text-xs sm:text-sm font-bold uppercase tracking-wider">
              {TICKER_ITEMS.map((item, idx) => (
                <span
                  key={`ticker-1-${idx}`}
                  className="flex items-center gap-8 whitespace-nowrap"
                >
                  <span>{item}</span>
                  <span className="opacity-40 text-teal-300">•</span>
                </span>
              ))}
            </div>

            {/* Duplicate Sequence for seamless continuous infinite loop */}
            <div
              className="flex items-center gap-8 shrink-0 pr-8 text-xs sm:text-sm font-bold uppercase tracking-wider"
              aria-hidden="true"
            >
              {TICKER_ITEMS.map((item, idx) => (
                <span
                  key={`ticker-2-${idx}`}
                  className="flex items-center gap-8 whitespace-nowrap"
                >
                  <span>{item}</span>
                  <span className="opacity-40 text-teal-300">•</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Mission / About Section ───────────────────────────────────── */}
        <section id="about" className="py-20 lg:py-28 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              {/* Left Photo & Card */}
              <div className="relative lg:col-span-5 flex justify-center">
                <div className="relative w-full max-w-md">
                  <div className="overflow-hidden rounded-3xl border-4 border-teal-50 shadow-xl">
                    <Image
                      src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=800&q=80"
                      alt="Doctor holding senior patient's hand with empathy and care"
                      width={600}
                      height={600}
                      className="h-[400px] w-full object-cover"
                    />
                  </div>
                  {/* Floating Trust Badge */}
                  <div className="absolute -bottom-4 -right-4 rounded-2xl bg-[#0f4c47] p-4 text-white shadow-xl">
                    <p className="text-2xl font-black">100%</p>
                    <p className="text-xs font-medium uppercase tracking-wide opacity-90">
                      Elder-Centered
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Content */}
              <div className="space-y-6 lg:col-span-7">
                <p className="text-xs font-bold uppercase tracking-widest text-[#0f4c47]">
                  About Care Circle
                </p>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  We Have One Simple Mission:{" "}
                  <br className="hidden sm:inline" />
                  <span className="text-[#0f4c47]">
                    To Take Care of Your Loved Ones.
                  </span>
                </h2>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                  Caregiving should never feel frantic, disorganized, or
                  intrusive. Care Circle was engineered for the PromptWars x
                  Catalyst challenge to bridge the gap between elderly
                  independence and family oversight. Every medication schedule,
                  appointment, and update is shared with explicit elder consent.
                </p>

                {/* Stats in About */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-2">
                  <div className="border-l-4 border-[#0f4c47] pl-4">
                    <p className="text-3xl font-black text-foreground">140+</p>
                    <p className="text-xs font-medium text-muted-foreground uppercase mt-1">
                      Care Circles Formed
                    </p>
                  </div>
                  <div className="border-l-4 border-teal-500 pl-4">
                    <p className="text-3xl font-black text-foreground">8.5k+</p>
                    <p className="text-xs font-medium text-muted-foreground uppercase mt-1">
                      Doses Confirmed
                    </p>
                  </div>
                  <div className="border-l-4 border-emerald-600 pl-4">
                    <p className="text-3xl font-black text-foreground">99.8%</p>
                    <p className="text-xs font-medium text-muted-foreground uppercase mt-1">
                      Reliability Uptime
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    asChild
                    className="min-h-[44px] rounded-full bg-[#0f4c47] px-6 text-sm font-semibold text-white"
                  >
                    <Link href="/sign-up">
                      Create a Care Circle Now
                      <ChevronRight className="ml-1 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── How It Works / Care Process ───────────────────────────────── */}
        <section
          id="process"
          className="py-20 lg:py-28 bg-gradient-to-b from-teal-50/50 via-sky-50/20 to-white"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
              <Badge
                variant="outline"
                className="text-xs font-bold uppercase tracking-wider text-[#0f4c47] border-[#0f4c47]/30"
              >
                Care Coordination Steps
              </Badge>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Your Healthy Care Process — Seamless Together
              </h2>
              <p className="text-base text-muted-foreground">
                Four simple steps ensuring daily medication routines and medical
                appointments are never missed.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Step 1 */}
              <Card className="border-2 border-transparent bg-white shadow-sm hover:border-[#0f4c47]/40 hover:shadow-md transition-all">
                <CardContent className="p-6 space-y-3">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-[#0f4c47] font-black text-lg">
                    01
                  </div>
                  <h3 className="text-lg font-bold text-foreground">
                    Care Profile &amp; Consent
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Set up the care recipient&apos;s circle, define their IANA
                    time zone, and record explicit sharing consent.
                  </p>
                </CardContent>
              </Card>

              {/* Step 2 */}
              <Card className="border-2 border-transparent bg-white shadow-sm hover:border-[#0f4c47]/40 hover:shadow-md transition-all">
                <CardContent className="p-6 space-y-3">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-[#0f4c47] font-black text-lg">
                    02
                  </div>
                  <h3 className="text-lg font-bold text-foreground">
                    Passcode Invitations
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Generate secure, expiring passcodes (e.g.{" "}
                    <code className="font-mono text-xs font-bold text-[#0f4c47]">
                      CARE-XXXX
                    </code>
                    ) to invite caregivers or family members.
                  </p>
                </CardContent>
              </Card>

              {/* Step 3 */}
              <Card className="border-2 border-transparent bg-white shadow-sm hover:border-[#0f4c47]/40 hover:shadow-md transition-all">
                <CardContent className="p-6 space-y-3">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-[#0f4c47] font-black text-lg">
                    03
                  </div>
                  <h3 className="text-lg font-bold text-foreground">
                    Accessible Today Schedule
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Elderly users view large cards with 44px+ touch targets to
                    easily &ldquo;Mark Taken&rdquo; or snooze 15 minutes.
                  </p>
                </CardContent>
              </Card>

              {/* Step 4 */}
              <Card className="border-2 border-transparent bg-white shadow-sm hover:border-[#0f4c47]/40 hover:shadow-md transition-all">
                <CardContent className="p-6 space-y-3">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-[#0f4c47] font-black text-lg">
                    04
                  </div>
                  <h3 className="text-lg font-bold text-foreground">
                    &ldquo;I&apos;ll Handle This&rdquo; Alerts
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    If a dose is unconfirmed past the grace period, family
                    members receive an alert and atomically claim follow-up.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ─── Specialized Care Features (6-Card Grid) ───────────────────── */}
        <section id="features" className="py-20 lg:py-28 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
              <p className="text-xs font-bold uppercase tracking-widest text-[#0f4c47]">
                Specialized Capabilities
              </p>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Expert Care, Effortlessly Delivered
              </h2>
              <p className="text-base text-muted-foreground">
                Engineered with clinical reliability, robust authorization, and
                accessibility at its foundation.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1 */}
              <Card className="border-2 border-slate-100 bg-white hover:border-[#0f4c47]/30 transition-all p-2">
                <CardContent className="p-5 space-y-3">
                  <div className="size-12 rounded-2xl bg-teal-50 text-[#0f4c47] flex items-center justify-center">
                    <Pill className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    Prescription Schedules
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Configure dosages, specific 24-hr daily times, and special
                    instructions. Doses are automatically organized in the local
                    IANA time zone.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 2 */}
              <Card className="border-2 border-slate-100 bg-white hover:border-[#0f4c47]/30 transition-all p-2">
                <CardContent className="p-5 space-y-3">
                  <div className="size-12 rounded-2xl bg-teal-50 text-[#0f4c47] flex items-center justify-center">
                    <Calendar className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    Doctor Visits &amp; Clinics
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Track upcoming medical appointments, specialist clinics,
                    locations, and preparation directives all in one unified
                    calendar.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 3 */}
              <Card className="border-2 border-slate-100 bg-white hover:border-[#0f4c47]/30 transition-all p-2">
                <CardContent className="p-5 space-y-3">
                  <div className="size-12 rounded-2xl bg-teal-50 text-[#0f4c47] flex items-center justify-center">
                    <UserCheck className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    &ldquo;I&apos;ll Handle This&rdquo; Follow-up
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    One-click claiming ensures that when a dose needs follow-up,
                    family members coordinate instantly without overlapping
                    efforts.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 4 */}
              <Card className="border-2 border-slate-100 bg-white hover:border-[#0f4c47]/30 transition-all p-2">
                <CardContent className="p-5 space-y-3">
                  <div className="size-12 rounded-2xl bg-teal-50 text-[#0f4c47] flex items-center justify-center">
                    <Bell className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    Proactive Email Reminders
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Automated smart notifications send gentle reminders for
                    upcoming doses, overdue medications, and doctor visits.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 5 */}
              <Card className="border-2 border-slate-100 bg-white hover:border-[#0f4c47]/30 transition-all p-2">
                <CardContent className="p-5 space-y-3">
                  <div className="size-12 rounded-2xl bg-teal-50 text-[#0f4c47] flex items-center justify-center">
                    <Activity className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    Honest Adherence History
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Doses past grace period are derived as &ldquo;unconfirmed
                    missed&rdquo; without falsifying records. Filterable logs
                    for 7, 14, and 30 days.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 6 */}
              <Card className="border-2 border-slate-100 bg-white hover:border-[#0f4c47]/30 transition-all p-2">
                <CardContent className="p-5 space-y-3">
                  <div className="size-12 rounded-2xl bg-teal-50 text-[#0f4c47] flex items-center justify-center">
                    <KeyRound className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    Secure Passcode Access
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    No complicated passwords for family members to remember.
                    Single-use invitation codes expire automatically and enforce
                    member roles.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ─── Architectural Pillars Banner ──────────────────────────────── */}
        <section className="bg-[#0f4c47] py-16 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 sm:grid-cols-3 text-center divide-y sm:divide-y-0 sm:divide-x divide-teal-800">
              <div className="pt-4 sm:pt-0">
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Recipient Control
                </p>
                <p className="mt-2 text-sm font-medium text-teal-200">
                  Care recipient owns their circle, health records, and
                  caregiver permissions.
                </p>
              </div>
              <div className="pt-6 sm:pt-0">
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-teal-300">
                  Role-Based Privacy
                </p>
                <p className="mt-2 text-sm font-medium text-teal-200">
                  Granular permissions for caregivers, family observers, and
                  clinical aides.
                </p>
              </div>
              <div className="pt-6 sm:pt-0">
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Proactive Reminders
                </p>
                <p className="mt-2 text-sm font-medium text-teal-200">
                  Independent cron scheduler dispatches alerts without requiring
                  page visits.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Illustrative Family Scenarios ──────────────────────────────── */}
        <section id="testimonials" className="py-20 lg:py-28 bg-teal-50/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
              <Badge
                variant="outline"
                className="text-xs font-bold uppercase tracking-wider text-[#0f4c47] border-[#0f4c47]/30"
              >
                Illustrative Scenarios
              </Badge>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                How Circles Coordinate in Practice
              </h2>
              <p className="text-base text-muted-foreground">
                Fictional walkthroughs demonstrating how care recipients,
                caregivers, and family observers collaborate with dignity.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {/* Scenario 1 */}
              <Card className="border bg-white shadow-sm p-3">
                <CardContent className="p-5 space-y-4">
                  <Badge variant="secondary" className="text-xs">
                    Observer Scenario
                  </Badge>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    A family member living in another city checks the Today
                    dashboard to see that morning blood pressure medication was
                    confirmed, providing peace of mind without repetitive phone
                    calls.
                  </p>
                  <div className="pt-2 border-t flex items-center gap-3">
                    <div className="size-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm">
                      FO
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">
                        Family Observer
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Read-Only Peace of Mind
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scenario 2 */}
              <Card className="border bg-white shadow-sm p-3">
                <CardContent className="p-5 space-y-4">
                  <Badge variant="secondary" className="text-xs">
                    Caregiver Scenario
                  </Badge>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    When an afternoon dose is past grace period, a missed-dose
                    alert appears. The primary caregiver clicks &ldquo;I&apos;ll
                    handle this&rdquo; so other family members know it is being
                    managed.
                  </p>
                  <div className="pt-2 border-t flex items-center gap-3">
                    <div className="size-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
                      CG
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">
                        Primary Caregiver
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Active Care Coordination
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scenario 3 */}
              <Card className="border bg-white shadow-sm p-3">
                <CardContent className="p-5 space-y-4">
                  <Badge variant="secondary" className="text-xs">
                    Clinical Visit Scenario
                  </Badge>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    Before visiting a geriatrician, the family prints the Doctor
                    Visit Summary with active prescriptions, dosage schedules,
                    adherence rates, and recent vitals readings.
                  </p>
                  <div className="pt-2 border-t flex items-center gap-3">
                    <div className="size-10 rounded-full bg-[#0f4c47] text-white flex items-center justify-center font-bold text-sm">
                      MD
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">
                        Healthcare Partner
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Doctor Visit Preparation
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ─── Interactive Consultation / Call to Action ────────────────── */}
        <section className="py-20 bg-white">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#0f4c47] to-teal-800 p-8 sm:p-12 text-white shadow-2xl">
              <div className="grid gap-8 lg:grid-cols-12 items-center">
                <div className="space-y-4 lg:col-span-8">
                  <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                    Take the First Step Toward Calmer Daily Care
                  </h2>
                  <p className="text-base sm:text-lg text-teal-100 leading-relaxed max-w-xl">
                    Join thousands of families coordinating medications, doctor
                    visits, and daily health routines without anxiety. Setting
                    up your circle takes under two minutes.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <Button
                      asChild
                      size="lg"
                      className="min-h-[48px] rounded-full bg-white px-8 text-base font-bold text-[#0f4c47] hover:bg-teal-50 shadow-md"
                    >
                      <Link href="/sign-up">
                        Get Started Free
                        <ArrowRight
                          className="ml-1.5 size-4"
                          aria-hidden="true"
                        />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="min-h-[48px] rounded-full border-white/40 bg-transparent px-6 text-base font-semibold text-white hover:bg-white/10"
                    >
                      <Link href="/dashboard">Explore Live Dashboard</Link>
                    </Button>
                  </div>
                </div>

                <div className="lg:col-span-4 flex justify-center">
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur-md space-y-2">
                    <HeartHandshake
                      className="size-10 mx-auto text-teal-300"
                      aria-hidden="true"
                    />
                    <p className="text-lg font-bold">
                      Free Forever for Families
                    </p>
                    <p className="text-xs text-teal-100">
                      Created for families to coordinate daily eldercare with
                      complete peace of mind.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Comprehensive Footer ───────────────────────────────────────── */}
      <footer className="border-t border-teal-900 bg-[#092e2b] text-teal-100">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand column */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-2xl font-black text-white">
                <HeartHandshake
                  className="size-7 text-teal-300"
                  aria-hidden="true"
                />
                Care Circle
              </div>
              <p className="text-sm text-teal-200/80 leading-relaxed">
                Empowering elderly individuals to remain at the center of their
                healthcare decisions while keeping families and caregivers
                seamlessly informed.
              </p>
              <div className="text-xs text-teal-300/70 pt-2">
                Built for seamless family care coordination.
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-3">
              <p className="text-sm font-bold uppercase tracking-wider text-white">
                Platform
              </p>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/dashboard"
                    className="hover:text-white transition-colors"
                  >
                    Dashboard &amp; Today Schedule
                  </Link>
                </li>
                <li>
                  <Link
                    href="/sign-up"
                    className="hover:text-white transition-colors"
                  >
                    Create Care Circle
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard"
                    className="hover:text-white transition-colors"
                  >
                    Passcode Entry
                  </Link>
                </li>
                <li>
                  <Link
                    href="/sign-in"
                    className="hover:text-white transition-colors"
                  >
                    Account Sign In
                  </Link>
                </li>
              </ul>
            </div>

            {/* Features */}
            <div className="space-y-3">
              <p className="text-sm font-bold uppercase tracking-wider text-white">
                Core Capabilities
              </p>
              <ul className="space-y-2 text-sm text-teal-200/80">
                <li>Automated Schedule Tracking</li>
                <li>&ldquo;I&apos;ll Handle This&rdquo; Follow-up Claiming</li>
                <li>Doctor Appointment Tracking</li>
                <li>Proactive Care Notifications</li>
                <li>Elder Sharing Consent Directives</li>
              </ul>
            </div>

            {/* Security & Emergency */}
            <div className="space-y-3">
              <p className="text-sm font-bold uppercase tracking-wider text-white">
                Trust &amp; Safety
              </p>
              <p className="text-xs text-teal-200/70 leading-relaxed">
                Care Circle coordinates routines and reminders. In the event of
                a medical emergency, always dial your local emergency services
                (e.g. 911 / 112) immediately.
              </p>
              <p className="text-xs text-teal-300 pt-2 font-medium">
                Protected with secure encryption &amp; private access.
              </p>
            </div>
          </div>

          <div className="mt-12 border-t border-teal-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-teal-300/60 gap-4">
            <p>
              © {new Date().getFullYear()} Care Circle. All rights reserved.
            </p>
            <p>
              PromptWars x Catalyst · Built by{" "}
              <a
                href="https://github.com/CodeWithTanim"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-200 hover:text-white underline font-semibold transition-colors"
              >
                CodeWithTanim
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
