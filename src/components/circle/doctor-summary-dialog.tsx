"use client";

import { useRef } from "react";
import {
  Calendar,
  FileText,
  HeartHandshake,
  Pill,
  Printer,
  ShieldCheck,
} from "lucide-react";
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
import type { Appointment, Circle, Medication } from "@/lib/models";

export function DoctorSummaryDialog({
  circle,
  medications,
  appointments,
  isOpen,
  onClose,
}: {
  circle: Circle;
  medications: Medication[];
  appointments: Appointment[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const activeMeds = medications.filter((m) => m.active);
  const upcomingAppts = appointments.filter((a) => a.status === "scheduled");
  const printAreaRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    window.print();
  }

  const currentDateFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="border-b pb-4 print:hidden">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-0.5 text-xs font-semibold text-[#0f4c47]">
                <FileText className="size-3.5" aria-hidden="true" />
                <span>Clinical Documentation</span>
              </div>
              <DialogTitle className="text-2xl font-bold text-foreground">
                Doctor&apos;s Visit Medication Summary
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Print or export this comprehensive care summary to take to
                doctor consultations and clinical checkups.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ─── Printable Document Area ─────────────────────────────────────── */}
        <div
          ref={printAreaRef}
          className="printable-medical-summary space-y-6 pt-2 text-foreground"
        >
          {/* Header Strip */}
          <div className="flex items-start justify-between border-b-2 border-[#0f4c47] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <HeartHandshake
                  className="size-6 text-[#0f4c47]"
                  aria-hidden="true"
                />
                <span className="text-xl font-bold tracking-tight text-[#0f4c47]">
                  Care Circle Healthcare Summary
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Elder Care &amp; Medication Coordination Platform
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Report Date:</p>
              <p>{currentDateFormatted}</p>
              <p className="text-[11px] font-mono">
                Timezone: {circle.timezone}
              </p>
            </div>
          </div>

          {/* Patient Profile Details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 rounded-xl border bg-muted/20 p-4 text-xs">
            <div>
              <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                Care Recipient (Patient)
              </p>
              <p className="font-bold text-sm text-foreground mt-0.5">
                {circle.recipientName}
              </p>
              <p className="text-muted-foreground capitalize">
                Relationship: {circle.recipientRelationship}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                Care Circle
              </p>
              <p className="font-semibold text-sm text-foreground mt-0.5">
                {circle.name}
              </p>
              <p className="text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Explicit Consent Verified
              </p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                Active Prescriptions
              </p>
              <p className="font-bold text-sm text-foreground mt-0.5">
                {activeMeds.length} Ongoing Medication
                {activeMeds.length === 1 ? "" : "s"}
              </p>
              <p className="text-muted-foreground">Family Monitored</p>
            </div>
          </div>

          {/* Section 1: Active Medications Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-1.5">
              <h3 className="font-bold text-sm uppercase tracking-wider text-[#0f4c47] flex items-center gap-1.5">
                <Pill className="size-4" aria-hidden="true" />
                Active Prescriptions &amp; Daily Schedule
              </h3>
              <Badge variant="secondary" className="text-xs">
                {activeMeds.length} Active
              </Badge>
            </div>

            {activeMeds.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3 text-center border rounded-lg">
                No active medications currently registered in this circle.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 font-semibold text-foreground/80 border-b">
                    <tr>
                      <th className="py-2.5 px-3">Medication</th>
                      <th className="py-2.5 px-3">Dosage</th>
                      <th className="py-2.5 px-3">Daily Times</th>
                      <th className="py-2.5 px-3">Special Instructions</th>
                      <th className="py-2.5 px-3">Started</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeMeds.map((med) => (
                      <tr key={med._id} className="hover:bg-muted/10">
                        <td className="py-2.5 px-3 font-bold text-foreground">
                          {med.name}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground/90">
                          {med.dosage}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {med.scheduleTimes.join(", ")}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {med.instructions || "None specified"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {med.startDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Upcoming Healthcare Consultations */}
          {upcomingAppts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#0f4c47] flex items-center gap-1.5">
                  <Calendar className="size-4" aria-hidden="true" />
                  Scheduled Medical Consultations
                </h3>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 font-semibold text-foreground/80 border-b">
                    <tr>
                      <th className="py-2.5 px-3">Appointment</th>
                      <th className="py-2.5 px-3">Physician / Clinic</th>
                      <th className="py-2.5 px-3">Date &amp; Time</th>
                      <th className="py-2.5 px-3">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {upcomingAppts.map((appt) => (
                      <tr key={appt._id}>
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          {appt.title}
                        </td>
                        <td className="py-2.5 px-3 text-foreground/90">
                          Dr. {appt.provider}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {appt.localDate} at {appt.localTime}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {appt.location}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 3: Clinical Sign-off / Physician Notes Block */}
          <div className="border rounded-xl p-4 space-y-4 bg-muted/10 text-xs">
            <p className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
              Attending Physician Review &amp; Updates:
            </p>
            <div className="h-16 border-b border-dashed border-muted-foreground/40" />
            <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
              <div className="space-y-1">
                <p>Physician Signature: _______________________________</p>
                <p>Clinic / License No.: _______________________________</p>
              </div>
              <div className="space-y-1 text-right">
                <p>Date of Visit: ___________________</p>
                <p>Next Scheduled Review: _________</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dialog Actions */}
        <DialogFooter className="border-t pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            Tip: Use standard print to export as PDF or print a hardcopy.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={handlePrint}
              className="bg-[#0f4c47] hover:bg-[#0c3d39] text-white gap-2 font-semibold"
            >
              <Printer className="size-4" aria-hidden="true" />
              Print / Save as PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
