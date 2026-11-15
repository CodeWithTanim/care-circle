import Link from "next/link";
import { ArrowLeft, HeartHandshake } from "lucide-react";

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

        {/* Center Showcase Content (Clean & Minimal) */}
        <div className="relative z-10 space-y-4 my-auto py-12 max-w-md">
          <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
            A calmer way to care for the ones you love.
          </h2>

          <p className="text-base text-teal-100/80 leading-relaxed">
            Medication routines, doctor visits, and daily vitals in one shared
            family circle.
          </p>
        </div>

        {/* Footer Note */}
        <div className="relative z-10 pt-4 border-t border-white/15 text-xs text-teal-200/70">
          Private, secure, and always centered around the elder.
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

        {/* Bottom Trust Indicators (Clean & Simple) */}
        <footer className="w-full max-w-md mx-auto lg:max-w-none pt-4 text-center text-xs text-muted-foreground">
          Protected with secure encryption &amp; private access
        </footer>
      </main>
    </div>
  );
}
