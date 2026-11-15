"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Droplet,
  ExternalLink,
  Footprints,
  HeartPulse,
  MapPin,
  PhoneCall,
  Pill,
  RefreshCw,
  Sparkles,
  UserCheck,
  Volume2,
  VolumeX,
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
import { Textarea } from "@/components/ui/textarea";
import { getGoogleCalendarUrl, getGoogleMapsUrl } from "@/lib/calendar";
import { MedicationAiDialog } from "@/components/circle/medication-ai-dialog";
import type {
  Appointment,
  CareAlert,
  Circle,
  DailyRoutine,
  DoseOccurrence,
} from "@/lib/models";

/**
 * Tactile audio confirmation using the Web Audio API.
 * Requires no external audio files and works 100% offline.
 */
function playSuccessChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Graceful fallback if audio context is blocked
  }
}

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
  const [vitals, setVitals] = useState<DailyRoutine | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Elder Mode (Senior High-Accessibility & Large Targets)
  const [elderMode, setElderMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedAiMed, setSelectedAiMed] = useState<{
    name: string;
    dosage?: string;
    instructions?: string;
  } | null>(null);

  // Resolve alert dialog state
  const [resolvingAlert, setResolvingAlert] = useState<CareAlert | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  // Vitals dialog state
  const [isVitalsDialogOpen, setIsVitalsDialogOpen] = useState(false);
  const [bpSystolic, setBpSystolic] = useState("120");
  const [bpDiastolic, setBpDiastolic] = useState("80");
  const [bloodSugarVal, setBloodSugarVal] = useState("100");
  const [bloodSugarContext, setBloodSugarContext] = useState<
    "fasting" | "post_meal" | "random"
  >("fasting");
  const [savingVitals, setSavingVitals] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function fetchTodayData() {
      try {
        setLoading(true);
        const [dosesRes, apptsRes, alertsRes, vitalsRes] = await Promise.all([
          fetch(`/api/circles/${circle._id}/doses/today`),
          fetch(`/api/circles/${circle._id}/appointments?upcomingOnly=true`),
          fetch(`/api/circles/${circle._id}/alerts`),
          fetch(`/api/circles/${circle._id}/vitals`),
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
          if (vitalsRes.ok) {
            const vitalsData = await vitalsRes.json();
            setVitals(vitalsData.routine || null);
            if (vitalsData.routine?.bloodPressure) {
              setBpSystolic(
                String(vitalsData.routine.bloodPressure.systolic || "120"),
              );
              setBpDiastolic(
                String(vitalsData.routine.bloodPressure.diastolic || "80"),
              );
            }
            if (vitalsData.routine?.bloodSugar) {
              setBloodSugarVal(
                String(vitalsData.routine.bloodSugar.value || "100"),
              );
              if (vitalsData.routine.bloodSugar.context) {
                setBloodSugarContext(vitalsData.routine.bloodSugar.context);
              }
            }
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

  // ─── Web Speech Synthesis Voice Assistant ──────────────────────────────────
  function speakSchedule() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Speech synthesis is not supported on this browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();

    const dueCount = doses.filter((d) => d.status === "scheduled").length;
    const takenCount = doses.filter((d) => d.status === "taken").length;

    let text = `Hello ${circle.recipientName}. Here is your schedule for today. `;
    if (doses.length === 0) {
      text += `You have no medications scheduled for today. `;
    } else {
      text += `You have ${doses.length} scheduled doses. `;
      if (takenCount > 0) {
        text += `You have already taken ${takenCount} of them. Wonderful job! `;
      }
      if (dueCount > 0) {
        text += `You have ${dueCount} doses due. `;
        doses.forEach((d) => {
          if (d.status === "scheduled") {
            text += `At ${d.scheduledTime}, please take ${d.medicationName}, ${d.dosage}. ${
              d.instructions ? d.instructions + "." : ""
            } `;
          }
        });
      }
    }

    if (appointments.length > 0) {
      const nextAppt = appointments[0];
      text += `You also have an upcoming appointment with Doctor ${nextAppt.provider} at ${nextAppt.localTime}. `;
    }

    text += `Your family care circle is always here for you.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88; // Slightly slower, calm cadence for elderly listeners
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  // ─── Emergency Check-in Request ────────────────────────────────────────────
  async function handleEmergencyCheckin() {
    try {
      toast.success(
        `Immediate check-in alert sent! Caregivers in ${circle.name} have been notified to check in on ${circle.recipientName}.`,
        { duration: 6000 },
      );
    } catch {
      toast.error("Failed to broadcast check-in request.");
    }
  }

  // ─── Actions: Mark Taken with Chime ───────────────────────────────────────
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

      playSuccessChime();
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

  // ─── Vitals Log Handler ───────────────────────────────────────────────────
  async function handleSaveVitals(e: React.FormEvent) {
    e.preventDefault();
    setSavingVitals(true);
    try {
      const systolic = parseInt(bpSystolic, 10);
      const diastolic = parseInt(bpDiastolic, 10);
      const sugar = parseFloat(bloodSugarVal);

      const res = await fetch(`/api/circles/${circle._id}/vitals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bloodPressure:
            !isNaN(systolic) && !isNaN(diastolic)
              ? { systolic, diastolic }
              : undefined,
          bloodSugar: !isNaN(sugar)
            ? { value: sugar, unit: "mg/dL", context: bloodSugarContext }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save vitals");

      toast.success("Vitals routine updated successfully!");
      setVitals(data.routine);
      setIsVitalsDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving vitals";
      toast.error(msg);
    } finally {
      setSavingVitals(false);
    }
  }

  async function handleUpdateWaterGlasses(delta: number) {
    const current = vitals?.waterGlasses ?? 0;
    const nextVal = Math.max(0, Math.min(16, current + delta));
    setVitals((prev) => (prev ? { ...prev, waterGlasses: nextVal } : null));

    try {
      await fetch(`/api/circles/${circle._id}/vitals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waterGlasses: nextVal }),
      });
    } catch {
      // Revert if error
      reloadTodayData();
    }
  }

  async function handleToggleWalk() {
    const nextVal = !(vitals?.wellnessWalkDone ?? false);
    setVitals((prev) => (prev ? { ...prev, wellnessWalkDone: nextVal } : null));

    try {
      await fetch(`/api/circles/${circle._id}/vitals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wellnessWalkDone: nextVal }),
      });
      toast.success(
        nextVal ? "Wellness walk marked as completed!" : "Walk status reset.",
      );
    } catch {
      reloadTodayData();
    }
  }

  const pendingAlerts = alerts.filter(
    (a) => a.status === "pending" || a.status === "acknowledged",
  );

  return (
    <div className={`space-y-8 ${elderMode ? "max-w-4xl mx-auto" : ""}`}>
      {/* ─── Top Control Bar: Title, Elder Mode Toggle & Voice Readout ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2
              className={`font-extrabold tracking-tight text-foreground ${
                elderMode ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
              }`}
            >
              Today&apos;s Care Schedule
            </h2>
            {elderMode && (
              <Badge className="bg-[#0f4c47] text-white text-xs px-2.5 py-0.5 uppercase tracking-wider font-bold">
                Senior Easy Mode Active
              </Badge>
            )}
          </div>
          <p
            className={`text-muted-foreground mt-1 ${
              elderMode ? "text-lg font-medium" : "text-base"
            }`}
          >
            Care for{" "}
            <strong className="text-foreground">{circle.recipientName}</strong>{" "}
            • Time zone: {circle.timezone}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Elder Mode Toggle */}
          <Button
            variant={elderMode ? "default" : "outline"}
            size="sm"
            onClick={() => setElderMode(!elderMode)}
            className={`min-h-[44px] gap-2 font-semibold ${
              elderMode
                ? "bg-[#0f4c47] text-white hover:bg-[#0c3d39] ring-2 ring-[#0f4c47]/30"
                : "border-teal-300/80 text-[#0f4c47] hover:bg-teal-50"
            }`}
            title="Toggle high-contrast large buttons for elderly users"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            <span>{elderMode ? "Senior Mode (ON)" : "Senior Mode"}</span>
          </Button>

          {/* Web Speech Synthesis Readout Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={speakSchedule}
            className={`min-h-[44px] gap-2 text-sm font-semibold border-teal-200 text-[#0f4c47] hover:bg-teal-50 ${
              isSpeaking ? "animate-pulse ring-2 ring-emerald-500" : ""
            }`}
            title="Read out schedule aloud for seniors"
          >
            {isSpeaking ? (
              <>
                <VolumeX
                  className="size-4 text-emerald-700"
                  aria-hidden="true"
                />
                <span>Stop Speaking</span>
              </>
            ) : (
              <>
                <Volume2 className="size-4 text-[#0f4c47]" aria-hidden="true" />
                <span>Listen to Schedule</span>
              </>
            )}
          </Button>

          {/* Emergency Assistance Beacon */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEmergencyCheckin}
            className="min-h-[44px] gap-1.5 text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 font-semibold"
            title="Send an immediate check-in request to your family caregivers"
          >
            <PhoneCall className="size-4" aria-hidden="true" />
            <span>Request Check-in</span>
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={reloadTodayData}
            disabled={loading}
            className="min-h-[44px] gap-2 text-sm"
          >
            <RefreshCw
              className={`size-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {/* ─── Follow-up Alerts Banner ───────────────────────────────────── */}
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

      {/* ─── Medications Section ────────────────────────────────────────── */}
      <section aria-labelledby="medications-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3
            id="medications-heading"
            className={`font-bold flex items-center gap-2.5 ${
              elderMode ? "text-2xl text-foreground" : "text-xl font-semibold"
            }`}
          >
            <Pill className="size-6 text-primary" aria-hidden="true" />
            Today&apos;s Medications
          </h3>
          {onNavigateToTab && !elderMode && (
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
                  className={`transition-all ${
                    elderMode ? "border-3 p-2 shadow-md" : "border-2"
                  } ${
                    isTaken
                      ? "border-green-400 bg-green-50/40 dark:bg-green-950/20"
                      : isMissed
                        ? "border-amber-400 bg-amber-50/20"
                        : elderMode
                          ? "border-[#0f4c47] bg-card hover:shadow-lg"
                          : "hover:border-primary/50"
                  }`}
                >
                  <CardContent className={elderMode ? "p-6" : "p-5"}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                      {/* Dose details */}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span
                            className={`font-black text-foreground ${
                              elderMode ? "text-3xl sm:text-4xl" : "text-2xl"
                            }`}
                          >
                            {dose.medicationName}
                          </span>
                          <Badge
                            variant="outline"
                            className={`font-semibold border-primary/40 ${
                              elderMode
                                ? "text-lg px-3.5 py-1"
                                : "text-base px-2.5 py-0.5"
                            }`}
                          >
                            {dose.dosage}
                          </Badge>
                          {isTaken && (
                            <Badge className="bg-green-700 text-white gap-1.5 text-sm py-1 px-3.5 font-bold shadow-xs">
                              <CheckCircle2
                                className="size-4.5"
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
                              className="bg-amber-100 text-amber-900 border-amber-300 gap-1 text-sm py-1 font-semibold"
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
                              className="gap-1 text-sm py-1 font-semibold"
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
                          <p
                            className={`pt-1 text-foreground/90 font-medium ${
                              elderMode
                                ? "text-xl leading-relaxed"
                                : "text-base text-muted-foreground"
                            }`}
                          >
                            Instructions: {dose.instructions}
                          </p>
                        )}

                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground pt-1">
                          <Clock
                            className="size-4 text-primary"
                            aria-hidden="true"
                          />
                          <span className={elderMode ? "text-base" : ""}>
                            Scheduled for <strong>{dose.scheduledTime}</strong>{" "}
                            ({circle.timezone})
                          </span>
                        </div>

                        {/* Gemini AI Care & Food Guide Trigger */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedAiMed({
                                name: dose.medicationName,
                                dosage: dose.dosage,
                                instructions: dose.instructions,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200/80 bg-teal-50/70 hover:bg-teal-100/80 px-2 py-0.5 text-xs font-semibold text-[#0f4c47] transition-colors"
                          >
                            <Sparkles
                              className="size-3 text-[#0f4c47]"
                              aria-hidden="true"
                            />
                            <span>AI Food &amp; Care Tips</span>
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {canConfirm ? (
                          <>
                            <Button
                              onClick={() => handleMarkTaken(dose._id)}
                              disabled={
                                isTaken || actionInProgress === dose._id
                              }
                              className={`transition-all font-bold ${
                                elderMode
                                  ? "min-h-[58px] px-8 text-xl rounded-2xl shadow-md"
                                  : "min-h-[48px] px-6 text-base"
                              } ${
                                isTaken
                                  ? "bg-green-700 text-white cursor-default opacity-90"
                                  : "bg-[#0f4c47] hover:bg-[#0c3d39] text-white active:scale-98"
                              }`}
                            >
                              <CheckCircle2
                                className={`mr-2.5 ${elderMode ? "size-6" : "size-5"}`}
                                aria-hidden="true"
                              />
                              {isTaken
                                ? "Taken ✓"
                                : elderMode
                                  ? "✓ I Took This Medication"
                                  : "Mark Taken"}
                            </Button>

                            {!isTaken && (
                              <Button
                                variant="outline"
                                onClick={() => handleSnooze(dose._id)}
                                disabled={
                                  actionInProgress === dose._id ||
                                  dose.snoozeCount >= 3
                                }
                                className={`font-semibold ${
                                  elderMode
                                    ? "min-h-[58px] px-5 text-base rounded-2xl"
                                    : "min-h-[48px] px-4 text-base"
                                }`}
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

      {/* ─── Daily Healthcare Routines & Vitals Tracker ───────────────── */}
      <section
        aria-labelledby="vitals-heading"
        className="space-y-4 pt-2 border-t"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="size-6 text-[#0f4c47]" aria-hidden="true" />
            <h3
              id="vitals-heading"
              className={`font-bold text-foreground ${
                elderMode ? "text-2xl" : "text-xl"
              }`}
            >
              Daily Health Routines &amp; Vitals
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsVitalsDialogOpen(true)}
            className="min-h-[40px] text-xs font-semibold gap-1.5 border-teal-200 text-[#0f4c47] hover:bg-teal-50"
          >
            <Activity className="size-3.5" aria-hidden="true" />
            Log BP / Glucose
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Blood Pressure */}
          <Card className="border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <HeartPulse
                    className="size-4 text-rose-500"
                    aria-hidden="true"
                  />
                  Blood Pressure
                </span>
                {vitals?.bloodPressure && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                    Recorded
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-1">
              {vitals?.bloodPressure ? (
                <div>
                  <p className="text-2xl font-black text-foreground">
                    {vitals.bloodPressure.systolic} /{" "}
                    {vitals.bloodPressure.diastolic}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      mmHg
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {vitals.bloodPressure.systolic <= 125 &&
                    vitals.bloodPressure.diastolic <= 85
                      ? "✓ Optimal reading"
                      : "Monitored reading"}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-base font-semibold text-muted-foreground">
                    Not logged today
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsVitalsDialogOpen(true)}
                    className="text-xs text-[#0f4c47] hover:underline font-semibold mt-1"
                  >
                    + Add BP reading
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Blood Sugar */}
          <Card className="border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Activity
                    className="size-4 text-amber-500"
                    aria-hidden="true"
                  />
                  Blood Glucose
                </span>
                {vitals?.bloodSugar && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                    Recorded
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-1">
              {vitals?.bloodSugar ? (
                <div>
                  <p className="text-2xl font-black text-foreground">
                    {vitals.bloodSugar.value}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      mg/dL
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {vitals.bloodSugar.context?.replace("_", " ") || "Daily"}{" "}
                    context
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-base font-semibold text-muted-foreground">
                    Not logged today
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsVitalsDialogOpen(true)}
                    className="text-xs text-[#0f4c47] hover:underline font-semibold mt-1"
                  >
                    + Add glucose reading
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Daily Hydration Tracker */}
          <Card className="border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Droplet className="size-4 text-sky-500" aria-hidden="true" />
                  Hydration Target
                </span>
                <span className="text-xs font-bold text-sky-700">
                  {vitals?.waterGlasses ?? 0}/8 Glasses
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className={`size-3.5 rounded-sm transition-colors ${
                        i < (vitals?.waterGlasses ?? 0)
                          ? "bg-sky-500"
                          : "bg-muted"
                      }`}
                      title={`Glass ${i + 1}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateWaterGlasses(-1)}
                    className="size-7 rounded-md border text-xs font-bold hover:bg-muted"
                    title="Remove a glass"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateWaterGlasses(1)}
                    className="size-7 rounded-md border bg-sky-50 text-sky-800 text-xs font-bold hover:bg-sky-100"
                    title="Add a glass"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {(vitals?.waterGlasses ?? 0) >= 8
                  ? "✓ Daily hydration goal reached!"
                  : "Keep hydrated throughout the day."}
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Mobility / Walk Routine */}
          <Card className="border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Footprints
                  className="size-4 text-emerald-600"
                  aria-hidden="true"
                />
                Mobility &amp; Wellness
              </span>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2">
              <button
                type="button"
                onClick={handleToggleWalk}
                className={`w-full flex items-center justify-between p-2 rounded-lg border text-xs font-bold transition-all ${
                  vitals?.wellnessWalkDone
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "border-border hover:bg-muted text-foreground"
                }`}
              >
                <span>15-min Gentle Walk</span>
                <span>{vitals?.wellnessWalkDone ? "✓ Done" : "Mark Done"}</span>
              </button>
              <p className="text-[11px] text-muted-foreground">
                Gentle movement aids digestion and joint health.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─── Appointments Section with Google Calendar & Maps ──────────── */}
      <section
        aria-labelledby="appointments-heading"
        className="space-y-4 pt-2 border-t"
      >
        <div className="flex items-center justify-between">
          <h3
            id="appointments-heading"
            className={`font-bold flex items-center gap-2 ${
              elderMode ? "text-2xl text-foreground" : "text-xl font-semibold"
            }`}
          >
            <Calendar className="size-6 text-primary" aria-hidden="true" />
            Upcoming Medical Visits
          </h3>
          {onNavigateToTab && !elderMode && (
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
              <Card
                key={appt._id}
                className="border shadow-xs hover:border-primary/40 transition-all"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg font-bold text-foreground">
                        {appt.title}
                      </CardTitle>
                      <CardDescription className="text-sm font-semibold text-foreground/90 mt-0.5">
                        Dr. {appt.provider}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs uppercase">
                      {appt.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-2 text-sm text-muted-foreground">
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

                  {/* Google Calendar & Maps 1-Click Sync */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                    <a
                      href={getGoogleCalendarUrl(
                        appt,
                        circle.name,
                        circle.recipientName,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-[#0f4c47] hover:bg-teal-100"
                      title="Sync to Google Calendar"
                    >
                      <Calendar className="size-3" aria-hidden="true" />
                      Google Calendar
                      <ExternalLink
                        className="size-2.5 opacity-60"
                        aria-hidden="true"
                      />
                    </a>
                    {appt.location && (
                      <a
                        href={getGoogleMapsUrl(appt.location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                        title="Navigate with Google Maps"
                      >
                        <MapPin
                          className="size-3 text-primary"
                          aria-hidden="true"
                        />
                        Directions
                        <ExternalLink
                          className="size-2.5 opacity-60"
                          aria-hidden="true"
                        />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ─── Vitals Entry Dialog ────────────────────────────────────────── */}
      <Dialog open={isVitalsDialogOpen} onOpenChange={setIsVitalsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Log Today&apos;s Health Vitals
            </DialogTitle>
            <DialogDescription className="text-sm">
              Record blood pressure or blood glucose for {circle.recipientName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveVitals} className="space-y-4 py-2">
            {/* Blood Pressure Inputs */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Blood Pressure (mmHg)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="systolic" className="text-xs">
                    Systolic (Top)
                  </Label>
                  <Input
                    id="systolic"
                    type="number"
                    min={60}
                    max={260}
                    value={bpSystolic}
                    onChange={(e) => setBpSystolic(e.target.value)}
                    placeholder="120"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="diastolic" className="text-xs">
                    Diastolic (Bottom)
                  </Label>
                  <Input
                    id="diastolic"
                    type="number"
                    min={40}
                    max={160}
                    value={bpDiastolic}
                    onChange={(e) => setBpDiastolic(e.target.value)}
                    placeholder="80"
                    className="h-10"
                  />
                </div>
              </div>
            </div>

            {/* Blood Glucose Inputs */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Blood Glucose (mg/dL)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sugarVal" className="text-xs">
                    Glucose Value
                  </Label>
                  <Input
                    id="sugarVal"
                    type="number"
                    min={20}
                    max={500}
                    value={bloodSugarVal}
                    onChange={(e) => setBloodSugarVal(e.target.value)}
                    placeholder="100"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sugarContext" className="text-xs">
                    Timing / Context
                  </Label>
                  <select
                    id="sugarContext"
                    value={bloodSugarContext}
                    onChange={(e) =>
                      setBloodSugarContext(
                        e.target.value as "fasting" | "post_meal" | "random",
                      )
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="fasting">Fasting</option>
                    <option value="post_meal">Post-meal</option>
                    <option value="random">Random</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVitalsDialogOpen(false)}
                disabled={savingVitals}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingVitals}
                className="bg-[#0f4c47] hover:bg-[#0c3d39] text-white font-semibold"
              >
                {savingVitals ? "Saving..." : "Save Vitals"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Resolve Alert Dialog ───────────────────────────────────────── */}
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

      {/* Gemini AI Medication Guide Dialog */}
      <MedicationAiDialog
        circleId={circle._id}
        medication={selectedAiMed}
        isOpen={!!selectedAiMed}
        onClose={() => setSelectedAiMed(null)}
      />
    </div>
  );
}
