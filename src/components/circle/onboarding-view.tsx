"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HeartHandshake,
  KeyRound,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
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

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

export function OnboardingView({ userName }: { userName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"choice" | "create" | "join">("choice");
  const [loading, setLoading] = useState(false);

  // Form states for Create Circle
  const [circleName, setCircleName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [relationship, setRelationship] = useState<
    "self" | "parent" | "spouse" | "client" | "other"
  >("parent");
  const [timezone, setTimezone] = useState(() => {
    try {
      return (
        Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
      );
    } catch {
      return "America/New_York";
    }
  });
  const [sharingConsent, setSharingConsent] = useState(false);
  const [consentNotes, setConsentNotes] = useState("");

  // Form state for Join Circle
  const [passcode, setPasscode] = useState("");

  async function handleCreateCircle(e: React.FormEvent) {
    e.preventDefault();
    if (!sharingConsent) {
      toast.error(
        "Explicit consent is required to share care coordination information.",
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: circleName,
          recipientName: relationship === "self" ? userName : recipientName,
          recipientRelationship: relationship,
          isRecipientUser: relationship === "self",
          timezone,
          sharingConsent: true,
          consentNotes: consentNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create care circle");
      }

      toast.success("Care circle created successfully!");
      router.push(`/dashboard?circle=${data.circle._id}`);
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error creating care circle";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinCircle(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim()) {
      toast.error("Please enter your invitation passcode.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/circles/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to join care circle");
      }

      if (data.alreadyMember) {
        toast.info("You are already a member of this care circle.");
      } else {
        toast.success(
          `Joined ${data.circle.name} as a ${data.membership.role}!`,
        );
      }

      router.push(`/dashboard?circle=${data.circle._id}`);
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error joining care circle";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Welcome to Care Circle, {userName}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Coordinate medications, doctor visits, and daily care routines with
          trusted family and caregivers.
        </p>
      </div>

      {mode === "choice" && (
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card
              tabIndex={0}
              role="button"
              onClick={() => setMode("create")}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") && setMode("create")
              }
              className="cursor-pointer border-2 hover:border-primary focus-visible:ring-2 focus-visible:ring-primary transition-all p-4 flex flex-col justify-between"
            >
              <CardHeader className="p-2">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                  <PlusCircle className="size-7" aria-hidden="true" />
                </div>
                <CardTitle className="text-xl">Create a Circle</CardTitle>
                <CardDescription className="text-base text-muted-foreground mt-2">
                  Set up a new care profile for yourself or an elder family
                  member you care for.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 pt-4">
                <Button
                  className="w-full min-h-[44px] text-base font-medium"
                  type="button"
                >
                  Start a New Circle
                </Button>
              </CardContent>
            </Card>

            <Card
              tabIndex={0}
              role="button"
              onClick={() => setMode("join")}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") && setMode("join")
              }
              className="cursor-pointer border-2 hover:border-primary focus-visible:ring-2 focus-visible:ring-primary transition-all p-4 flex flex-col justify-between"
            >
              <CardHeader className="p-2">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                  <KeyRound className="size-7" aria-hidden="true" />
                </div>
                <CardTitle className="text-xl">Join with Passcode</CardTitle>
                <CardDescription className="text-base text-muted-foreground mt-2">
                  Have an invitation code from a family member or caregiver?
                  Enter it here to join.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 pt-4">
                <Button
                  variant="outline"
                  className="w-full min-h-[44px] text-base font-medium"
                  type="button"
                >
                  Enter Invitation Code
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Demo Dataset loader for evaluation */}
          <Card className="border border-dashed bg-muted/40 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-base text-foreground block">
                  Hackathon Evaluation Demo
                </span>
                <span className="text-sm text-muted-foreground">
                  Quickly load a clearly labelled fictional scenario (Eleanor
                  Vance, medication routines, and a missed-dose follow-up alert)
                  to test the app.
                </span>
              </div>
              <Button
                variant="secondary"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch("/api/demo/seed", {
                      method: "POST",
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    toast.success("Fictional demo scenario loaded!");
                    router.push(`/dashboard?circle=${data.circleId}`);
                    router.refresh();
                  } catch (err: unknown) {
                    const msg =
                      err instanceof Error
                        ? err.message
                        : "Failed to load demo";
                    toast.error(msg);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="min-h-[44px] shrink-0 font-medium"
              >
                {loading ? "Loading..." : "Load Demo Scenario"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {mode === "create" && (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <HeartHandshake
                className="size-6 text-primary"
                aria-hidden="true"
              />
              Create Care Circle
            </CardTitle>
            <CardDescription className="text-base">
              The person receiving care stays at the center. Provide basic
              details to begin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCircle} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="circleName" className="text-base font-medium">
                  Circle Name
                </Label>
                <Input
                  id="circleName"
                  placeholder="e.g. Eleanor's Care Circle or Mom's Care"
                  value={circleName}
                  onChange={(e) => setCircleName(e.target.value)}
                  required
                  className="min-h-[44px] text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship" className="text-base font-medium">
                  Who is receiving care?
                </Label>
                <select
                  id="relationship"
                  value={relationship}
                  onChange={(e) =>
                    setRelationship(
                      e.target.value as
                        "self" | "parent" | "spouse" | "client" | "other",
                    )
                  }
                  className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="parent">My Parent / Relative</option>
                  <option value="self">Myself (I am receiving care)</option>
                  <option value="spouse">My Spouse / Partner</option>
                  <option value="client">A Client / Care Recipient</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {relationship !== "self" && (
                <div className="space-y-2">
                  <Label
                    htmlFor="recipientName"
                    className="text-base font-medium"
                  >
                    Care Recipient&apos;s Full Name
                  </Label>
                  <Input
                    id="recipientName"
                    placeholder="e.g. Eleanor Vance"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    required
                    className="min-h-[44px] text-base"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-base font-medium">
                  Care Profile Time Zone
                </Label>
                <p className="text-sm text-muted-foreground">
                  Medication times and appointments are displayed and scheduled
                  in this time zone.
                </p>
                <select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="sharingConsent"
                    checked={sharingConsent}
                    onChange={(e) => setSharingConsent(e.target.checked)}
                    required
                    className="size-5 mt-1 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label
                    htmlFor="sharingConsent"
                    className="text-base font-medium leading-relaxed cursor-pointer"
                  >
                    <ShieldCheck
                      className="size-4 inline text-primary mr-1"
                      aria-hidden="true"
                    />
                    Explicit Care Consent
                    <span className="block text-sm font-normal text-muted-foreground mt-1">
                      {relationship === "self"
                        ? "I consent to sharing my medication schedules, appointment alerts, and care updates with invited family members and caregivers."
                        : `I confirm that ${recipientName || "the care recipient"} (or their authorized representative) explicitly consents to coordinating care, medications, and visits with invited circle members.`}
                    </span>
                  </Label>
                </div>

                <div className="space-y-1 pt-2">
                  <Label
                    htmlFor="consentNotes"
                    className="text-sm text-muted-foreground"
                  >
                    Optional notes or medical directives regarding consent
                  </Label>
                  <Textarea
                    id="consentNotes"
                    placeholder="e.g. Coordinated with Dr. Miller and daughter Sarah."
                    value={consentNotes}
                    onChange={(e) => setConsentNotes(e.target.value)}
                    rows={2}
                    className="text-base"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={loading || !sharingConsent}
                  className="flex-1 min-h-[44px] text-base font-semibold"
                >
                  {loading ? "Creating..." : "Create Care Circle"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode("choice")}
                  disabled={loading}
                  className="min-h-[44px] text-base"
                >
                  Back
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {mode === "join" && (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <KeyRound className="size-6 text-primary" aria-hidden="true" />
              Join Care Circle
            </CardTitle>
            <CardDescription className="text-base">
              Enter the invitation passcode you were given to join your family
              member&apos;s circle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinCircle} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="passcode" className="text-base font-medium">
                  Invitation Passcode
                </Label>
                <Input
                  id="passcode"
                  placeholder="e.g. CARE-7M4K-9P2R"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                  required
                  autoFocus
                  className="min-h-[48px] text-lg font-mono tracking-wider text-center"
                />
                <p className="text-sm text-muted-foreground">
                  Passcodes are case-insensitive and look like{" "}
                  <code className="font-semibold">CARE-XXXX-XXXX</code>.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={loading || !passcode.trim()}
                  className="flex-1 min-h-[44px] text-base font-semibold"
                >
                  {loading ? "Joining..." : "Join Circle"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode("choice")}
                  disabled={loading}
                  className="min-h-[44px] text-base"
                >
                  Back
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
