import { z } from "zod";

export interface MedicationAiGuide {
  medicationName: string;
  purpose: string;
  foodGuidelines: string;
  routineTips: string;
  audioSummary: string;
  disclaimer: string;
  source:
    "Google Gemini 2.5 Flash" | "Care Coordination Guidelines (Reference)";
}

const geminiGuideEnvelopeSchema = z.object({
  purpose: z.string().min(1).max(1000),
  foodGuidelines: z.string().min(1).max(1000),
  routineTips: z.string().max(1000).optional(),
  audioSummary: z.string().max(500).optional(),
  disclaimer: z.string().max(500).optional(),
});

const geminiAnswerEnvelopeSchema = z.object({
  answer: z.string().min(1).max(3000),
  suggestedFollowUps: z.array(z.string().max(200)).max(5).optional(),
});

const CARE_COORDINATION_REFERENCE_GUIDES: Record<
  string,
  Omit<MedicationAiGuide, "medicationName" | "source">
> = {
  lisinopril: {
    purpose:
      "Commonly prescribed by doctors to support healthy blood pressure and cardiovascular wellness.",
    foodGuidelines:
      "Take with a full glass of water. Review any potassium supplements or salt substitutes with your physician.",
    routineTips:
      "Most elders take their dose at the same time each morning. Rise gradually from sitting or lying positions to maintain balance.",
    audioSummary:
      "Lisinopril supports healthy blood pressure. Take your prescribed dose with water at your consistent morning time.",
    disclaimer:
      "Care coordination reference. Always adhere strictly to your prescribing physician's directions and pharmacy label.",
  },
  metformin: {
    purpose:
      "Prescribed to help manage blood sugar levels as part of a doctor-supervised routine.",
    foodGuidelines:
      "Always take with or immediately following a meal (such as breakfast or dinner) as directed by your clinician.",
    routineTips:
      "Swallow tablets whole with water. Keeping a consistent daily meal and dose routine helps maintain balance.",
    audioSummary:
      "Metformin supports balanced blood sugar. Remember to take your prescribed dose with or immediately after food.",
    disclaimer:
      "Care coordination reference. Consult your doctor or pharmacist for any personalized medical advice.",
  },
  atorvastatin: {
    purpose:
      "Prescribed to assist in maintaining balanced cholesterol levels and cardiovascular health.",
    foodGuidelines:
      "Can generally be taken with or without meals as directed. Discuss dietary questions with your doctor.",
    routineTips:
      "Commonly taken in the evening. Keep a consistent daily routine for best coordination.",
    audioSummary:
      "Atorvastatin supports cardiovascular health. Take as prescribed with a glass of water.",
    disclaimer:
      "Care coordination reference. Check with your doctor before introducing new dietary supplements.",
  },
  amlodipine: {
    purpose:
      "Prescribed to support healthy blood pressure and smooth blood flow.",
    foodGuidelines:
      "Take with water, with or without food, as indicated by your physician.",
    routineTips:
      "Take at the same time daily. Report any noticeable ankle swelling or changes to your healthcare provider.",
    audioSummary:
      "Amlodipine supports blood pressure management. Take consistently with water as prescribed.",
    disclaimer:
      "Care coordination reference. Follow your clinician's specific prescription guidance.",
  },
  levothyroxine: {
    purpose:
      "Prescribed to supplement thyroid hormone levels for balanced daily metabolism.",
    foodGuidelines:
      "Typically taken in the morning on an empty stomach with a full glass of water, 30 to 60 minutes before food.",
    routineTips:
      "Separate from calcium or iron supplements by at least 4 hours, or as directed by your pharmacist.",
    audioSummary:
      "Levothyroxine is taken in the morning with water, as directed by your prescribing physician.",
    disclaimer:
      "Care coordination reference. Do not alter dose or timing without explicit physician instruction.",
  },
  omeprazole: {
    purpose:
      "Prescribed to manage stomach acid and protect the digestive tract lining.",
    foodGuidelines:
      "Usually taken 30 to 60 minutes before your first meal of the day with water.",
    routineTips:
      "Swallow capsules whole with water; do not crush or chew delayed-release capsules.",
    audioSummary:
      "Omeprazole helps manage stomach acid. Take before breakfast with water as prescribed.",
    disclaimer:
      "Care coordination reference. Contact your doctor if gastrointestinal symptoms persist.",
  },
};

