"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Clock,
  Copy,
  Globe,
  HeartHandshake,
  LoaderCircle,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Circle, Membership } from "@/lib/models";

interface SettingsViewProps {
  circle: Circle;
  currentMembership: Membership;
  canManage: boolean;
  onCircleUpdated?: (updated: Circle) => void;
}

const POPULAR_TIMEZONES = [
  // South Asia
  {
    value: "Asia/Dhaka",
    label: "Asia/Dhaka (Bangladesh Standard Time, GMT+6)",
  },
  {
    value: "Asia/Calcutta",
    label: "Asia/Calcutta / Kolkata (India Standard Time, GMT+5:30)",
  },
  {
    value: "Asia/Karachi",
    label: "Asia/Karachi (Pakistan Standard Time, GMT+5)",
  },
  { value: "Asia/Dubai", label: "Asia/Dubai (Gulf Standard Time, GMT+4)" },

  // East & Southeast Asia
  {
    value: "Asia/Singapore",
    label: "Asia/Singapore (Singapore Standard Time, GMT+8)",
  },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (Indochina Time, GMT+7)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (Japan Standard Time, GMT+9)" },
  {
    value: "Asia/Hong_Kong",
    label: "Asia/Hong Kong (Hong Kong Time, GMT+8)",
  },

  // Americas
  {
    value: "America/New_York",
    label: "America/New York (Eastern Time - US & Canada)",
  },
  {
    value: "America/Chicago",
    label: "America/Chicago (Central Time - US & Canada)",
  },
  {
    value: "America/Denver",
    label: "America/Denver (Mountain Time - US & Canada)",
  },
  {
    value: "America/Los_Angeles",
    label: "America/Los Angeles (Pacific Time - US & Canada)",
  },
  { value: "America/Phoenix", label: "America/Phoenix (Arizona, No DST)" },
  { value: "America/Anchorage", label: "America/Anchorage (Alaska Time)" },
  { value: "America/Toronto", label: "America/Toronto (Canada Eastern)" },
  {
    value: "America/Vancouver",
    label: "America/Vancouver (Canada Pacific)",
  },

  // Europe
  {
    value: "Europe/London",
    label: "Europe/London (Greenwich Mean Time / BST)",
  },
  {
    value: "Europe/Paris",
    label: "Europe/Paris (Central European Time, GMT+1)",
  },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET, GMT+1)" },
  { value: "Europe/Dublin", label: "Europe/Dublin (Ireland, GMT)" },

  // Australia & Pacific
  {
    value: "Australia/Sydney",
    label: "Australia/Sydney (Eastern Australia, GMT+10/11)",
  },
  {
    value: "Pacific/Auckland",
    label: "Pacific/Auckland (New Zealand, GMT+12/13)",
  },
  {
    value: "Pacific/Honolulu",
    label: "Pacific/Honolulu (Hawaii Time, GMT-10)",
  },

  // UTC
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
];

