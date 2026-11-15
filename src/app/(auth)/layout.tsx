import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  HeartHandshake,
  Lock,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex flex-col lg:grid lg:grid-cols-12 bg-background antialiased selection:bg-teal-100 selection:text-teal-900">
      {/* ─── Left Column: Healthcare Brand Showcase (Desktop only) ───── */}
      <aside
        aria-label="Care Circle Overview"
        className="hidden lg:flex lg:col-span-5 xl:col-span-5 relative overflow-hidden bg-gradient-to-br from-[#042420] via-[#083833] to-[#0f4c47] text-white p-10 xl:p-14 flex-col justify-between"
      >
        {/* Ambient Decorative Lighting */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-teal-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 size-96 rounded-full bg-emerald-300/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]"
        />

        {/* Brand Header */}
        <div className="relative z-10">
          <Link
            href="/"
            className="group inline-flex items-center gap-3 transition-opacity hover:opacity-90"
          >
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md shadow-lg shadow-black/10 transition-transform group-hover:scale-105">
              <HeartHandshake
                className="size-6 text-teal-200"
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white leading-tight">
                Care Circle
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-200/90">
                Elder Care Platform
              </span>
            </div>
          </Link>
        </div>

        {/* Center Showcase Content */}
        <div className="relative z-10 space-y-6 my-auto py-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-teal-900/40 px-3.5 py-1.5 text-xs font-medium text-teal-100 backdrop-blur-xs">
            <span
              className="size-2 rounded-full bg-emerald-400 animate-pulse"
              aria-hidden="true"
            />
            <span>Dignified Family Care Coordination</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
            A calmer way to care for the ones who cared for you.
          </h2>

          <p className="text-sm xl:text-base text-teal-100/80 leading-relaxed max-w-md">
            Coordinate daily medications, schedule doctor visits, and handle
            alerts in one shared space — with the elder always in complete
            control.
          </p>

          {/* Feature Highlights */}
          <div className="space-y-3 pt-2 text-xs xl:text-sm text-teal-100/90 font-medium">
            <div className="flex items-center gap-2.5">
              <CheckCircle2
                className="size-4.5 text-emerald-400 shrink-0"
                aria-hidden="true"
              />
              <span>100% elder consent and full dignity controls</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2
                className="size-4.5 text-emerald-400 shrink-0"
                aria-hidden="true"
              />
              <span>
                Instant &ldquo;I&apos;ll Handle This&rdquo; caregiver alert
                claim
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2
                className="size-4.5 text-emerald-400 shrink-0"
                aria-hidden="true"
              />
              <span>Secure passcode invitations with zero spam</span>
            </div>
          </div>

          {/* Testimonial Quote Card */}
          <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4.5 backdrop-blur-md shadow-xl text-xs space-y-2.5">
            <div className="flex items-center gap-1 text-amber-300">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="size-3.5 fill-current"
                  aria-hidden="true"
                />
              ))}
            </div>
            <p className="text-teal-50 italic leading-relaxed">
              &ldquo;Before Care Circle, we constantly worried if Mom remembered
              her blood pressure medicine. Now everyone in our family stays
              synced with total peace of mind.&rdquo;
            </p>
            <div className="flex items-center gap-2.5 pt-1 border-t border-white/10">
              <div className="flex size-7 items-center justify-center rounded-full bg-teal-500/30 text-white font-bold text-[11px] border border-white/20">
                SK
              </div>
              <div>
                <p className="font-semibold text-white text-[12px] leading-none">
                  Sarah K. &amp; Family
                </p>
                <p className="text-[11px] text-teal-200/80 mt-0.5">
                  Primary Family Caregiver
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Metrics */}
        <div className="relative z-10 pt-4 border-t border-white/15 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg xl:text-xl font-extrabold text-white">
              8,000+
            </p>
            <p className="text-[11px] text-teal-200/80">Active Circles</p>
          </div>
          <div>
            <p className="text-lg xl:text-xl font-extrabold text-white">
              99.4%
            </p>
            <p className="text-[11px] text-teal-200/80">Adherence</p>
          </div>
          <div>
            <p className="text-lg xl:text-xl font-extrabold text-white">
              256-bit
            </p>
            <p className="text-[11px] text-teal-200/80">Encrypted</p>
          </div>
        </div>
      </aside>

      {/* ─── Right Column: Authentication Card & Navigation ─────────── */}
      <main
        id="main-content"
        className="flex-1 lg:col-span-7 xl:col-span-7 flex flex-col justify-between min-h-screen p-4 sm:p-8 lg:p-12 relative bg-gradient-to-b from-teal-50/40 via-background to-background"
      >
        {/* Subtle Ambient Orb */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 size-80 bg-teal-100/50 rounded-full blur-3xl -z-10"
        />

        {/* Top Navigation Row */}
        <header className="flex items-center justify-between w-full max-w-md mx-auto lg:max-w-none">
          {/* Mobile Logo */}
          <Link
            href="/"
            className="lg:hidden flex items-center gap-2 font-bold text-base text-foreground"
          >
            <div className="flex size-8 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-[#0f4c47]">
              <HeartHandshake
                className="size-5 text-[#0f4c47]"
                aria-hidden="true"
              />
            </div>
            <span>Care Circle</span>
          </Link>

          {/* Back to Home Button */}
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all rounded-full border border-border/80 bg-background/80 backdrop-blur-xs px-3.5 py-1.5 shadow-2xs hover:border-foreground/30 hover:bg-background"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Back to website</span>
          </Link>
        </header>

        {/* Center Container for Auth Form */}
        <div className="flex-1 flex items-center justify-center py-6 sm:py-10">
          <div className="w-full max-w-md mx-auto">{children}</div>
        </div>

        {/* Bottom Trust Indicators */}
        <footer className="w-full max-w-md mx-auto lg:max-w-none pt-4 border-t border-border/60">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck
                className="size-4 text-[#0f4c47]"
                aria-hidden="true"
              />
              HIPAA-aligned principles
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-4 text-[#0f4c47]" aria-hidden="true" />
              End-to-end encrypted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4 text-[#0f4c47]" aria-hidden="true" />
              Family-first privacy
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
