"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  HeartHandshake,
  LoaderCircle,
  Menu,
  Pill,
  Plus,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Circle, CircleRole, Membership } from "@/lib/models";
import { isValidTab, type DashboardTab } from "@/lib/tabs";
import { AdherenceView } from "./adherence-view";
import { AiAssistantView } from "./ai-assistant-view";
import { AppointmentsView } from "./appointments-view";
import { MedicationsView } from "./medications-view";
import { MembersView } from "./members-view";
import { SettingsView } from "./settings-view";
import { TodayView } from "./today-view";

export type { DashboardTab };
export { isValidTab };

interface DashboardViewProps {
  initialCircles: Array<{
    circle: Circle;
    role: CircleRole;
    memberCount: number;
  }>;
  currentCircleId: string;
  initialTab?: DashboardTab;
  userName: string;
  userId: string;
}

const NAV_ITEMS: Array<{
  id: DashboardTab;
  label: string;
  icon: React.ComponentType<{
    className?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
  description: string;
}> = [
  {
    id: "today",
    label: "Today",
    icon: CheckCircle2,
    description: "Daily routine & alerts",
  },
  {
    id: "medications",
    label: "Medications",
    icon: Pill,
    description: "Prescriptions & schedules",
  },
  {
    id: "appointments",
    label: "Appointments",
    icon: Calendar,
    description: "Doctor visits & preps",
  },
  {
    id: "members",
    label: "Circle Members",
    icon: Users,
    description: "Caregivers & family",
  },
  {
    id: "adherence",
    label: "Adherence",
    icon: Activity,
    description: "History & routines",
  },
  {
    id: "ai",
    label: "Gemini AI",
    icon: Sparkles,
    description: "Care & medication intelligence",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    description: "Time zone & profile",
  },
];

export function DashboardView({
  initialCircles,
  currentCircleId,
  initialTab,
  userName,
  userId,
}: DashboardViewProps) {
  const router = useRouter();
  const [activeCircleId, setActiveCircleId] = useState(currentCircleId);
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    initialTab ?? "today",
  );
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile drawer
  const [isCollapsed, setIsCollapsed] = useState(false); // Desktop mini-sidebar

  // Sync active tab with browser address bar without a full page reload
  function switchTab(tab: DashboardTab) {
    setActiveTab(tab);
    setSidebarOpen(false); // Close mobile drawer when an item is selected
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", tab);
      if (activeCircleId) {
        params.set("circle", activeCircleId);
      }
      const newUrl = `/dashboard?${params.toString()}`;
      window.history.replaceState(null, "", newUrl);
    }
  }

  // Handle browser back and forward button clicks
  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (isValidTab(tabParam)) {
        setActiveTab(tabParam);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const currentItem =
    initialCircles.find((c) => c.circle._id === activeCircleId) ??
    initialCircles[0];

  const currentCircle = currentItem?.circle;
  const currentRole = currentItem?.role ?? "family";

  // Build a synthetic Membership object for props
  const currentMembership: Membership = {
    _id: "current",
    circleId: currentCircle._id,
    userId,
    role: currentRole,
    name: userName,
    email: "",
    joinedAt: new Date(currentCircle.createdAt),
    notifications: {
      upcomingDoses: true,
      missedDoses: true,
      appointments: true,
    },
  };

  const isElder =
    (currentCircle.isRecipientUser && currentCircle.createdBy === userId) ||
    currentCircle.recipientUserId === userId;
  const canConfirm =
    currentRole === "owner" || currentRole === "caregiver" || isElder;
  const canManage = currentRole === "owner" || currentRole === "caregiver";

  function switchCircle(id: string) {
    setActiveCircleId(id);
    setSidebarOpen(false);
    router.push(`/dashboard?circle=${id}&tab=${activeTab}`);
  }

  const [isDemoTourOpen, setIsDemoTourOpen] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);

  async function handleSeedDemoTour() {
    setSeedingDemo(true);
    try {
      const res = await fetch("/api/demo/seed", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load demo scenario");
      }

      toast.success("Fictional evaluation demo scenario loaded successfully!");
      setIsDemoTourOpen(false);

      if (data.circleId) {
        router.push(`/dashboard?circle=${data.circleId}&tab=today`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading demo";
      toast.error(msg);
    } finally {
      setSeedingDemo(false);
    }
  }

  function handleHamburgerClick() {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => !prev);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ─── Fixed Top Bar (YouTube style) ───────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 h-16 border-b border-border/80 bg-background/95 backdrop-blur-md z-40 flex items-center justify-between px-3 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleHamburgerClick}
            aria-label="Toggle navigation sidebar"
            className="size-10 rounded-full hover:bg-muted text-foreground"
          >
            <Menu className="size-5" />
          </Button>

          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-[#0f4c47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#0f4c47] text-white shadow-sm">
              <HeartHandshake className="size-5" aria-hidden="true" />
            </div>
            <span className="font-extrabold tracking-tight text-foreground hidden sm:inline">
              Care<span className="text-[#0f4c47]">Circle</span>
            </span>
          </Link>

          {/* Active Circle Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 px-3 text-sm font-semibold border-border/80 flex items-center gap-2 max-w-[200px] sm:max-w-[260px] truncate ml-2 rounded-full"
                aria-label={`Current circle: ${currentCircle.name}. Click to switch.`}
              >
                <span className="truncate">{currentCircle.name}</span>
                <Badge
                  variant="secondary"
                  className="capitalize text-[10px] px-1.5 py-0 font-medium hidden xs:inline"
                >
                  {currentRole}
                </Badge>
                <ChevronDown
                  className="size-3.5 shrink-0 opacity-60"
                  aria-hidden="true"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Your Circles
              </div>
              {initialCircles.map((item) => (
                <DropdownMenuItem
                  key={item.circle._id}
                  onClick={() => switchCircle(item.circle._id)}
                  className="cursor-pointer py-2 text-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    {item.circle._id === activeCircleId && (
                      <Check className="size-4 text-[#0f4c47] shrink-0" />
                    )}
                    <span
                      className={`truncate ${
                        item.circle._id === activeCircleId ? "font-bold" : ""
                      }`}
                    >
                      {item.circle.name}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.role}
                  </Badge>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/dashboard?onboarding=true")}
                className="cursor-pointer py-2 text-[#0f4c47] font-semibold flex items-center gap-2"
              >
                <Plus className="size-4" aria-hidden="true" />
                Create or Join Another Circle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Evaluator Demo Mode Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDemoTourOpen(true)}
            className="h-9 px-3 gap-1.5 text-xs font-bold border-amber-300 bg-amber-50 hover:bg-amber-100/90 text-amber-900 rounded-full shadow-2xs transition-colors"
            title="Load PromptWars x Catalyst Evaluation Demo Scenario"
          >
            <Sparkles
              className="size-3.5 text-amber-600 animate-pulse"
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Evaluator Demo Tour</span>
            <span className="sm:hidden font-semibold">Demo</span>
          </Button>

          <span className="text-sm text-muted-foreground hidden lg:inline">
            Signed in as <strong>{userName}</strong>
          </span>
          <SignOutButton />
        </div>
      </header>

      {/* ─── Desktop Fixed Left Sidebar (YouTube style) ─────────────────── */}
      <aside
        aria-label="Sidebar Navigation"
        className={`fixed top-16 bottom-0 left-0 z-30 hidden md:flex flex-col border-r border-border/80 bg-card/95 backdrop-blur-sm transition-all duration-200 select-none ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main Navigation Items */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              if (isCollapsed) {
                return (
                  <button
                    key={item.id}
                    onClick={() => switchTab(item.id)}
                    title={item.label}
                    className={`w-full flex flex-col items-center justify-center py-3 px-1 rounded-xl transition-all min-h-[56px] ${
                      isActive
                        ? "bg-[#0f4c47] text-white font-bold shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="text-[10px] mt-1 truncate max-w-[68px]">
                      {item.label}
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => switchTab(item.id)}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left transition-all min-h-[48px] ${
                    isActive
                      ? "bg-[#0f4c47] text-white font-bold shadow-sm shadow-teal-950/10"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
                  }`}
                >
                  <Icon
                    className={`size-5 shrink-0 ${
                      isActive ? "text-white" : "text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  />
                  <div className="truncate">
                    <p className="text-sm leading-none font-semibold">
                      {item.label}
                    </p>
                    <p
                      className={`text-[11px] mt-1 truncate ${
                        isActive ? "text-teal-100/90" : "text-muted-foreground"
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Circles Section (Expanded only) */}
          {!isCollapsed && (
            <div className="pt-4 border-t border-border/80">
              <div className="px-3 pb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Your Circles
                </span>
                <button
                  onClick={() => router.push("/dashboard?onboarding=true")}
                  className="text-xs font-semibold text-[#0f4c47] hover:underline flex items-center gap-1"
                  title="Create or join circle"
                >
                  <Plus className="size-3.5" />
                  <span>New</span>
                </button>
              </div>

              <div className="space-y-1">
                {initialCircles.map((item) => {
                  const isCurrent = item.circle._id === activeCircleId;
                  return (
                    <button
                      key={item.circle._id}
                      onClick={() => switchCircle(item.circle._id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-all ${
                        isCurrent
                          ? "bg-teal-50/80 text-[#0f4c47] font-bold border border-teal-200/80"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span className="truncate">{item.circle.name}</span>
                      <Badge
                        variant={isCurrent ? "default" : "outline"}
                        className={`text-[10px] capitalize px-1.5 py-0 ${
                          isCurrent ? "bg-[#0f4c47] text-white" : ""
                        }`}
                      >
                        {item.role}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer info */}
        {!isCollapsed && (
          <div className="p-3 border-t border-border/80 bg-muted/30 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground truncate">
              {currentCircle.name}
            </p>
            <p className="text-[11px] mt-0.5 truncate">
              Timezone: {currentCircle.timezone}
            </p>
          </div>
        )}
      </aside>

      {/* ─── Mobile Sidebar Overlay Drawer ───────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Mobile Navigation"
        className={`fixed top-0 bottom-0 left-0 w-72 bg-card border-r border-border z-50 md:hidden flex flex-col shadow-2xl transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 border-b border-border/80 flex items-center justify-between px-4">
          <Link
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-[#0f4c47]"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#0f4c47] text-white shadow-sm">
              <HeartHandshake className="size-5" aria-hidden="true" />
            </div>
            <span className="font-extrabold tracking-tight text-foreground">
              Care<span className="text-[#0f4c47]">Circle</span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="size-9 rounded-full"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => switchTab(item.id)}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left transition-all min-h-[48px] ${
                    isActive
                      ? "bg-[#0f4c47] text-white font-bold shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
                  }`}
                >
                  <Icon
                    className={`size-5 shrink-0 ${
                      isActive ? "text-white" : "text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  />
                  <div className="truncate">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p
                      className={`text-[11px] truncate ${
                        isActive ? "text-teal-100/90" : "text-muted-foreground"
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-border/80">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-2">
              Your Circles
            </p>
            <div className="space-y-1">
              {initialCircles.map((item) => {
                const isCurrent = item.circle._id === activeCircleId;
                return (
                  <button
                    key={item.circle._id}
                    onClick={() => switchCircle(item.circle._id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-all ${
                      isCurrent
                        ? "bg-teal-50 text-[#0f4c47] font-bold border border-teal-200"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">{item.circle.name}</span>
                    <Badge
                      variant={isCurrent ? "default" : "outline"}
                      className={`text-xs capitalize ${
                        isCurrent ? "bg-[#0f4c47] text-white" : ""
                      }`}
                    >
                      {item.role}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setSidebarOpen(false);
                router.push("/dashboard?onboarding=true");
              }}
              className="w-full mt-3 text-[#0f4c47] font-semibold flex items-center justify-center gap-2"
            >
              <Plus className="size-4" />
              Create or Join Another Circle
            </Button>
          </div>
        </div>

        <div className="p-4 border-t border-border/80 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-3 truncate">
            Signed in as <strong>{userName}</strong>
          </p>
          <SignOutButton />
        </div>
      </aside>

      {/* ─── Main Content Container (Scrolled beside fixed sidebar) ──────── */}
      <main
        id="main-content"
        className={`flex-1 transition-all duration-200 pt-20 pb-16 px-4 sm:px-6 md:px-8 ${
          isCollapsed ? "md:pl-24" : "md:pl-72"
        }`}
      >
        <div className="mx-auto max-w-5xl">
          {activeTab === "today" && (
            <TodayView
              circle={currentCircle}
              canConfirm={canConfirm}
              onNavigateToTab={(tab) => {
                if (isValidTab(tab)) switchTab(tab);
              }}
            />
          )}

          {activeTab === "medications" && (
            <MedicationsView circle={currentCircle} canManage={canManage} />
          )}

          {activeTab === "appointments" && (
            <AppointmentsView circle={currentCircle} canManage={canManage} />
          )}

          {activeTab === "members" && (
            <MembersView
              circle={currentCircle}
              currentMembership={currentMembership}
            />
          )}

          {activeTab === "adherence" && (
            <AdherenceView circle={currentCircle} />
          )}

          {activeTab === "ai" && <AiAssistantView circle={currentCircle} />}

          {activeTab === "settings" && (
            <SettingsView
              circle={currentCircle}
              currentMembership={currentMembership}
              canManage={canManage}
              onCircleUpdated={() => {
                router.refresh();
              }}
            />
          )}
        </div>
      </main>

      {/* ─── Evaluator Demo Tour Modal ───────────────────────────────────── */}
      <Dialog open={isDemoTourOpen} onOpenChange={setIsDemoTourOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold">
                  PromptWars x Catalyst — Evaluator Tour
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Instant one-click setup of our complete fictional clinical
                  evaluation scenario.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm text-foreground">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2">
              <p className="font-semibold text-amber-950 text-xs uppercase tracking-wider">
                What this loads into your Care Circle:
              </p>
              <ul className="space-y-2 text-xs text-amber-900">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Eleanor Vance (Elder):</strong> 78-year-old
                    fictional recipient with complete emergency contacts &amp;
                    primary physician.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>
                      3 Scheduled Medications &amp; AI Care Guides:
                    </strong>{" "}
                    Lisinopril (10mg), Metformin (500mg), and Vitamin D3 (2000
                    IU) with Google Gemini food &amp; care explainer.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Live Overdue Dose Simulation:</strong> An overdue
                    morning dose ready to test the{" "}
                    <em>&quot;I&apos;ll handle this&quot;</em> claiming protocol
                    to prevent duplicate outreach.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Doctor Visits with Google Calendar Sync:</strong>{" "}
                    Upcoming Cardiology follow-up with Google Calendar, Google
                    Maps, and printable visit summary sheet.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Senior Accessibility Mode &amp; Vitals:</strong>{" "}
                    High-contrast Senior Mode with voice assistant, daily BP,
                    blood glucose, and hydration routine.
                  </span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Clicking <strong>Load Evaluation Scenario</strong> will populate
              Eleanor Vance&apos;s records into this circle safely and switch to
              the <em>Today</em> view.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDemoTourOpen(false)}
              disabled={seedingDemo}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSeedDemoTour}
              disabled={seedingDemo}
              className="bg-[#0f4c47] hover:bg-[#0c3c38] text-white font-semibold gap-2"
            >
              {seedingDemo ? (
                <>
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  Loading Scenario...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" aria-hidden="true" />
                  Load Evaluation Scenario
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
