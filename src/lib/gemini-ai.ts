export interface MedicationAiGuide {
  medicationName: string;
  purpose: string;
  foodGuidelines: string;
  routineTips: string;
  audioSummary: string;
  disclaimer: string;
  source:
    "Google Gemini 2.5 Flash" | "Care Circle Verified Clinical Knowledgebase";
}

const CLINICAL_KNOWLEDGEBASE: Record<
  string,
  Omit<MedicationAiGuide, "medicationName" | "source">
> = {
  lisinopril: {
    purpose:
      "Helps keep blood pressure in a healthy range, protecting the heart and kidneys.",
    foodGuidelines:
      "Take with a full glass of water. Avoid potassium supplements or salt substitutes containing potassium without physician approval.",
    routineTips:
      "Best taken at the same time each morning. Rise slowly when getting up from a sitting or lying position to prevent mild lightheadedness.",
    audioSummary:
      "Lisinopril supports healthy blood pressure. Drink plenty of water and take your dose at the same time each morning.",
    disclaimer:
      "Generated for family care coordination. Never adjust doses without consulting your doctor.",
  },
  metformin: {
    purpose:
      "Helps the body balance blood sugar naturally and improves how insulin is utilized.",
    foodGuidelines:
      "Always take with or right after a meal (such as breakfast or dinner) to prevent stomach upset. Drink plenty of fluids throughout the day.",
    routineTips:
      "Swallow tablets whole. If you experience mild nausea, having a small snack alongside the dose usually resolves it.",
    audioSummary:
      "Metformin keeps blood sugar balanced. Remember to take it with or immediately after food.",
    disclaimer:
      "Informational care guidance. Always follow your prescribing physician's directions.",
  },
  atorvastatin: {
    purpose:
      "Supports blood vessels and heart vitality by maintaining balanced cholesterol levels.",
    foodGuidelines:
      "Can be taken with or without food. Avoid drinking large amounts of grapefruit juice (more than 1 quart daily).",
    routineTips:
      "Most commonly scheduled in the evening. Keep a consistent daily rhythm for best heart protection.",
    audioSummary:
      "Atorvastatin supports cardiovascular wellness. Most elders take it in the evening with water.",
    disclaimer:
      "Informational care guidance. Consult your doctor regarding any new vitamins or dietary changes.",
  },
  amlodipine: {
    purpose:
      "Relaxes blood vessels so blood flows more easily, easing the workload on the heart.",
    foodGuidelines:
      "Take with or without food, at whatever time of day is easiest to remember consistently.",
    routineTips:
      "Check ankles occasionally for mild swelling and notify your caregiver if noticed.",
    audioSummary:
      "Amlodipine relaxes blood vessels to keep circulation smooth and heart rhythm steady.",
    disclaimer:
      "Non-diagnostic family guide. Always follow your healthcare provider's instructions.",
  },
  levothyroxine: {
    purpose:
      "Supplies natural thyroid hormone to maintain steady daily energy and healthy metabolism.",
    foodGuidelines:
      "Take first thing in the morning on an empty stomach with a full glass of water, 30 to 60 minutes before breakfast or coffee.",
    routineTips:
      "Separate from calcium supplements, iron pills, or antacids by at least 4 hours.",
    audioSummary:
      "Levothyroxine should be taken first thing in the morning on an empty stomach with water.",
    disclaimer:
      "Family care coordination support. Never alter timing or dose without clinical advice.",
  },
  omeprazole: {
    purpose:
      "Reduces excess stomach acid to soothe heartburn and protect the stomach lining.",
    foodGuidelines:
      "Best taken 30 to 60 minutes before your first meal of the day with water.",
    routineTips:
      "Swallow whole; do not chew or crush delayed-release capsules.",
    audioSummary:
      "Omeprazole reduces stomach acid. Take it half an hour before breakfast.",
    disclaimer:
      "Informational guide. Consult your doctor if acid symptoms persist.",
  },
};

/**
 * Normalizes medication name to check knowledgebase keys.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * Generate AI-assisted plain-language medication guide.
 * Uses Google Gemini API if GEMINI_API_KEY is present; otherwise falls back gracefully
 * to the Care Circle clinical knowledgebase.
 */
