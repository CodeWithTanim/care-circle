"use client";

import { useEffect, useState } from "react";
import {
  Apple,
  Clock,
  HeartPulse,
  Info,
  LoaderCircle,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
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
import type { MedicationAiGuide } from "@/lib/gemini-ai";

export function MedicationAiDialog({
  circleId,
  medication,
  isOpen,
  onClose,
}: {
  circleId: string;
  medication: {
    name: string;
    dosage?: string;
    instructions?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [guide, setGuide] = useState<MedicationAiGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  function handleClose() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setGuide(null);
    onClose();
  }

  useEffect(() => {
    if (!isOpen || !medication) {
      return;
    }

    let ignore = false;

    async function fetchAiGuide() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/circles/${circleId}/medications/ai-guide`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: medication?.name,
              dosage: medication?.dosage,
              instructions: medication?.instructions,
            }),
          },
        );

        if (res.ok && !ignore) {
          const data = await res.json();
          setGuide(data.guide);
        } else if (!ignore) {
          toast.error("Failed to load medication guide");
        }
      } catch {
        if (!ignore) toast.error("Error connecting to AI service");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchAiGuide();
    return () => {
      ignore = true;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen, circleId, medication]);

  function speakSummary() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Speech synthesis not supported on this device.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!guide) return;

    window.speechSynthesis.cancel();
    const text = `${guide.medicationName}. ${guide.purpose}. Food guidelines: ${guide.foodGuidelines}. Routine tip: ${guide.routineTips}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="space-y-2 border-b pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-[#0f4c47]">
              <Sparkles
                className="size-3.5 text-[#0f4c47]"
                aria-hidden="true"
              />
              <span>Google Gemini AI Care Assistant</span>
            </div>
            {guide && (
              <Badge
                variant="outline"
                className="text-[11px] font-mono text-muted-foreground"
              >
                {guide.source}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>{medication?.name}</span>
            {medication?.dosage && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                {medication.dosage}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Clear, non-technical plain-language guide on purpose, meal timing,
            and daily senior care considerations.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-muted-foreground">
            <LoaderCircle className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium">
              Generating plain-language care guidance…
            </p>
          </div>
        ) : guide ? (
          <div className="space-y-4 py-2">
            {/* Audio Readout Pill */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-teal-50/60 border border-teal-200/80">
              <div className="flex items-center gap-2">
                <Volume2 className="size-4 text-[#0f4c47]" aria-hidden="true" />
                <span className="text-xs font-semibold text-[#0f4c47]">
                  Elder Voice Summary
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={speakSummary}
                className="h-8 text-xs font-semibold border-teal-300 text-[#0f4c47] hover:bg-teal-100"
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="size-3.5 mr-1" />
                    Stop Audio
                  </>
                ) : (
                  <>
                    <Volume2 className="size-3.5 mr-1" />
                    Read Aloud
                  </>
                )}
              </Button>
            </div>

            {/* Purpose */}
            <div className="p-4 rounded-xl border bg-card space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <HeartPulse
                  className="size-4 text-rose-500"
                  aria-hidden="true"
                />
                <span>What it does (Plain English)</span>
              </div>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {guide.purpose}
              </p>
            </div>

            {/* Food & Beverage Guidelines */}
            <div className="p-4 rounded-xl border bg-card space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Apple className="size-4 text-emerald-600" aria-hidden="true" />
                <span>Meals, Food &amp; Drink Guidelines</span>
              </div>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {guide.foodGuidelines}
              </p>
            </div>

            {/* Routine Tips */}
            <div className="p-4 rounded-xl border bg-card space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Clock className="size-4 text-primary" aria-hidden="true" />
                <span>Daily Senior Routine Tips</span>
              </div>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {guide.routineTips}
              </p>
            </div>

            {/* Safety Disclaimer */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-muted bg-muted/30 text-xs text-muted-foreground">
              <Info
                className="size-4 text-muted-foreground shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="leading-snug">{guide.disclaimer}</p>
            </div>
          </div>
        ) : null}

        <DialogFooter className="border-t pt-3 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            Powered by Google Generative AI for PromptWars x Catalyst
          </p>
          <Button onClick={handleClose} className="font-semibold">
            Close Guide
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
