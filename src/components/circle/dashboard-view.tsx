"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronDown,
  HeartHandshake,
  Pill,
  Plus,
  Users,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Circle, CircleRole, Membership } from "@/lib/models";
import { AdherenceView } from "./adherence-view";
import { AppointmentsView } from "./appointments-view";
import { MedicationsView } from "./medications-view";
import { MembersView } from "./members-view";
import { TodayView } from "./today-view";

interface DashboardViewProps {
  initialCircles: Array<{
    circle: Circle;
    role: CircleRole;
    memberCount: number;
  }>;
  currentCircleId: string;
  userName: string;
  userId: string;
}

export function DashboardView({
  initialCircles,
  currentCircleId,
  userName,
  userId,
}: DashboardViewProps) {
  const router = useRouter();
  const [activeCircleId, setActiveCircleId] = useState(currentCircleId);
  const [activeTab, setActiveTab] = useState<
    "today" | "medications" | "appointments" | "members" | "adherence"
  >("today");

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
    router.push(`/dashboard?circle=${id}`);
  }

  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 md:py-10 space-y-8"
    >
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-2xl font-bold tracking-tight text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1"
          >
            <HeartHandshake
              className="size-8 text-primary"
              aria-hidden="true"
            />
            Care Circle
          </Link>

          {/* Circle Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="min-h-[44px] gap-2 font-medium text-base border-primary/30"
              >
                <span className="font-semibold text-foreground">
                  {currentCircle.name}
                </span>
                <Badge
                  variant="secondary"
                  className="capitalize text-xs font-normal"
                >
                  {currentRole}
                </Badge>
                <ChevronDown className="size-4 opacity-70" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                Your Circles
              </div>
              {initialCircles.map((item) => (
                <DropdownMenuItem
                  key={item.circle._id}
                  onClick={() => switchCircle(item.circle._id)}
                  className="cursor-pointer py-2 text-base flex items-center justify-between"
                >
                  <span className="truncate font-medium">
                    {item.circle.name}
                  </span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.role}
                  </Badge>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/dashboard?onboarding=true")}
                className="cursor-pointer py-2 text-primary font-medium flex items-center gap-2"
              >
                <Plus className="size-4" aria-hidden="true" />
                Create or Join Another Circle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="text-sm text-muted-foreground hidden md:inline">
            Signed in as <strong>{userName}</strong>
          </span>
          <SignOutButton />
        </div>
      </header>

      {/* Accessible Main Tabs Navigation */}
      <nav aria-label="Care Circle sections">
        <div className="flex overflow-x-auto border-b border-border/80 pb-px gap-1 sm:gap-2">
          <Button
            variant={activeTab === "today" ? "default" : "ghost"}
            onClick={() => setActiveTab("today")}
            className={`min-h-[44px] px-4 sm:px-5 text-base font-semibold rounded-t-lg rounded-b-none border-b-2 gap-2 transition-all ${
              activeTab === "today"
                ? "border-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="size-5" aria-hidden="true" />
            Today
          </Button>

          <Button
            variant={activeTab === "medications" ? "default" : "ghost"}
            onClick={() => setActiveTab("medications")}
            className={`min-h-[44px] px-4 sm:px-5 text-base font-semibold rounded-t-lg rounded-b-none border-b-2 gap-2 transition-all ${
              activeTab === "medications"
                ? "border-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Pill className="size-5" aria-hidden="true" />
            Medications
          </Button>

          <Button
            variant={activeTab === "appointments" ? "default" : "ghost"}
            onClick={() => setActiveTab("appointments")}
            className={`min-h-[44px] px-4 sm:px-5 text-base font-semibold rounded-t-lg rounded-b-none border-b-2 gap-2 transition-all ${
              activeTab === "appointments"
                ? "border-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="size-5" aria-hidden="true" />
            Appointments
          </Button>

          <Button
            variant={activeTab === "members" ? "default" : "ghost"}
            onClick={() => setActiveTab("members")}
            className={`min-h-[44px] px-4 sm:px-5 text-base font-semibold rounded-t-lg rounded-b-none border-b-2 gap-2 transition-all ${
              activeTab === "members"
                ? "border-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="size-5" aria-hidden="true" />
            Circle Members
          </Button>

          <Button
            variant={activeTab === "adherence" ? "default" : "ghost"}
            onClick={() => setActiveTab("adherence")}
            className={`min-h-[44px] px-4 sm:px-5 text-base font-semibold rounded-t-lg rounded-b-none border-b-2 gap-2 transition-all ${
              activeTab === "adherence"
                ? "border-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="size-5" aria-hidden="true" />
            Adherence
          </Button>
        </div>
      </nav>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === "today" && (
          <TodayView
            circle={currentCircle}
            canConfirm={canConfirm}
            onNavigateToTab={(tab) =>
              setActiveTab(
                tab as
                  | "today"
                  | "medications"
                  | "appointments"
                  | "members"
                  | "adherence",
              )
            }
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

        {activeTab === "adherence" && <AdherenceView circle={currentCircle} />}
      </div>
    </main>
  );
}
