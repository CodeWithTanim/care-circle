import { describe, expect, it } from "vitest";
import { askGeminiCareQuestion, getMedicationAiGuide } from "@/lib/gemini-ai";

describe("Gemini AI Care Assistant & Medication Guide", () => {
  it("generates clinical knowledgebase guidance for Lisinopril", async () => {
    const guide = await getMedicationAiGuide({
      name: "Lisinopril",
      dosage: "10mg",
      instructions: "Take once daily in the morning",
    });

    expect(guide.medicationName).toBe("Lisinopril");
    expect(guide.purpose.toLowerCase()).toContain("blood pressure");
    expect(guide.foodGuidelines).toContain("water");
    expect(guide.routineTips.toLowerCase()).toContain("morning");
    expect(guide.audioSummary).toBeTruthy();
    expect(guide.disclaimer).toBeTruthy();
  });

  it("generates clinical knowledgebase guidance for Metformin", async () => {
    const guide = await getMedicationAiGuide({
      name: "Metformin",
      dosage: "500mg",
      instructions: "Take with meals",
    });

    expect(guide.medicationName).toBe("Metformin");
    expect(guide.purpose.toLowerCase()).toContain("blood sugar");
    expect(guide.foodGuidelines.toLowerCase()).toContain("meal");
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
  });

  it("answers eldercare care questions with knowledgebase fallback", async () => {
    const res = await askGeminiCareQuestion({
      question: "What should we do if Eleanor misses her morning dose?",
      circleName: "Vance Family Circle",
      recipientName: "Eleanor Vance",
      medicationsSummary: "Lisinopril 10mg, Metformin 500mg",
    });

    expect(res.answer.toLowerCase()).toContain("never double");
    expect(res.source).toBeTruthy();
    expect(res.suggestedFollowUps.length).toBeGreaterThan(0);
    expect(res.disclaimer.toLowerCase()).toContain("informational");
  });

  it("answers hydration and water routine questions safely", async () => {
    const res = await askGeminiCareQuestion({
      question: "How much water should Eleanor drink each day?",
      recipientName: "Eleanor Vance",
    });

    expect(res.answer.toLowerCase()).toContain("hydration");
    expect(res.answer).toContain("glasses");
  });
});
