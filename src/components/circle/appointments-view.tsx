"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Plus, User, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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
import type { Appointment, Circle } from "@/lib/models";
import { getTodayLocalDate } from "@/lib/timezone";

export function AppointmentsView({
  circle,
  canManage,
}: {
  circle: Circle;
  canManage: boolean;
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [location, setLocation] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [localTime, setLocalTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function fetchAppointments() {
      try {
        const res = await fetch(`/api/circles/${circle._id}/appointments`);
        if (res.ok && !ignore) {
          const data = await res.json();
          setAppointments(data.appointments || []);
        }
      } catch {
        if (!ignore) toast.error("Failed to load appointments");
      }
    }

    fetchAppointments();
    return () => {
      ignore = true;
    };
  }, [circle._id, refreshTrigger]);

  function reloadAppointments() {
    setRefreshTrigger((prev) => prev + 1);
  }

  function openAddDialog() {
    setTitle("");
    setProvider("");
    setLocation("");
    setLocalDate(getTodayLocalDate(circle.timezone));
    setLocalTime("10:00");
    setNotes("");
    setIsDialogOpen(true);
  }

  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/circles/${circle._id}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          provider: provider.trim(),
          location: location.trim(),
          localDate,
          localTime,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to create appointment");

      toast.success("Appointment scheduled!");
      setIsDialogOpen(false);
      reloadAppointments();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error creating appointment";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(apptId: string) {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    try {
      const res = await fetch(
        `/api/circles/${circle._id}/appointments/${apptId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to cancel");

      toast.success("Appointment cancelled.");
      reloadAppointments();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error cancelling appointment";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Healthcare Appointments
          </h2>
          <p className="text-base text-muted-foreground mt-1">
            Doctor visits, lab tests, and therapy sessions for{" "}
            {circle.recipientName}.
          </p>
        </div>

        {canManage && (
          <Button
            onClick={openAddDialog}
            className="min-h-[44px] gap-2 text-base font-semibold"
          >
            <Plus className="size-5" aria-hidden="true" />
            Schedule Appointment
          </Button>
        )}
      </div>

      {appointments.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent className="space-y-3">
            <Calendar
              className="size-12 mx-auto text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xl font-medium text-foreground">
              No appointments scheduled
            </p>
            <p className="text-base text-muted-foreground max-w-md mx-auto">
              Keep the family informed of upcoming medical visits, specialist
              consultations, and routine checkups.
            </p>
            {canManage && (
              <Button onClick={openAddDialog} className="min-h-[44px] mt-2">
                <Plus className="size-4 mr-2" aria-hidden="true" />
                Schedule First Visit
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {appointments.map((appt) => {
            const isCancelled = appt.status === "cancelled";
            return (
              <Card
                key={appt._id}
                className={`border transition-all ${
                  isCancelled
                    ? "opacity-60 bg-muted/30"
                    : "shadow-sm hover:border-primary/50"
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <CardTitle className="text-xl font-bold text-foreground">
                          {appt.title}
                        </CardTitle>
                        <Badge
                          variant={isCancelled ? "secondary" : "default"}
                          className="text-xs uppercase"
                        >
                          {appt.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-base font-medium text-foreground/90">
                        <User
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                        <span>{appt.provider}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar
                            className="size-4 text-primary"
                            aria-hidden="true"
                          />
                          <span>{appt.localDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock
                            className="size-4 text-primary"
                            aria-hidden="true"
                          />
                          <span>
                            at <strong>{appt.localTime}</strong> (
                            {circle.timezone})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin
                            className="size-4 text-primary"
                            aria-hidden="true"
                          />
                          <span>{appt.location}</span>
                        </div>
                      </div>

                      {appt.notes && (
                        <p className="text-sm text-foreground/80 italic pt-2 border-t">
                          Notes: {appt.notes}
                        </p>
                      )}
                    </div>

                    {canManage && !isCancelled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(appt._id)}
                        className="min-h-[44px] text-destructive hover:bg-destructive/10 gap-1.5 self-start"
                      >
                        <XCircle className="size-4" aria-hidden="true" />
                        Cancel Visit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Schedule Appointment</DialogTitle>
            <DialogDescription className="text-base">
              Add doctor or clinic visit details for {circle.recipientName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAppointment} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="apptTitle" className="text-base font-medium">
                Appointment Title
              </Label>
              <Input
                id="apptTitle"
                placeholder="e.g. Cardiology Follow-up or Dental Cleaning"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="min-h-[44px] text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apptProvider" className="text-base font-medium">
                Healthcare Provider / Doctor
              </Label>
              <Input
                id="apptProvider"
                placeholder="e.g. Dr. Robert Smith (Heart Specialist)"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                required
                className="min-h-[44px] text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apptLocation" className="text-base font-medium">
                Location or Address
              </Label>
              <Input
                id="apptLocation"
                placeholder="e.g. Memorial Hospital, 3rd Floor, Suite 300"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="min-h-[44px] text-base"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="apptDate" className="text-base font-medium">
                  Date
                </Label>
                <Input
                  id="apptDate"
                  type="date"
                  value={localDate}
                  onChange={(e) => setLocalDate(e.target.value)}
                  required
                  className="min-h-[44px] text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apptTime" className="text-base font-medium">
                  Time (24-hour)
                </Label>
                <Input
                  id="apptTime"
                  type="time"
                  value={localTime}
                  onChange={(e) => setLocalTime(e.target.value)}
                  required
                  className="min-h-[44px] text-base font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apptNotes" className="text-base font-medium">
                Notes & Preparation (Optional)
              </Label>
              <Textarea
                id="apptNotes"
                placeholder="e.g. Fasting required after midnight; bring health card and list of current medicines."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-base"
              />
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
                {saving ? "Scheduling..." : "Schedule Appointment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