export function SettingsView({
  circle,
  currentMembership,
  canManage,
  onCircleUpdated,
}: SettingsViewProps) {
  // Timezone state
  const [selectedTimezone, setSelectedTimezone] = useState(circle.timezone);
  const [savingTimezone, setSavingTimezone] = useState(false);

  // Profile state
  const [circleName, setCircleName] = useState(circle.name);
  const [consentNotes, setConsentNotes] = useState(circle.consentNotes ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Notification preferences state
  const [upcomingDoses, setUpcomingDoses] = useState(
    currentMembership.notifications.upcomingDoses,
  );
  const [missedDoses, setMissedDoses] = useState(
    currentMembership.notifications.missedDoses,
  );
  const [appointments, setAppointments] = useState(
    currentMembership.notifications.appointments,
  );
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Live wall-clock time string formatted for current circle timezone
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [deviceTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  });

  useEffect(() => {
    function updateClock() {
      try {
        const now = new Date();
        const str = now.toLocaleTimeString("en-US", {
          timeZone: selectedTimezone,
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        setCurrentTimeStr(str);
      } catch {
        setCurrentTimeStr("");
      }
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [selectedTimezone]);

  function handleAutoDetectTimezone() {
    try {
      const detected =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setSelectedTimezone(detected);
      toast.success(`Detected your device local timezone: ${detected}`);
    } catch {
      toast.error("Could not automatically detect timezone.");
    }
  }

  async function handleSaveTimezone(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) {
      toast.error("Only circle owners and caregivers can update time zone.");
      return;
    }
    setSavingTimezone(true);
    try {
      const res = await fetch(`/api/circles/${circle._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: selectedTimezone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update timezone");
      toast.success(
        `Timezone updated to ${selectedTimezone}. Medication schedules will follow this local time.`,
      );
      if (onCircleUpdated && data.circle) {
        onCircleUpdated(data.circle);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error updating timezone";
      toast.error(msg);
    } finally {
      setSavingTimezone(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) {
      toast.error("Only circle owners and caregivers can update care profile.");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/circles/${circle._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: circleName.trim(),
          consentNotes: consentNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      toast.success("Care circle profile saved successfully.");
      if (onCircleUpdated && data.circle) {
        onCircleUpdated(data.circle);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving profile";
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveNotifications(e: React.FormEvent) {
    e.preventDefault();
    setSavingNotifications(true);
    try {
      const res = await fetch(`/api/circles/${circle._id}/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upcomingDoses,
          missedDoses,
          appointments,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to update notifications");
      toast.success("Your notification preferences have been saved.");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error saving notification preferences";
      toast.error(msg);
    } finally {
      setSavingNotifications(false);
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Top Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Settings &amp; Regional Time
        </h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Manage your local time zone, daily schedule timing, care recipient
          profile, and personal email alerts.
        </p>
      </div>

      {/* ─── 1. Time Zone Configuration Card ─────────────────────────────── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-teal-50 text-[#0f4c47]">
              <Globe className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold">
                Time Zone &amp; Local Schedule Time
              </CardTitle>
              <CardDescription>
                Medication doses and reminders are scheduled accurately in this
                time zone.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveTimezone} className="space-y-6">
            {/* Live Clock & Device Detection Banner */}
            <div className="rounded-xl border border-teal-200/80 bg-teal-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0f4c47] flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span>Current Circle Local Time</span>
                </p>
                <p className="text-lg sm:text-xl font-mono font-bold text-foreground">
                  {currentTimeStr || "Calculating..."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Selected Time Zone: <strong>{selectedTimezone}</strong>
                </p>
              </div>

              {deviceTimezone && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAutoDetectTimezone}
                  className="min-h-[44px] text-xs sm:text-sm font-semibold border-teal-300 text-[#0f4c47] hover:bg-teal-100/70 shrink-0 gap-2 rounded-lg"
                >
                  <Globe className="size-4" />
                  <span>Use My Local Time ({deviceTimezone})</span>
                </Button>
              )}
            </div>

            {/* Timezone Selector */}
            <div className="space-y-2">
              <Label
                htmlFor="timezone-select"
                className="text-base font-medium"
              >
                Choose Time Zone
              </Label>
              <select
                id="timezone-select"
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
                disabled={!canManage || savingTimezone}
                className="w-full h-12 rounded-lg border border-input bg-background px-3 py-2 text-base font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!POPULAR_TIMEZONES.some(
                  (tz) => tz.value === selectedTimezone,
                ) && (
                  <option value={selectedTimezone}>
                    {selectedTimezone} (Custom / Current)
                  </option>
                )}
                {POPULAR_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Examples: <code>Asia/Dhaka</code> (GMT+6),{" "}
                <code>Asia/Calcutta</code> (GMT+5:30),{" "}
                <code>America/New_York</code> (Eastern).
              </p>
            </div>

            {canManage ? (
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={savingTimezone}
                  className="min-h-[44px] rounded-lg bg-[#0f4c47] text-white px-6 font-semibold hover:bg-[#0c3d39] gap-2 shadow-sm"
                >
                  {savingTimezone ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Saving Time Zone...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Save Time Zone
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Only the circle owner or caregivers can update the care schedule
                time zone.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* ─── 2. Care Circle Profile Settings ─────────────────────────────── */}
      {canManage && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-teal-50 text-[#0f4c47]">
                <HeartHandshake className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold">
                  Care Circle Details
                </CardTitle>
                <CardDescription>
                  Update circle name and care coordination consent records.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="circle-name" className="text-base font-medium">
                  Care Circle Name
                </Label>
                <Input
                  id="circle-name"
                  value={circleName}
                  onChange={(e) => setCircleName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={60}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="recipient-name"
                  className="text-base font-medium"
                >
                  Care Recipient (Elder)
                </Label>
                <Input
                  id="recipient-name"
                  value={circle.recipientName}
                  disabled
                  className="h-12 text-base bg-muted/40 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Care recipient identity is preserved for clinical consistency.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="consent-notes"
                  className="text-base font-medium"
                >
                  Elder Consent Notes
                </Label>
                <Textarea
                  id="consent-notes"
                  value={consentNotes}
                  onChange={(e) => setConsentNotes(e.target.value)}
                  placeholder="Notes on elder consent, communication preferences, or care directives..."
                  rows={3}
                  className="text-base"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="min-h-[44px] rounded-lg bg-[#0f4c47] text-white px-6 font-semibold hover:bg-[#0c3d39] gap-2 shadow-sm"
                >
                  {savingProfile ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Saving Profile...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Save Details
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── 3. Personal Notification Preferences ────────────────────────── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-teal-50 text-[#0f4c47]">
              <Bell className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold">
                My Email Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose which proactive alerts you receive as a member of this
                circle.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveNotifications} className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/70 hover:bg-muted/30 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={upcomingDoses}
                  onChange={(e) => setUpcomingDoses(e.target.checked)}
                  className="mt-1 size-5 rounded border-gray-300 text-[#0f4c47] focus:ring-[#0f4c47]"
                />
                <div>
                  <p className="font-semibold text-sm sm:text-base text-foreground">
                    Upcoming Medication Reminders
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Receive email notification 15 minutes before scheduled dose
                    times.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/70 hover:bg-muted/30 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={missedDoses}
                  onChange={(e) => setMissedDoses(e.target.checked)}
                  className="mt-1 size-5 rounded border-gray-300 text-[#0f4c47] focus:ring-[#0f4c47]"
                />
                <div>
                  <p className="font-semibold text-sm sm:text-base text-foreground">
                    Missed Dose Escalation Alerts
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Receive alert when a dose remains unconfirmed 60 minutes
                    past schedule.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/70 hover:bg-muted/30 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={appointments}
                  onChange={(e) => setAppointments(e.target.checked)}
                  className="mt-1 size-5 rounded border-gray-300 text-[#0f4c47] focus:ring-[#0f4c47]"
                />
                <div>
                  <p className="font-semibold text-sm sm:text-base text-foreground">
                    Doctor Appointment Reminders
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Receive morning reminder on days with scheduled healthcare
                    visits.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={savingNotifications}
                className="min-h-[44px] rounded-lg bg-[#0f4c47] text-white px-6 font-semibold hover:bg-[#0c3d39] gap-2 shadow-sm"
              >
                {savingNotifications ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Save Notification Preferences
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ─── 4. Circle Privacy & Security Status ─────────────────────────── */}
      <Card className="border shadow-sm bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#0f4c47]" />
            <span>Circle Identity &amp; Privacy Metadata</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs sm:text-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">Circle ID:</span>
            <div className="flex items-center gap-2">
              <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                {circle._id}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(circle._id);
                  toast.success("Circle ID copied to clipboard");
                }}
                className="size-7 p-0"
                aria-label="Copy circle ID"
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">
              Elder Sharing Consent:
            </span>
            <Badge className="bg-teal-100 text-[#0f4c47] border border-teal-300">
              Explicit Consent Recorded
            </Badge>
          </div>

          <div className="flex items-center justify-between py-1.5">
            <span className="text-muted-foreground">Created Date:</span>
            <span>{new Date(circle.createdAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