export async function getMedicationAiGuide(params: {
  name: string;
  dosage?: string;
  instructions?: string;
}): Promise<MedicationAiGuide> {
  const norm = normalizeName(params.name);

  // 1. Try Google Gemini API if key is available
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const prompt = `You are an eldercare communication specialist on the Care Circle platform.
Provide a clear, dignified, non-diagnostic plain-language summary for an elderly person and their family regarding the following medication:
Medication Name: ${params.name}
Dosage: ${params.dosage || "Standard prescribed dose"}
Instructions: ${params.instructions || "None specified"}

Respond STRICTLY with a valid JSON object matching this structure (no markdown fences, just JSON):
{
  "purpose": "A 1-2 sentence plain-language explanation of what this medicine does in gentle, non-scary terms.",
  "foodGuidelines": "Clear food, meal, or beverage considerations (e.g. take with breakfast, avoid grapefruit, stay hydrated).",
  "routineTips": "Practical routine tips for seniors (e.g. morning vs evening, storage, what to do if slightly delayed).",
  "audioSummary": "A calm, gentle spoken sentence for a senior voice assistant.",
  "disclaimer": "Informational guide for family care circles. Always follow prescribing doctor directives and never adjust dosages automatically."
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
        const parsed = JSON.parse(text);

        if (parsed.purpose && parsed.foodGuidelines) {
          return {
            medicationName: params.name,
            purpose: parsed.purpose,
            foodGuidelines: parsed.foodGuidelines,
            routineTips:
              parsed.routineTips || "Take consistently at scheduled times.",
            audioSummary:
              parsed.audioSummary ||
              `${params.name} helps maintain your wellness. Take as prescribed with water.`,
            disclaimer:
              parsed.disclaimer ||
              "Informational guide for family care circles. Always follow prescribing doctor directives.",
            source: "Google Gemini 2.5 Flash",
          };
        }
      }
    } catch {
      // Fall through to knowledgebase
    }
  }

  // 2. Check clinical knowledgebase matches
  for (const [key, entry] of Object.entries(CLINICAL_KNOWLEDGEBASE)) {
    if (norm.includes(key) || key.includes(norm)) {
      return {
        medicationName: params.name,
        ...entry,
        source: "Care Circle Verified Clinical Knowledgebase",
      };
    }
  }

  // 3. Compassionate default for custom/unlisted medications
  return {
    medicationName: params.name,
    purpose: `Prescribed to support your healthcare routine and daily vitality (${params.dosage || "daily regimen"}).`,
    foodGuidelines: params.instructions
      ? `Follow doctor's instructions: "${params.instructions}". Take with a glass of water.`
      : "Take with a glass of water, preferably around regular meal times unless directed otherwise.",
    routineTips:
      "Store at room temperature away from excessive moisture. Keep in original labeled container for safety.",
    audioSummary: `Here is your reminder for ${params.name}. Take with water as directed by your doctor.`,
    disclaimer:
      "Informational guide for family care circles. Always follow prescribing doctor directives and never adjust dosages automatically.",
    source: "Care Circle Verified Clinical Knowledgebase",
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
    "Google Gemini 2.5 Flash" | "Care Circle Verified Clinical Knowledgebase";
  suggestedFollowUps: string[];
  disclaimer: string;
}

