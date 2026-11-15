import { describe, expect, it } from "vitest";
import { getMedicationAiGuide } from "@/lib/gemini-ai";

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
});
