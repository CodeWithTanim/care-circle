"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  Copy,
  Crown,
  Heart,
  KeyRound,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  Circle,
  Invite,
  Membership,
  MemberNotificationPreferences,
} from "@/lib/models";

export function MembersView({
  circle,
  currentMembership,
}: {
  circle: Circle;
  currentMembership: Membership;
}) {
  const isOwner = currentMembership.role === "owner";
  const [members, setMembers] = useState<Membership[]>([]);
  const [activeInvites, setActiveInvites] = useState<Invite[]>([]);

  // Invite modal state
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteRoleType, setInviteRoleType] = useState<
    "patient" | "caregiver" | "family"
  >("patient");
  const [inviteLabel, setInviteLabel] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(48);
  const [generatedPasscode, setGeneratedPasscode] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);

  // Transfer ownership dialog
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Notification preferences
  const [prefs, setPrefs] = useState<MemberNotificationPreferences>(
    currentMembership.notifications || {
      upcomingDoses: true,
      missedDoses: true,
      appointments: true,
    },
  );
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function fetchDetails() {
      try {
        const res = await fetch(`/api/circles/${circle._id}`);
        if (res.ok && !ignore) {
          const data = await res.json();
          setMembers(data.members || []);
          setActiveInvites(data.activeInvites || []);
        }
      } catch {
        if (!ignore) toast.error("Failed to load members");
      }
    }

    fetchDetails();
    return () => {
      ignore = true;
    };
  }, [circle._id, refreshTrigger]);

  function reloadDetails() {
    setRefreshTrigger((prev) => prev + 1);
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreatingInvite(true);
    try {
      const isRecipientInvite = inviteRoleType === "patient";
      const actualRole: "caregiver" | "family" =
        inviteRoleType === "family" ? "family" : "caregiver";
      const fallbackLabel = isRecipientInvite
        ? `For Patient (${circle.recipientName})`
        : inviteRoleType === "caregiver"
          ? "Caregiver"
          : "Family Observer";

      const res = await fetch(`/api/circles/${circle._id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: actualRole,
          isRecipientInvite,
          label: inviteLabel.trim() || fallbackLabel,
          expiresInHours: Number(expiresInHours),
          maxUses: 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate invite");

      setGeneratedPasscode(data.rawPasscode);
      toast.success("Passcode generated!");
      reloadDetails();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating invite";
      toast.error(msg);
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    try {
      const res = await fetch(
        `/api/circles/${circle._id}/invites/${inviteId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to revoke");

      toast.success("Invite revoked.");
      reloadDetails();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error revoking invite";
      toast.error(msg);
    }
  }

  async function handleTransferOwnership(e: React.FormEvent) {
    e.preventDefault();
    if (!newOwnerId) return;
    setTransferring(true);
    try {
      const res = await fetch(
        `/api/circles/${circle._id}/members/${newOwnerId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "transferOwnership" }),
        },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to transfer ownership");

      toast.success("Circle ownership transferred.");
      setIsTransferDialogOpen(false);
      window.location.reload();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error transferring ownership";
      toast.error(msg);
    } finally {
      setTransferring(false);
    }
  }

  async function handleUpdatePreferences(
    updated: MemberNotificationPreferences,
  ) {
    setPrefs(updated);
    setSavingPrefs(true);
    try {
      const res = await fetch(`/api/circles/${circle._id}/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Notification preferences updated.");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error saving preferences";
      toast.error(msg);
    } finally {
      setSavingPrefs(false);
    }
  }

  function copyPasscode() {
    if (!generatedPasscode) return;
    navigator.clipboard.writeText(generatedPasscode);
    setCopied(true);
    toast.success("Passcode copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Care Circle Members & Sharing
          </h2>
          <p className="text-base text-muted-foreground mt-1">
            People supporting{" "}
            <strong className="text-foreground">{circle.recipientName}</strong>.
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                setGeneratedPasscode(null);
                setInviteLabel("");
                setIsInviteDialogOpen(true);
              }}
              className="min-h-[44px] gap-2 text-base font-semibold"
            >
              <UserPlus className="size-5" aria-hidden="true" />
              Invite Member
            </Button>
          </div>
        )}
      </div>

      {/* Sharing Consent Status Card */}
      <Card className="border bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            Care Recipient Consent & Transparency
          </CardTitle>
          <CardDescription className="text-base text-foreground/80">
            Care recipient: <strong>{circle.recipientName}</strong> (
            {circle.recipientRelationship === "self"
              ? "Self"
              : circle.recipientRelationship}
            ).
            {circle.sharingConsent
              ? " Explicit consent is active."
              : " Consent required."}
          </CardDescription>
        </CardHeader>
        {circle.consentNotes && (
          <CardContent className="pt-0 text-sm text-muted-foreground italic">
            Directives: {circle.consentNotes}
          </CardContent>
        )}
      </Card>

      {/* Members List */}
      <section aria-labelledby="members-list-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3
            id="members-list-heading"
            className="text-xl font-semibold flex items-center gap-2"
          >
            <Users className="size-5 text-primary" aria-hidden="true" />
            Current Members ({members.length})
          </h3>

          {isOwner && members.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTransferDialogOpen(true)}
              className="min-h-[40px] text-sm"
            >
              <Crown
                className="size-4 mr-1.5 text-amber-500"
                aria-hidden="true"
              />
              Transfer Ownership
            </Button>
          )}
        </div>

        <div className="grid gap-3">
          {members.map((m) => (
            <Card key={m._id} className="border shadow-none">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-foreground">
                      {m.name}
                    </span>
                    {(m.userId === circle.recipientUserId ||
                      (circle.isRecipientUser &&
                        m.userId === circle.createdBy)) && (
                      <Badge className="bg-[#0f4c47] text-white gap-1 text-xs font-semibold">
                        <Heart
                          className="size-3 fill-current"
                          aria-hidden="true"
                        />
                        Patient
                      </Badge>
                    )}
                    {m.role === "owner" && (
                      <Badge className="bg-amber-500 hover:bg-amber-600 gap-1 text-xs">
                        <Crown className="size-3" aria-hidden="true" />
                        Owner
                      </Badge>
                    )}
                    {m.role === "caregiver" && (
                      <Badge variant="default" className="text-xs">
                        Caregiver
                      </Badge>
                    )}
                    {m.role === "family" && (
                      <Badge variant="outline" className="text-xs">
                        Family Observer
                      </Badge>
                    )}
                    {m.userId === currentMembership.userId && (
                      <Badge variant="secondary" className="text-xs">
                        You
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{m.email}</p>
                </div>

                <div className="text-sm text-muted-foreground">
                  Joined {new Date(m.joinedAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Active Invites (Owner only) */}
      {isOwner && activeInvites.length > 0 && (
        <section aria-labelledby="invites-heading" className="space-y-4 pt-2">
          <h3
            id="invites-heading"
            className="text-xl font-semibold flex items-center gap-2"
          >
            <KeyRound className="size-5 text-primary" aria-hidden="true" />
            Pending Invitation Passcodes ({activeInvites.length})
          </h3>
          <p className="text-sm text-muted-foreground">
            Share these passcodes securely with the invited member. Passcodes
            are hashed in storage for privacy and expire automatically.
          </p>

          <div className="grid gap-3">
            {activeInvites.map((inv) => (
              <Card key={inv._id} className="border border-dashed p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base">
                        {inv.label || "Care Circle Invitation"}
                      </span>
                      {inv.isRecipientInvite && (
                        <Badge className="bg-[#0f4c47] text-white text-xs font-semibold">
                          For Patient ({circle.recipientName})
                        </Badge>
                      )}
                      <Badge variant="outline" className="capitalize text-xs">
                        Role: {inv.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Expires: {new Date(inv.expiresAt).toLocaleString()} •
                      Uses: {inv.useCount}/{inv.maxUses}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeInvite(inv._id)}
                    className="text-destructive hover:bg-destructive/10 min-h-[40px] self-start sm:self-auto"
                  >
                    <Trash2 className="size-4 mr-1.5" aria-hidden="true" />
                    Revoke
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Notification Preferences */}
      <section
        aria-labelledby="notifications-heading"
        className="space-y-4 pt-4 border-t"
      >
        <h3
          id="notifications-heading"
          className="text-xl font-semibold flex items-center gap-2"
        >
          <Bell className="size-5 text-primary" aria-hidden="true" />
          Your Email Reminder Preferences
        </h3>
        <p className="text-base text-muted-foreground">
          Choose which proactive notifications you wish to receive at{" "}
          <strong>{currentMembership.email}</strong>.
        </p>

        <Card className="border">
          <CardContent className="p-5 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.upcomingDoses}
                onChange={(e) =>
                  handleUpdatePreferences({
                    ...prefs,
                    upcomingDoses: e.target.checked,
                  })
                }
                disabled={savingPrefs}
                className="size-5 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div>
                <span className="text-base font-medium text-foreground block">
                  Upcoming Medication Doses
                </span>
                <span className="text-sm text-muted-foreground">
                  Receive a reminder 15 minutes before scheduled dose times.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.missedDoses}
                onChange={(e) =>
                  handleUpdatePreferences({
                    ...prefs,
                    missedDoses: e.target.checked,
                  })
                }
                disabled={savingPrefs}
                className="size-5 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div>
                <span className="text-base font-medium text-foreground block">
                  Unconfirmed / Missed Dose Alerts
                </span>
                <span className="text-sm text-muted-foreground">
                  Get notified when a scheduled dose has passed without
                  confirmation so you can follow up with &quot;I&apos;ll handle
                  this&quot;.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.appointments}
                onChange={(e) =>
                  handleUpdatePreferences({
                    ...prefs,
                    appointments: e.target.checked,
                  })
                }
                disabled={savingPrefs}
                className="size-5 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div>
                <span className="text-base font-medium text-foreground block">
                  Doctor & Clinic Appointments
                </span>
                <span className="text-sm text-muted-foreground">
                  Reminders 2 hours in advance of scheduled healthcare visits.
                </span>
              </div>
            </label>
          </CardContent>
        </Card>
      </section>

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Invite to Care Circle
            </DialogTitle>
            <DialogDescription className="text-base">
              Generate a secure invitation passcode to share with a trusted
              helper or family member.
            </DialogDescription>
          </DialogHeader>

          {generatedPasscode ? (
            <div className="space-y-6 py-4 text-center">
              <div className="rounded-lg bg-primary/10 border border-primary/30 p-6">
                <p className="text-sm text-muted-foreground mb-2">
                  Invitation Passcode
                </p>
                <p className="text-3xl font-mono font-bold tracking-wider text-primary select-all">
                  {generatedPasscode}
                </p>
              </div>

              <div className="space-y-2 text-left text-sm text-muted-foreground">
                <p>
                  • Single-use passcode for{" "}
                  <strong className="text-foreground">
                    {inviteRoleType === "patient"
                      ? `Patient (${circle.recipientName})`
                      : inviteRoleType === "caregiver"
                        ? "Caregiver"
                        : "Family Observer"}
                  </strong>{" "}
                  access.
                </p>
                <p>• Expiring in {expiresInHours} hours.</p>
                <p>
                  • The invitee creates their own account, then enters this code
                  on their dashboard.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={copyPasscode}
                  className="flex-1 min-h-[44px] gap-2 font-medium"
                >
                  {copied ? (
                    <Check className="size-5" />
                  ) : (
                    <Copy className="size-5" />
                  )}
                  {copied ? "Copied!" : "Copy Passcode"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsInviteDialogOpen(false)}
                  className="min-h-[44px]"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateInvite} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="inviteRole" className="text-base font-semibold">
                  Role to Grant
                </Label>
                <select
                  id="inviteRole"
                  value={inviteRoleType}
                  onChange={(e) =>
                    setInviteRoleType(
                      e.target.value as "patient" | "caregiver" | "family",
                    )
                  }
                  className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="patient">
                    Patient / Care Recipient ({circle.recipientName}) — Full
                    dignity, Senior Mode &amp; Check-ins
                  </option>
                  <option value="caregiver">
                    Caregiver (Manage medicines, record doses, schedule visits)
                  </option>
                  <option value="family">
                    Family Observer (View schedules, receive alerts, claim
                    follow-ups)
                  </option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {inviteRoleType === "patient"
                    ? `Creates an invitation passcode for ${circle.recipientName}. When they enter it, their account is permanently linked as the care recipient.`
                    : inviteRoleType === "caregiver"
                      ? "Authorized caregiver with full medication and appointment management permissions."
                      : "Family observer with transparent view-only access and follow-up alert claiming."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inviteLabel" className="text-base font-medium">
                  Label (Optional note for you)
                </Label>
                <Input
                  id="inviteLabel"
                  placeholder={
                    inviteRoleType === "patient"
                      ? `For Patient ${circle.recipientName}`
                      : "e.g. For Dr. Smith or Daughter Sarah"
                  }
                  value={inviteLabel}
                  onChange={(e) => setInviteLabel(e.target.value)}
                  className="min-h-[44px] text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiresIn" className="text-base font-medium">
                  Expires After
                </Label>
                <select
                  id="expiresIn"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours (Recommended)</option>
                  <option value={168}>7 days</option>
                </select>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteDialogOpen(false)}
                  disabled={creatingInvite}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creatingInvite}
                  className="min-h-[44px] font-semibold"
                >
                  {creatingInvite ? "Generating..." : "Generate Passcode"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Transfer Circle Ownership
            </DialogTitle>
            <DialogDescription className="text-base">
              Transferring ownership gives another member full control over
              circle settings and member invites. You will remain as a
              caregiver.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTransferOwnership} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="newOwnerSelect" className="text-base font-medium">
                Select Member to Receive Ownership
              </Label>
              <select
                id="newOwnerSelect"
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">-- Choose a member --</option>
                {members
                  .filter((m) => m.userId !== currentMembership.userId)
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} ({m.email}) - currently {m.role}
                    </option>
                  ))}
              </select>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTransferDialogOpen(false)}
                disabled={transferring}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={transferring || !newOwnerId}
                className="min-h-[44px] bg-amber-600 hover:bg-amber-700 font-semibold"
              >
                {transferring ? "Transferring..." : "Confirm Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