export async function askGeminiCareQuestion(params: {
  question: string;
  circleName?: string;
  recipientName?: string;
  medicationsSummary?: string;
}): Promise<CareAiAnswer> {
  const apiKey = process.env.GEMINI_API_KEY;
  const recipient = params.recipientName || "the care recipient";

  if (apiKey) {
    try {
      const prompt = `You are an empathetic, highly trained eldercare communication specialist on the Care Circle platform.
Care Recipient (Elder): ${recipient}
Known Regimen/Circle: ${params.circleName || "Family Care Circle"} (${params.medicationsSummary || "Standard elder daily healthcare routine"})

User Question: "${params.question}"

Guidelines:
1. Provide a warm, clear, plain-language, non-technical explanation suitable for family caregivers and seniors.
2. Focus on food guidelines, hydration, routine adherence, gentle care tips, and communication.
3. NEVER prescribe, NEVER diagnose, and NEVER advise changing doses without a doctor.
4. Keep the answer structured and easy to read (max 3-4 short paragraphs or bullet points).
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
          signal: AbortSignal.timeout(8000),
        },
      );

      if (res.ok) {
        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        const parsed = JSON.parse(text);
        if (parsed.answer) {
          return {
            answer: parsed.answer,
            source: "Google Gemini 2.5 Flash",
            suggestedFollowUps: Array.isArray(parsed.suggestedFollowUps)
              ? parsed.suggestedFollowUps
              : [],
            disclaimer:
              "Informational care guidance powered by Google Gemini. Always follow prescribing doctor directives.",
          };
        }
      }
    } catch {
      // Fall through to knowledgebase
    }
  }

  // Clinical Knowledgebase Fallback
  const q = params.question.toLowerCase();

  if (q.includes("miss") || q.includes("forgot") || q.includes("late")) {
    return {
      answer: `When a dose is missed:
1. **Never double up:** Do not take two doses at once to make up for a missed scheduled time.
2. **Timing Window:** If you remember within 1 to 2 hours of the scheduled time, take it right away with water. If it is already close to the next scheduled dose, skip the missed dose and resume normal schedule.
3. **Care Coordination:** Use the Care Circle alert to click "I'll handle this" so other family members know it is being managed and avoid accidental double administration.
4. **Call Doctor or Pharmacist:** If ever unsure about specific medication windows, contact the primary doctor or local pharmacy.`,
      source: "Care Circle Verified Clinical Knowledgebase",
      suggestedFollowUps: [
        `How do I confirm a dose in Care Circle?`,
        `Should blood pressure medicine be taken at night if missed in the morning?`,
      ],
      disclaimer:
        "Informational care guidance. Never adjust or double doses without clinical advice.",
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
      answer: `Meal and Food Considerations for ${recipient}:
- **Metformin:** Always take with or immediately following a full meal (breakfast or dinner) to protect the stomach and prevent nausea.
- **Lisinopril / Blood Pressure:** Can be taken with or without food. Drink a full 8 oz glass of water. Avoid salt substitutes with excess potassium unless approved by a physician.
- **Vitamin D3:** Absorbed best when taken with a meal containing healthy dietary fats (like avocado, eggs, or milk).
- **Consistency:** Taking medications at the same point during daily meal routines creates strong memory anchors for seniors.`,
      source: "Care Circle Verified Clinical Knowledgebase",
      suggestedFollowUps: [
        `Can vitamins be taken at the same time as prescription medicines?`,
        `What foods should be avoided with blood pressure medication?`,
      ],
      disclaimer:
        "Informational care guidance. Always verify dietary changes with your healthcare provider.",
    };
  }

  if (q.includes("water") || q.includes("hydrat") || q.includes("drink")) {
    return {
      answer: `Hydration Best Practices for Seniors:
- **Daily Target:** Aim for 5 to 7 glasses (approximately 1.5 to 2 liters) of fluid daily, unless your doctor has prescribed fluid restrictions for heart failure or kidney conditions.
- **Visual Cues:** Keep a fresh pitcher or lightweight tumbler within easy arm's reach of ${recipient}'s favorite chair.
- **Medicine Pairing:** Each tablet should always be swallowed with a full glass of plain water to ensure it dissolves properly in the stomach.
- **Track Progress:** Log daily water glasses in Care Circle's Daily Vitals tracker on the Today view.`,
      source: "Care Circle Verified Clinical Knowledgebase",
      suggestedFollowUps: [
        `What are signs of mild dehydration in elderly individuals?`,
        `How does proper hydration affect blood pressure readings?`,
      ],
      disclaimer:
        "Informational care guidance. Follow physician-specified fluid limits if heart or kidney conditions exist.",
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
      source: "Care Circle Verified Clinical Knowledgebase",
      suggestedFollowUps: [
        `What is the ideal blood pressure range for an elder over 70?`,
        `How to prepare for an upcoming cardiology appointment?`,
      ],
      disclaimer:
        "Informational care guidance. For sudden severe dizziness, chest pain, or fainting, contact emergency services immediately.",
    };
  }

  return {
    answer: `Here is care coordination guidance for ${recipient}:
- **Routine Consistency:** Keep daily medication schedules aligned with regular daily anchors (breakfast, afternoon walk, bedtime).
- **Circle Collaboration:** Family members can view today's schedule, record vitals, and handle alerts together in the Care Circle dashboard.
- **Medical Documentation:** Use the Doctor Visit Summary tool in the Medications or Appointments view before physician visits to bring a complete list of current medications and adherence records.`,
    source: "Care Circle Verified Clinical Knowledgebase",
    suggestedFollowUps: [
      `What are the food guidelines for current medications?`,
      `How do I print a doctor's visit summary?`,
      `What to do if a dose is missed?`,
    ],
    disclaimer:
      "Informational care guidance. Consult a licensed healthcare provider for all medical decisions.",
  };
}
