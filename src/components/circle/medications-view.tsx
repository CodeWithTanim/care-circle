"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  Calendar,
  Clock,
  Edit,
  Pill,
  Plus,
  Printer,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { DoctorSummaryDialog } from "@/components/circle/doctor-summary-dialog";
import { MedicationAiDialog } from "@/components/circle/medication-ai-dialog";
import type { Appointment, Circle, Medication } from "@/lib/models";
import { getTodayLocalDate } from "@/lib/timezone";

export function MedicationsView({
  circle,
  canManage,
}: {
  circle: Circle;
  canManage: boolean;
}) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [selectedAiMed, setSelectedAiMed] = useState<Medication | null>(null);

  // Add / Edit Modal state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [scheduleTimes, setScheduleTimes] = useState<string[]>(["08:00"]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function fetchMedicationsAndAppts() {
      try {
        const [medsRes, apptsRes] = await Promise.all([
          fetch(
            `/api/circles/${circle._id}/medications?includeArchived=${showArchived}`,
          ),
          fetch(`/api/circles/${circle._id}/appointments`),
        ]);
        if (!ignore) {
          if (medsRes.ok) {
            const data = await medsRes.json();
            setMedications(data.medications || []);
          }
          if (apptsRes.ok) {
            const apptsData = await apptsRes.json();
            setAppointments(apptsData.appointments || []);
          }
        }
      } catch {
        if (!ignore) toast.error("Failed to load medications");
      }
    }

    fetchMedicationsAndAppts();
    return () => {
      ignore = true;
    };
  }, [circle._id, showArchived, refreshTrigger]);

  function reloadMedications() {
    setRefreshTrigger((prev) => prev + 1);
  }

  function openAddDialog() {
    setEditingMed(null);
    setName("");
    setDosage("");
    setInstructions("");
    setScheduleTimes(["08:00"]);
    setStartDate(getTodayLocalDate(circle.timezone));
    setEndDate("");
    setIsDialogOpen(true);
  }

  function openEditDialog(med: Medication) {
    setEditingMed(med);
    setName(med.name);
    setDosage(med.dosage);
    setInstructions(med.instructions || "");
    setScheduleTimes(med.scheduleTimes || ["08:00"]);
    setStartDate(med.startDate);
    setEndDate(med.endDate || "");
    setIsDialogOpen(true);
  }

  function addScheduleTime() {
    if (scheduleTimes.length >= 6) {
      toast.error("Maximum 6 schedule times per day.");
      return;
    }
    setScheduleTimes([...scheduleTimes, "12:00"]);
  }

  function removeScheduleTime(index: number) {
    if (scheduleTimes.length <= 1) {
      toast.error("At least one schedule time is required.");
      return;
    }
    setScheduleTimes(scheduleTimes.filter((_, i) => i !== index));
  }

  function updateScheduleTime(index: number, val: string) {
    const updated = [...scheduleTimes];
    updated[index] = val;
    setScheduleTimes(updated);
  }

  async function handleSaveMedication(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        dosage: dosage.trim(),
        instructions: instructions.trim() || undefined,
        scheduleTimes: scheduleTimes.filter(Boolean),
        startDate,
        endDate: endDate ? endDate : null,
      };

      const url = editingMed
        ? `/api/circles/${circle._id}/medications/${editingMed._id}`
        : `/api/circles/${circle._id}/medications`;

      const method = editingMed ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save medication");

      toast.success(editingMed ? "Medication updated!" : "Medication added!");
      setIsDialogOpen(false);
      reloadMedications();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error saving medication";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(medId: string) {
    if (
      !confirm(
        "Are you sure you want to archive this medication? Future scheduled doses will be cancelled, but past adherence history will be preserved.",
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/circles/${circle._id}/medications/${medId}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error("Failed to archive");

      toast.success("Medication archived.");
      reloadMedications();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error archiving medication";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Medication Regimen
          </h2>
          <p className="text-base text-muted-foreground mt-1">
            Current prescribed schedules and instructions for{" "}
            {circle.recipientName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            Show archived
          </label>

          <Button
            variant="outline"
            onClick={() => setIsSummaryOpen(true)}
            className="min-h-[44px] gap-2 text-sm font-semibold border-teal-200 text-[#0f4c47] hover:bg-teal-50"
            title="Open printable medical sheet for doctor visits"
          >
            <Printer className="size-4 text-[#0f4c47]" aria-hidden="true" />
            <span>Print Doctor&apos;s Summary</span>
          </Button>

          {canManage && (
            <Button
              onClick={openAddDialog}
              className="min-h-[44px] gap-2 text-base font-semibold"
            >
              <Plus className="size-5" aria-hidden="true" />
              Add Medication
            </Button>
          )}
        </div>
      </div>

      {medications.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent className="space-y-3">
            <Pill
              className="size-12 mx-auto text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xl font-medium text-foreground">
              No medications on record
            </p>
            <p className="text-base text-muted-foreground max-w-md mx-auto">
              Add prescribed medications with clear dosage and daily times to
              coordinate schedules and reminders.
            </p>
            {canManage && (
              <Button onClick={openAddDialog} className="min-h-[44px] mt-2">
                <Plus className="size-4 mr-2" aria-hidden="true" />
                Add First Medication
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {medications.map((med) => (
            <Card
              key={med._id}
              className={`border transition-all ${
                !med.active ? "opacity-60 bg-muted/40" : ""
              }`}
            >
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xl font-bold text-foreground">
                        {med.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-base px-2.5 py-0.5 font-medium"
                      >
                        {med.dosage}
                      </Badge>
                      {!med.active && (
                        <Badge
                          variant="secondary"
                          className="text-xs uppercase"
                        >
                          Archived
                        </Badge>
                      )}
                    </div>

                    {med.instructions && (
                      <p className="text-base text-muted-foreground">
                        {med.instructions}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-1">
                      <div className="flex items-center gap-1.5">
                        <Clock
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                        <span>
                          Daily at:{" "}
                          <strong>{med.scheduleTimes.join(", ")}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                        <span>
                          From {med.startDate}{" "}
                          {med.endDate ? `to ${med.endDate}` : "(Ongoing)"}
                        </span>
                      </div>
                    </div>

                    {/* Gemini AI Care Guide Trigger */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedAiMed(med)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200/80 bg-teal-50/70 hover:bg-teal-100/80 px-2.5 py-1 text-xs font-semibold text-[#0f4c47] transition-colors"
                      >
                        <Sparkles
                          className="size-3.5 text-[#0f4c47]"
                          aria-hidden="true"
                        />
                        <span>Gemini AI Food &amp; Care Guide</span>
                      </button>
                    </div>
                  </div>

                  {canManage && med.active && (
                    <div className="flex items-center gap-2 self-start">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(med)}
                        className="min-h-[44px] gap-1.5"
                      >
                        <Edit className="size-4" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchive(med._id)}
                        className="min-h-[44px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                      >
                        <Archive className="size-4" aria-hidden="true" />
                        Archive
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {editingMed ? "Edit Medication" : "Add Medication"}
            </DialogTitle>
            <DialogDescription className="text-base">
              Enter prescribed medicine details for {circle.recipientName}.
              Times are in {circle.timezone}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveMedication} className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="medName" className="text-base font-medium">
                Medication Name
              </Label>
              <Input
                id="medName"
                placeholder="e.g. Lisinopril or Metformin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="min-h-[44px] text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medDosage" className="text-base font-medium">
                Dosage & Form
              </Label>
              <Input
                id="medDosage"
                placeholder="e.g. 10mg tablet or 2 drops"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                required
                className="min-h-[44px] text-base"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="medInstructions"
                className="text-base font-medium"
              >
                Special Instructions (Optional)
              </Label>
              <Input
                id="medInstructions"
                placeholder="e.g. Take with food, drink full glass of water"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="min-h-[44px] text-base"
              />
            </div>

            {/* Schedule Times */}
            <div className="space-y-3">
              <Label className="text-base font-medium block">
                Daily Schedule Times (24-hour format)
              </Label>
              <div className="space-y-2">
                {scheduleTimes.map((time, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => updateScheduleTime(idx, e.target.value)}
                      required
                      className="min-h-[44px] text-base font-mono w-40"
                    />
                    {scheduleTimes.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeScheduleTime(idx)}
                        className="text-destructive hover:bg-destructive/10 size-11 p-0"
                        aria-label={`Remove time slot ${idx + 1}`}
                      >
                        <X className="size-5" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {scheduleTimes.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addScheduleTime}
                  className="min-h-[40px] text-sm"
                >
                  <Plus className="size-4 mr-1.5" aria-hidden="true" />
                  Add Another Time
                </Button>
              )}
            </div>

            {/* Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="medStartDate" className="text-base font-medium">
                  Start Date
                </Label>
                <Input
                  id="medStartDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="min-h-[44px] text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="medEndDate" className="text-base font-medium">
                  End Date (Optional)
                </Label>
                <Input
                  id="medEndDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="min-h-[44px] text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for ongoing medication
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={saving}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="min-h-[44px] font-semibold"
              >
                {saving
                  ? "Saving..."
                  : editingMed
                    ? "Save Changes"
                    : "Add Medication"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Doctor's Summary Printable Dialog */}
      <DoctorSummaryDialog
        circle={circle}
        medications={medications}
        appointments={appointments}
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
      />

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