/**
 * Exact word / token matching to avoid substring false positives (e.g. 'NotLisinopril').
 */
function matchesMedication(name: string, key: string): boolean {
  const cleanName = name.toLowerCase().trim();
  const tokens = cleanName.split(/[^a-z0-9]+/);
  return tokens.includes(key) || cleanName === key;
}

/**
 * Generate AI-assisted plain-language medication guide.
 * Uses Google Gemini API if GEMINI_API_KEY is present; otherwise falls back gracefully
 * to Care Coordination Guidelines.
 */
export async function getMedicationAiGuide(params: {
  name: string;
  dosage?: string;
  instructions?: string;
}): Promise<MedicationAiGuide> {
  const safeName = (params.name || "").trim().slice(0, 100);
  const safeDosage = (params.dosage || "Standard prescribed dose")
    .trim()
    .slice(0, 60);
  const safeInstructions = (params.instructions || "Follow prescription label")
    .trim()
    .slice(0, 300);

  // 1. Try Google Gemini API if key is available
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    try {
      // Data minimization: generic elder prompt, omitting private personal names
      const prompt = `You are an eldercare communication assistant on the Care Circle platform.
Provide a clear, dignified, non-diagnostic plain-language summary for an elderly person and their family regarding the following medication:
Medication Name: ${safeName}
Dosage: ${safeDosage}
Instructions: ${safeInstructions}

Respond STRICTLY with a valid JSON object matching this structure (no markdown fences, just JSON):
{
  "purpose": "A 1-2 sentence plain-language explanation of what this medicine does in gentle terms.",
  "foodGuidelines": "Clear food or beverage considerations based on the label.",
  "routineTips": "Practical routine tips for seniors (e.g. consistency, hydration).",
  "audioSummary": "A calm, gentle spoken sentence for a senior voice assistant.",
  "disclaimer": "Care coordination guide. Always follow prescribing doctor directives and pharmacy labels."
}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(6000), // 6 second timeout
        },
      );

      if (res.ok) {
        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        const rawParsed = JSON.parse(text);
        const parsed = geminiGuideEnvelopeSchema.safeParse(rawParsed);

        if (parsed.success) {
          return {
            medicationName: safeName,
            purpose: parsed.data.purpose,
            foodGuidelines: parsed.data.foodGuidelines,
            routineTips:
              parsed.data.routineTips ||
              "Take consistently at scheduled times as prescribed.",
            audioSummary:
              parsed.data.audioSummary ||
              `${safeName} supports your daily wellness. Take as prescribed with water.`,
            disclaimer:
              parsed.data.disclaimer ||
              "Care coordination guide. Always follow prescribing doctor directives and pharmacy labels.",
            source: "Google Gemini 2.5 Flash",
          };
        }
      }
    } catch {
      // Fall through safely to care coordination reference
    }
  }

  // 2. Check reference guides with exact token matching
  for (const [key, entry] of Object.entries(
    CARE_COORDINATION_REFERENCE_GUIDES,
  )) {
    if (matchesMedication(safeName, key)) {
      return {
        medicationName: safeName,
        ...entry,
        source: "Care Coordination Guidelines (Reference)",
      };
    }
  }

  // 3. Safe, supportive default for custom/unlisted medications
  return {
    medicationName: safeName,
    purpose: `Prescribed to support daily wellness and healthcare routine (${safeDosage}).`,
    foodGuidelines: safeInstructions
      ? `Follow prescription instructions: "${safeInstructions}". Take with water.`
      : "Take with a glass of water, aligning with regular meal times unless directed otherwise by your clinician.",
    routineTips:
      "Store at room temperature away from excessive moisture. Keep in the original pharmacy labeled container.",
    audioSummary: `Here is your reminder for ${safeName}. Take with water as directed by your clinician.`,
    disclaimer:
      "Care coordination reference for families. Always follow prescribing doctor directives and never adjust dosages automatically.",
    source: "Care Coordination Guidelines (Reference)",
  };
}

export function hasGeminiApiKey(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0,
  );
}

export interface CareAiAnswer {
  answer: string;
  source:
    "Google Gemini 2.5 Flash" | "Care Coordination Guidelines (Reference)";
  suggestedFollowUps: string[];
  disclaimer: string;
}

export async function askGeminiCareQuestion(params: {
  question: string;
  circleName?: string;
  recipientName?: string;
  medicationsSummary?: string;
}): Promise<CareAiAnswer> {
  const safeQuestion = (params.question || "").trim().slice(0, 500);
  const safeMedSummary = (params.medicationsSummary || "Standard daily routine")
    .trim()
    .slice(0, 200);

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      // Data minimization: generic eldercare query, omit identifying user/circle names
      const prompt = `You are an empathetic eldercare communication assistant on the Care Circle platform.
Care Context: Standard elder daily routine (${safeMedSummary})
User Question: "${safeQuestion}"

Guidelines:
1. Provide a warm, clear, plain-language explanation suitable for family caregivers and seniors.
2. Focus on food guidelines, hydration, routine adherence, gentle care tips, and communication.
3. NEVER prescribe, NEVER diagnose, and NEVER advise changing doses without a doctor.
4. Keep the answer structured and easy to read (max 3 short paragraphs or bullet points).
5. Always remind the caregiver to consult the recipient's primary doctor for medical decisions.

Respond STRICTLY with a valid JSON object matching this structure (no markdown fences, just JSON):
{
  "answer": "Clear, formatted explanation...",
  "suggestedFollowUps": ["Follow-up question 1?", "Follow-up question 2?"]
}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(6000),
        },
      );

      if (res.ok) {
        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        const rawParsed = JSON.parse(text);
        const parsed = geminiAnswerEnvelopeSchema.safeParse(rawParsed);
        if (parsed.success && parsed.data.answer) {
          return {
            answer: parsed.data.answer,
            source: "Google Gemini 2.5 Flash",
            suggestedFollowUps: parsed.data.suggestedFollowUps || [],
            disclaimer:
              "Informational care guidance powered by Google Gemini. Always verify with your prescribing physician.",
          };
        }
      }
    } catch {
      // Fall through to reference guidelines
    }
  }

  // Care Coordination Guidelines Reference Fallback
  const q = safeQuestion.toLowerCase();

  if (q.includes("miss") || q.includes("forgot") || q.includes("late")) {
    return {
      answer: `Care coordination guidance for a missed or delayed dose:
1. **Check Prescription Label:** Refer directly to the instructions printed on the pharmacy bottle or medication packaging for the specific medication's missed-dose policy.
2. **Never Double Up:** Do not take an extra or double dose to make up for a missed dose unless explicitly directed by your prescribing physician.
3. **Coordinate with Your Care Circle:** Check the Today view to see if another caregiver has already marked the dose taken or clicked "I'll handle this", preventing accidental duplicate administration.
4. **Contact Prescriber or Pharmacist:** For specific timing guidance on whether to take or hold the dose, call your pharmacist or physician's office directly.`,
      source: "Care Coordination Guidelines (Reference)",
      suggestedFollowUps: [
        `How do I coordinate an alert in Care Circle?`,
        `How do I contact the pharmacy listed for this prescription?`,
      ],
      disclaimer:
        "Care coordination guidance only. Consult your pharmacist or prescribing doctor for medical advice on missed doses.",
    };
  }

  if (
    q.includes("food") ||
    q.includes("eat") ||
    q.includes("meal") ||
    q.includes("breakfast") ||
    q.includes("dinner")
  ) {
    return {
      answer: `Meal and Food Considerations for Family Care:
- **Metformin:** Always take with or immediately following a full meal (breakfast or dinner) as directed by your prescribing clinician to protect the stomach.
- **Lisinopril / Blood Pressure:** Can be taken with or without food. Avoid salt substitutes with excess potassium unless approved by a physician.
- **Vitamin D3:** Follow prescription instructions regarding meals or dietary supplements.
- **Consistency:** Taking medications at the same point during daily meal routines creates strong memory anchors for seniors.`,
      source: "Care Coordination Guidelines (Reference)",
      suggestedFollowUps: [
        `Can vitamins be taken at the same time as prescription medicines?`,
        `What foods should be avoided with blood pressure medication?`,
      ],
      disclaimer:
        "Care coordination guidance. Always verify dietary questions with your healthcare provider.",
    };
  }

  if (q.includes("water") || q.includes("hydrat") || q.includes("drink")) {
    return {
      answer: `Daily Hydration Care Coordination:
- **Physician Instructions:** Hydration targets must follow your doctor's personalized guidance, especially for individuals with heart failure, kidney disease, or fluid restriction plans.
- **Accessibility:** Keep water or preferred fluids easily accessible in comfortable, easy-to-grip tumblers.
- **Pairing with Routine:** Offer sips of water with daily routine activities and during medication times as permitted by clinical guidance.
- **Track in Care Circle:** Caregivers can log daily fluid intake on the Today view to monitor consistency across family members.`,
      source: "Care Coordination Guidelines (Reference)",
      suggestedFollowUps: [
        `How do I log water intake on the Today dashboard?`,
        `Where can I note fluid restriction guidelines from our doctor?`,
      ],
      disclaimer:
        "Care coordination guidance only. Follow doctor-specified fluid limits for heart or kidney conditions.",
    };
  }

  if (
    q.includes("pressure") ||
    q.includes("bp") ||
    q.includes("dizz") ||
    q.includes("standing")
  ) {
    return {
      answer: `Blood Pressure & Fall Prevention Routine:
- **Rise Slowly:** When transitioning from bed or chair, sit on the edge for 30 to 60 seconds before standing up. This prevents orthostatic lightheadedness common with blood pressure medications like Lisinopril.
- **Consistent Log:** Check and record blood pressure at the same time every morning (before medication and breakfast) using the Care Circle Vitals tracker.
- **Doctor Checkpoints:** Note any readings above 140/90 or below 100/60 to discuss with the cardiologist or primary doctor.`,
      source: "Care Coordination Guidelines (Reference)",
      suggestedFollowUps: [
        `What is the ideal blood pressure range for an elder over 70?`,
        `How to prepare for an upcoming cardiology appointment?`,
      ],
      disclaimer:
        "Care coordination guidance. For sudden severe dizziness, chest pain, or fainting, contact emergency services immediately.",
    };
  }

  return {
    answer: `Here is general care coordination guidance:
- **Routine Consistency:** Keep daily medication schedules aligned with regular daily anchors (breakfast, afternoon walk, bedtime).
- **Circle Collaboration:** Family members can view today's schedule, record vitals, and handle alerts together in the Care Circle dashboard.
- **Medical Documentation:** Use the Doctor Visit Summary tool in the Medications or Appointments view before physician visits to bring a complete list of current medications and adherence records.`,
    source: "Care Coordination Guidelines (Reference)",
    suggestedFollowUps: [
      `What are the food guidelines for current medications?`,
      `How do I print a doctor's visit summary?`,
      `What to do if a dose is missed?`,
    ],
    disclaimer:
      "Care coordination guidance. Consult a licensed healthcare provider for all medical decisions.",
  };
}
