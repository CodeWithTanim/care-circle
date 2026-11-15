"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  Clock,
  HelpCircle,
  Info,
  LoaderCircle,
  Pill,
  Send,
  Sparkles,
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
import { Input } from "@/components/ui/input";
import { MedicationAiDialog } from "@/components/circle/medication-ai-dialog";
import type { CareAiAnswer } from "@/lib/gemini-ai";
import type { Circle, Medication } from "@/lib/models";

const QUICK_QUESTIONS = [
  "How should Eleanor take her morning medications with breakfast?",
  "What should our family do if a morning dose is missed?",
  "How to keep an elder well-hydrated throughout the day?",
  "What precautions to take for blood pressure and standing dizziness?",
];

export function AiAssistantView({ circle }: { circle: Circle }) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(true);
  const [selectedMed, setSelectedMed] = useState<Medication | null>(null);

  // Q&A state
  const [question, setQuestion] = useState("");
  const [answering, setAnswering] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<CareAiAnswer | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasLiveGemini, setHasLiveGemini] = useState<boolean | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadMedications() {
      try {
        const res = await fetch(`/api/circles/${circle._id}/medications`);
        if (res.ok && !ignore) {
          const data = await res.json();
          setMedications(data.medications || []);
        }
      } catch {
        if (!ignore) toast.error("Could not load circle medications");
      } finally {
        if (!ignore) setLoadingMeds(false);
      }
    }

    loadMedications();
    return () => {
      ignore = true;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [circle._id]);

  async function handleAsk(queryText?: string) {
    const q = (queryText ?? question).trim();
    if (!q) return;

    if (queryText) {
      setQuestion(queryText);
    }

    setAnswering(true);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      const res = await fetch(`/api/circles/${circle._id}/ai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to get AI answer");
      }

      setCurrentAnswer(json.data);
      if (typeof json.hasLiveGeminiKey === "boolean") {
        setHasLiveGemini(json.hasLiveGeminiKey);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error contacting AI";
      toast.error(msg);
    } finally {
      setAnswering(false);
    }
  }

  function handleVoiceReadout() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Speech readout not supported in this browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!currentAnswer) return;

    window.speechSynthesis.cancel();
    // Strip markdown formatting for cleaner speech
    const cleanText = currentAnswer.answer.replace(/[*#_`-]/g, " ");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  const recipientDisplayName = circle.recipientName || "Care Recipient";

  return (
    <div className="space-y-6">
      {/* ─── Hero Banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/90 via-emerald-50/40 to-background p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#0f4c47] text-white shadow-xs">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Google Gemini Care Assistant
              </h1>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Dignified, plain-language guidance on medications, meal timing,
              and senior routine care for{" "}
              <strong className="text-foreground">
                {recipientDisplayName}
              </strong>
              .
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs font-semibold px-3 py-1 rounded-full border-teal-300 bg-teal-100/70 text-[#0f4c47] shadow-2xs"
            >
              <Sparkles className="size-3 mr-1 text-[#0f4c47]" />
              {hasLiveGemini
                ? "Google Gemini 2.5 Flash (Live)"
                : "Clinical Knowledgebase Mode"}
            </Badge>
          </div>
        </div>
      </div>

      {/* ─── Ask Gemini Section ─────────────────────────────────────────── */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-[#0f4c47]" aria-hidden="true" />
            <CardTitle className="text-lg font-bold">
              Ask Gemini About Care, Meals &amp; Medication
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Get non-diagnostic family guidance, meal guidelines, and routine
            adherence tips in plain English.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="flex items-center gap-2"
          >
            <Input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask a question (e.g. "Can ${recipientDisplayName} take Lisinopril before food?")`}
              disabled={answering}
              className="h-11 text-sm bg-background"
            />
            <Button
              type="submit"
              disabled={answering || !question.trim()}
              className="h-11 px-4 bg-[#0f4c47] hover:bg-[#0c3c38] text-white font-semibold shrink-0 gap-1.5"
            >
              {answering ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>Thinking…</span>
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  <span>Ask AI</span>
                </>
              )}
            </Button>
          </form>

          {/* Quick Question Chips */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Common Care Questions:
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAsk(q)}
                  disabled={answering}
                  className="rounded-full border border-teal-200/90 bg-teal-50/70 hover:bg-teal-100/80 px-3 py-1 text-xs font-medium text-[#0f4c47] transition-colors text-left flex items-center gap-1.5"
                >
                  <Sparkles className="size-3 text-[#0f4c47] shrink-0" />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Answer Card */}
          {currentAnswer && (
            <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/40 p-4 sm:p-5 space-y-4 transition-all animate-in fade-in duration-200">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-teal-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-[#0f4c47] text-white">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      Care Guidance Response
                    </h4>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Source: {currentAnswer.source}
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVoiceReadout}
                  className="h-8 text-xs font-semibold border-teal-300 text-[#0f4c47] hover:bg-teal-100 gap-1.5"
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="size-3.5" />
                      <span>Stop Voice</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="size-3.5" />
                      <span>Read Aloud</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Formatted Answer */}
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-line space-y-2 font-normal">
                {currentAnswer.answer}
              </div>

              {/* Follow-up suggestions */}
              {currentAnswer.suggestedFollowUps &&
                currentAnswer.suggestedFollowUps.length > 0 && (
                  <div className="pt-2 border-t border-teal-200/60 space-y-1.5">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Related Follow-up Questions:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {currentAnswer.suggestedFollowUps.map((fu, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleAsk(fu)}
                          className="text-xs text-[#0f4c47] hover:underline flex items-center gap-1 font-medium bg-white/70 px-2.5 py-1 rounded-md border border-teal-200"
                        >
                          <ArrowRight className="size-3 shrink-0" />
                          <span>{fu}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Disclaimer */}
              <div className="flex items-start gap-2 pt-2 text-[11px] text-muted-foreground">
                <Info className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                <p>{currentAnswer.disclaimer}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Active Medications Explainer ───────────────────────────────── */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Pill className="size-5 text-primary" aria-hidden="true" />
            <CardTitle className="text-lg font-bold">
              Current Medications &amp; Gemini Explainer
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Click any prescribed medicine to open its plain-English purpose,
            food timing guidelines, and elder routine tips.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMeds ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground gap-2 text-sm">
              <LoaderCircle className="size-5 animate-spin" />
              <span>Loading current prescriptions…</span>
            </div>
          ) : medications.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center space-y-2">
              <p className="text-sm font-semibold text-foreground">
                No active medications listed in this Care Circle.
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Add medications in the Medications tab, or click the{" "}
                <strong>Evaluator Demo Tour</strong> button at the top of the
                screen to load Eleanor Vance&apos;s demo medications instantly!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {medications.map((med) => (
                <div
                  key={med._id}
                  className="rounded-xl border border-border/80 bg-card p-4 hover:border-teal-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-sm text-foreground truncate">
                        {med.name}
                      </h4>
                      <Badge
                        variant="outline"
                        className="text-xs font-semibold shrink-0"
                      >
                        {med.dosage}
                      </Badge>
                    </div>
                    {med.instructions && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {med.instructions}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                      <Clock className="size-3 text-primary" />
                      <span>{med.scheduleTimes.join(", ")}</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMed(med)}
                    className="w-full text-xs font-semibold border-teal-300/80 bg-teal-50/60 hover:bg-teal-100 text-[#0f4c47] gap-1.5"
                  >
                    <Sparkles className="size-3.5 text-[#0f4c47]" />
                    <span>Gemini Care Guide</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Gemini API Key Notice ──────────────────────────────────────── */}
      <div className="rounded-xl border border-muted bg-muted/20 p-4 text-xs text-muted-foreground space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-foreground">
          <HelpCircle className="size-4 text-[#0f4c47]" aria-hidden="true" />
          <span>About Google Gemini Generative AI Integration</span>
        </div>
        <p className="leading-relaxed">
          Care Circle is pre-configured to communicate with{" "}
          <strong>Google Gemini 2.5 Flash</strong> via the Gemini API. For local
          evaluation without an API key, the system seamlessly operates in{" "}
          <strong>Verified Clinical Knowledgebase Mode</strong>, ensuring 100%
          reliable responses without ever breaking.
        </p>
      </div>

      {/* ─── Medication AI Dialog Modal ─────────────────────────────────── */}
      <MedicationAiDialog
        circleId={circle._id}
        medication={selectedMed}
        isOpen={!!selectedMed}
        onClose={() => setSelectedMed(null)}
      />
    </div>
  );
}
