"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Pill,
  RefreshCw,
  UserCheck,
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
import { Textarea } from "@/components/ui/textarea";
import type {
  Appointment,
  CareAlert,
  Circle,
  DoseOccurrence,
} from "@/lib/models";

export function TodayView({
  circle,
  canConfirm,
  onNavigateToTab,
}: {
  circle: Circle;
  canConfirm: boolean;
  onNavigateToTab?: (tab: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [doses, setDoses] = useState<DoseOccurrence[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [alerts, setAlerts] = useState<CareAlert[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Resolve alert dialog state
  const [resolvingAlert, setResolvingAlert] = useState<CareAlert | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function fetchTodayData() {
      try {
        setLoading(true);
        const [dosesRes, apptsRes, alertsRes] = await Promise.all([
          fetch(`/api/circles/${circle._id}/doses/today`),
          fetch(`/api/circles/${circle._id}/appointments?upcomingOnly=true`),
          fetch(`/api/circles/${circle._id}/alerts`),
        ]);

        if (!ignore) {
          if (dosesRes.ok) {
            const data = await dosesRes.json();
            setDoses(data.doses || []);
          }
          if (apptsRes.ok) {
            const data = await apptsRes.json();
            setAppointments(data.appointments || []);
          }
          if (alertsRes.ok) {
            const data = await alertsRes.json();
            setAlerts(data.alerts || []);
          }
        }
      } catch {
        if (!ignore) toast.error("Failed to refresh Today's care records");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchTodayData();
    return () => {
      ignore = true;
    };
  }, [circle._id, refreshTrigger]);

  function reloadTodayData() {
    setRefreshTrigger((prev) => prev + 1);
  }

  async function handleMarkTaken(occurrenceId: string) {
    setActionInProgress(occurrenceId);
    try {
      const res = await fetch(
        `/api/circles/${circle._id}/doses/${occurrenceId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "taken" }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to confirm dose");

      toast.success("Medication confirmed as taken!");
      reloadTodayData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error confirming dose";
      toast.error(msg);
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleSnooze(occurrenceId: string) {
    setActionInProgress(occurrenceId);
    try {
      const res = await fetch(
        `/api/circles/${circle._id}/doses/${occurrenceId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "snooze", snoozeMinutes: 15 }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to snooze");

      toast.info("Reminding again in 15 minutes");
      reloadTodayData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error snoozing dose";
      toast.error(msg);
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleAcknowledgeAlert(alertId: string) {
    setActionInProgress(alertId);
    try {
      const res = await fetch(
        `/api/circles/${circle._id}/alerts/${alertId}/acknowledge`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to claim alert");

      toast.success(
        "You are now following up on this alert. The family can see you're handling it!",
      );
      reloadTodayData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error claiming alert";
      toast.error(msg);
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleResolveAlert() {
    if (!resolvingAlert) return;
    setActionInProgress(resolvingAlert._id);
    try {
      const res = await fetch(
        `/api/circles/${circle._id}/alerts/${resolvingAlert._id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: resolutionNote }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve alert");

      toast.success("Follow-up marked as resolved!");
      setResolvingAlert(null);
      setResolutionNote("");
      reloadTodayData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error resolving alert";
      toast.error(msg);
    } finally {
      setActionInProgress(null);
    }
  }

  // Active alerts that need attention
  const pendingAlerts = alerts.filter(
    (a) => a.status === "pending" || a.status === "acknowledged",
  );

  return (
    <div className="space-y-8">
      {/* Date Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Today&apos;s Schedule
          </h2>
          <p className="text-base text-muted-foreground mt-1">
            Care for{" "}
            <strong className="text-foreground">{circle.recipientName}</strong>{" "}
            • Time zone: {circle.timezone}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={reloadTodayData}
          disabled={loading}
          className="min-h-[44px] self-start sm:self-auto gap-2 text-sm"
        >
          <RefreshCw
            className={`size-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      {/* Follow-up Alerts Banner */}
      {pendingAlerts.length > 0 && (
        <div className="space-y-4">
          {pendingAlerts.map((alert) => (
            <Card
              key={alert._id}
              className={`border-2 ${
                alert.status === "pending"
                  ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/20"
                  : "border-blue-400 bg-blue-50/60 dark:bg-blue-950/20"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle
                      className={`size-6 shrink-0 ${
                        alert.status === "pending"
                          ? "text-amber-600"
                          : "text-blue-600"
                      }`}
                      aria-hidden="true"
                    />
                    <CardTitle className="text-xl font-semibold">
                      {alert.title}
                    </CardTitle>
                  </div>
                  <Badge
                    variant={
                      alert.status === "pending" ? "destructive" : "default"
                    }
                    className="text-xs uppercase px-2.5 py-0.5"
                  >
                    {alert.status === "pending"
                      ? "Needs Attention"
                      : "In Progress"}
                  </Badge>
                </div>
                <CardDescription className="text-base text-foreground/80 mt-1">
                  {alert.details}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {alert.status === "pending" ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                    <p className="text-sm text-muted-foreground">
                      Let the family know who is checking in with{" "}
                      {circle.recipientName}.
                    </p>
                    <Button
                      onClick={() => handleAcknowledgeAlert(alert._id)}
                      disabled={actionInProgress === alert._id}
                      className="min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white font-medium px-5"
                    >
                      <UserCheck className="size-5 mr-2" aria-hidden="true" />
                      I&apos;ll handle this
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                    <p className="text-base font-medium text-blue-900 dark:text-blue-200">
                      ✓ Claimed by <strong>{alert.acknowledgedBy?.name}</strong>{" "}
                      • Following up
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setResolvingAlert(alert)}
                      className="min-h-[44px] border-blue-500 text-blue-700 hover:bg-blue-50 font-medium"
                    >
                      Mark Resolved
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Medications Section */}
      <section aria-labelledby="medications-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3
            id="medications-heading"
            className="text-xl font-semibold flex items-center gap-2"
          >
            <Pill className="size-6 text-primary" aria-hidden="true" />
            Today&apos;s Medications
          </h3>
          {onNavigateToTab && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateToTab("medications")}
              className="text-primary hover:text-primary font-medium"
            >
              Manage all medicines →
            </Button>
          )}
        </div>

        {doses.length === 0 ? (
          <Card className="border-dashed py-8 text-center">
            <CardContent className="space-y-3">
              <Pill
                className="size-10 mx-auto text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-lg font-medium text-muted-foreground">
                No medications scheduled for today.
              </p>
              {canConfirm && onNavigateToTab && (
                <Button
                  variant="outline"
                  onClick={() => onNavigateToTab("medications")}
                  className="min-h-[44px]"
                >
                  Add a Medication
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {doses.map((dose) => {
              const isTaken = dose.status === "taken";
              const isSnoozed = dose.status === "snoozed";
              const isMissed = dose.status === "unconfirmed_missed";

              return (
                <Card
                  key={dose._id}
                  className={`border-2 transition-all ${
                    isTaken
                      ? "border-green-300 bg-green-50/30 dark:bg-green-950/10"
                      : isMissed
                        ? "border-amber-400 bg-amber-50/20"
                        : "hover:border-primary/50"
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Dose details */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-2xl font-bold text-foreground">
                            {dose.medicationName}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-base px-2.5 py-0.5 font-medium"
                          >
                            {dose.dosage}
                          </Badge>
                          {isTaken && (
                            <Badge className="bg-green-600 text-white gap-1.5 text-sm py-1 px-3">
                              <CheckCircle2
                                className="size-4"
                                aria-hidden="true"
                              />
                              Taken at{" "}
                              {dose.takenAt
                                ? new Date(dose.takenAt).toLocaleTimeString(
                                    [],
                                    { hour: "numeric", minute: "2-digit" },
                                  )
                                : ""}
                              {dose.takenBy ? ` by ${dose.takenBy.name}` : ""}
                            </Badge>
                          )}
                          {isSnoozed && (
                            <Badge
                              variant="secondary"
                              className="bg-amber-100 text-amber-900 border-amber-300 gap-1 text-sm py-1"
                            >
                              <Clock
                                className="size-4 text-amber-700"
                                aria-hidden="true"
                              />
                              Snoozed until{" "}
                              {dose.snoozeUntil
                                ? new Date(dose.snoozeUntil).toLocaleTimeString(
                                    [],
                                    { hour: "numeric", minute: "2-digit" },
                                  )
                                : ""}
                            </Badge>
                          )}
                          {isMissed && (
                            <Badge
                              variant="destructive"
                              className="gap-1 text-sm py-1"
                            >
                              <AlertCircle
                                className="size-4"
                                aria-hidden="true"
                              />
                              Unconfirmed (Due {dose.scheduledTime})
                            </Badge>
                          )}
                        </div>

                        {dose.instructions && (
                          <p className="text-base text-muted-foreground pt-1">
                            {dose.instructions}
                          </p>
                        )}

                        <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                          <Clock className="size-4" aria-hidden="true" />
                          <span>
                            Scheduled for <strong>{dose.scheduledTime}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                        {canConfirm ? (
                          <>
                            <Button
                              onClick={() => handleMarkTaken(dose._id)}
                              disabled={
                                isTaken || actionInProgress === dose._id
                              }
                              className={`min-h-[48px] px-6 text-base font-semibold ${
                                isTaken
                                  ? "bg-green-700 text-white cursor-default"
                                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
                              }`}
                            >
                              <CheckCircle2
                                className="size-5 mr-2"
                                aria-hidden="true"
                              />
                              {isTaken ? "Taken ✓" : "Mark Taken"}
                            </Button>

                            {!isTaken && (
                              <Button
                                variant="outline"
                                onClick={() => handleSnooze(dose._id)}
                                disabled={
                                  actionInProgress === dose._id ||
                                  dose.snoozeCount >= 3
                                }
                                className="min-h-[48px] px-4 text-base font-medium"
                              >
                                <Clock
                                  className="size-4 mr-2"
                                  aria-hidden="true"
                                />
                                {dose.snoozeCount >= 3
                                  ? "Max snoozes reached"
                                  : "Remind in 15m"}
                              </Button>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground italic sm:text-right max-w-[200px]">
                            Family view • Doses can be confirmed by recipient or
                            caregiver
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Appointments Section */}
      <section
        aria-labelledby="appointments-heading"
        className="space-y-4 pt-4"
      >
        <div className="flex items-center justify-between">
          <h3
            id="appointments-heading"
            className="text-xl font-semibold flex items-center gap-2"
          >
            <Calendar className="size-6 text-primary" aria-hidden="true" />
            Upcoming Medical Visits
          </h3>
          {onNavigateToTab && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateToTab("appointments")}
              className="text-primary hover:text-primary font-medium"
            >
              All appointments →
            </Button>
          )}
        </div>

        {appointments.length === 0 ? (
          <Card className="border-dashed py-6 text-center">
            <CardContent>
              <p className="text-base text-muted-foreground">
                No upcoming doctor or healthcare appointments scheduled.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {appointments.map((appt) => (
              <Card key={appt._id} className="border shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-lg font-semibold">
                    {appt.title}
                  </CardTitle>
                  <CardDescription className="text-base font-medium text-foreground">
                    {appt.provider}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock
                      className="size-4 text-primary shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {appt.localDate} at <strong>{appt.localTime}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin
                      className="size-4 text-primary shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{appt.location}</span>
                  </div>
                  {appt.notes && (
                    <p className="text-xs text-foreground/80 italic pt-1 border-t">
                      Notes: {appt.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Resolve Alert Dialog */}
      <Dialog
        open={!!resolvingAlert}
        onOpenChange={(open) => !open && setResolvingAlert(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Resolve Follow-Up Alert
            </DialogTitle>
            <DialogDescription className="text-base">
              Add any notes about how this alert was addressed (e.g.
              &quot;Checked on Eleanor, she had already taken her morning
              pill&quot;).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              placeholder="Resolution notes for the family..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={3}
              className="text-base"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setResolvingAlert(null)}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolveAlert}
              disabled={actionInProgress === resolvingAlert?._id}
              className="min-h-[44px]"
            >
              Complete Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
