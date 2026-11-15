import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askGeminiCareQuestion, getMedicationAiGuide } from "@/lib/gemini-ai";

describe("Gemini AI Care Assistant & Medication Guide", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("generates care coordination reference guidance for Lisinopril", async () => {
    const guide = await getMedicationAiGuide({
      name: "Lisinopril",
      dosage: "10mg",
      instructions: "Take once daily in the morning",
    });

    expect(guide.medicationName).toBe("Lisinopril");
    expect(guide.purpose.toLowerCase()).toContain("blood pressure");
    expect(guide.foodGuidelines).toContain("water");
    expect(guide.routineTips.toLowerCase()).toContain("morning");
    expect(guide.source).toBe("Care Coordination Guidelines (Reference)");
    expect(guide.disclaimer.toLowerCase()).toContain("care coordination");
  });

  it("generates care coordination reference guidance for Metformin", async () => {
    const guide = await getMedicationAiGuide({
      name: "Metformin",
      dosage: "500mg",
      instructions: "Take with meals",
    });

    expect(guide.medicationName).toBe("Metformin");
    expect(guide.purpose.toLowerCase()).toContain("blood sugar");
    expect(guide.foodGuidelines.toLowerCase()).toContain("meal");
    expect(guide.source).toBe("Care Coordination Guidelines (Reference)");
  });

  it("avoids false substring matching (e.g. 'NotLisinopril' does not match Lisinopril)", async () => {
    const guide = await getMedicationAiGuide({
      name: "NotLisinopril Custom Compound",
      dosage: "25mg",
    });

    // Should NOT have Lisinopril specific blood pressure text
    expect(guide.purpose).not.toContain("protecting the heart and kidneys");
    expect(guide.purpose).toContain("Prescribed to support daily wellness");
  });

  it("provides safe, non-diagnostic guidance for unlisted medications", async () => {
    const guide = await getMedicationAiGuide({
      name: "CoQ10 Heart Support",
      dosage: "100mg",
      instructions: "Take with breakfast",
    });

    expect(guide.medicationName).toBe("CoQ10 Heart Support");
    expect(guide.purpose).toBeTruthy();
    expect(guide.foodGuidelines).toContain("Take with breakfast");
    expect(guide.disclaimer.toLowerCase()).toContain("never adjust dosages");
    expect(guide.source).toBe("Care Coordination Guidelines (Reference)");
  });

  it("answers eldercare care questions with reference fallback deferring to label and doctor", async () => {
    const res = await askGeminiCareQuestion({
      question: "What should we do if Eleanor misses her morning dose?",
      circleName: "Vance Family Circle",
      recipientName: "Eleanor Vance",
      medicationsSummary: "Lisinopril 10mg, Metformin 500mg",
    });

    expect(res.answer.toLowerCase()).toContain("never double");
    expect(res.answer.toLowerCase()).toContain("prescription label");
    expect(res.answer.toLowerCase()).toContain("pharmacist");
    // Rejects universal 1-2 hour take window
    expect(res.answer.toLowerCase()).not.toContain("1 to 2 hours");
    expect(res.source).toBe("Care Coordination Guidelines (Reference)");
    expect(res.suggestedFollowUps.length).toBeGreaterThan(0);
    expect(res.disclaimer.toLowerCase()).toContain("care coordination");
  });

  it("answers hydration questions safely without blanket universal fluid volume", async () => {
    const res = await askGeminiCareQuestion({
      question: "How much water should Eleanor drink each day?",
      recipientName: "Eleanor Vance",
    });

    expect(res.answer.toLowerCase()).toContain("hydration");
    expect(res.answer.toLowerCase()).toContain("physician");
    expect(res.answer.toLowerCase()).not.toContain("5 to 7 glasses");
    expect(res.source).toBe("Care Coordination Guidelines (Reference)");
  });

  it("processes successful live Gemini API response when HTTP returns valid JSON", async () => {
    vi.stubEnv("GEMINI_API_KEY", "mock-valid-gemini-key");

    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  purpose:
                    "Gentle medicine to maintain steady cardiovascular pressure.",
                  foodGuidelines:
                    "Drink a full tumbler of water with your dose.",
                  routineTips:
                    "Keep on nightstand with a water glass for consistent mornings.",
                  audioSummary:
                    "Lisinopril helps your heart stay healthy. Take with water.",
                  disclaimer: "Follow prescribing physician directives.",
                }),
              },
            ],
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponsePayload,
    } as Response);

    const guide = await getMedicationAiGuide({
      name: "Lisinopril",
      dosage: "10mg",
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(guide.source).toBe("Google Gemini 2.5 Flash");
    expect(guide.purpose).toBe(
      "Gentle medicine to maintain steady cardiovascular pressure.",
    );
    expect(guide.foodGuidelines).toBe(
      "Drink a full tumbler of water with your dose.",
    );
  });

  it("safely falls back to reference guidance when Gemini API returns malformed JSON", async () => {
    vi.stubEnv("GEMINI_API_KEY", "mock-valid-gemini-key");

    // Broken/truncated JSON string from LLM
    const brokenPayload = {
      candidates: [
        {
          content: {
            parts: [{ text: `{"purpose": "broken json without closing brace` }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => brokenPayload,
    } as Response);

    const guide = await getMedicationAiGuide({
      name: "Lisinopril",
      dosage: "10mg",
    });

    // Successfully fell back to reference without crashing
    expect(guide.source).toBe("Care Coordination Guidelines (Reference)");
    expect(guide.medicationName).toBe("Lisinopril");
  });

  it("safely falls back to reference guidance when Gemini API returns 429 quota error", async () => {
    vi.stubEnv("GEMINI_API_KEY", "mock-valid-gemini-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Resource has been exhausted (e.g. check quota).",
    } as Response);

    const answer = await askGeminiCareQuestion({
      question: "What to do if dose is missed?",
    });

    expect(answer.source).toBe("Care Coordination Guidelines (Reference)");
    expect(answer.answer.toLowerCase()).toContain("never double");
  });

  it("safely falls back to reference guidance when Gemini API request times out", async () => {
    vi.stubEnv("GEMINI_API_KEY", "mock-valid-gemini-key");

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("The operation was aborted due to timeout"),
    );

    const answer = await askGeminiCareQuestion({
      question: "How many glasses of water should an elder drink?",
    });

    expect(answer.source).toBe("Care Coordination Guidelines (Reference)");
    expect(answer.answer.toLowerCase()).toContain("hydration");
  });
});
