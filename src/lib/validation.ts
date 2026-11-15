import { z } from "zod";

// Valid IANA timezone check using runtime Intl
export function isValidIanaTimeZone(tz: string): boolean {
  if (typeof tz !== "string" || !tz.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

const timeFormatRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateFormatRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isValidCalendarDate(dateStr: string): boolean {
  if (!dateFormatRegex.test(dateStr)) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

export const createCircleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Circle name must be at least 2 characters")
    .max(60),
  recipientName: z
    .string()
    .trim()
    .min(2, "Care recipient name must be at least 2 characters")
    .max(60),
  recipientRelationship: z.enum([
    "self",
    "parent",
    "spouse",
    "client",
    "other",
  ]),
  isRecipientUser: z.boolean().default(false),
  timezone: z
    .string()
    .refine(isValidIanaTimeZone, "Invalid or unsupported IANA timezone")
    .default("UTC"),
  sharingConsent: z.boolean().refine((val) => val === true, {
    message:
      "Explicit consent is required to share care coordination information",
  }),
  consentNotes: z.string().trim().max(300).optional(),
});

export const updateCircleSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  timezone: z
    .string()
    .refine(isValidIanaTimeZone, "Invalid or unsupported IANA timezone")
    .optional(),
  sharingConsent: z.boolean().optional(),
  consentNotes: z.string().trim().max(300).optional(),
});

export const transferOwnershipSchema = z.object({
  newOwnerUserId: z.string().min(1, "New owner user ID is required"),
});

export const createInviteSchema = z.object({
  role: z.enum(["caregiver", "family"]),
  label: z.string().trim().max(60).optional(),
  expiresInHours: z.number().int().min(1).max(168).default(48), // 1 hour to 7 days
  maxUses: z.number().int().min(1).max(10).default(1),
  isRecipientInvite: z.boolean().optional(),
});

export const joinCircleSchema = z.object({
  passcode: z
    .string()
    .trim()
    .min(6, "Passcode must be at least 6 characters")
    .max(32, "Passcode is too long")
    .transform((val) => val.toUpperCase().replace(/[^A-Z0-9]/g, "")),
});

export const createMedicationSchema = z
  .object({
    name: z.string().trim().min(2, "Medication name is required").max(100),
    dosage: z.string().trim().min(1, "Dosage is required (e.g. 10mg)").max(60),
    instructions: z.string().trim().max(300).optional(),
    scheduleTimes: z
      .array(
        z
          .string()
          .regex(timeFormatRegex, "Time must be HH:MM format (24-hour)"),
      )
      .min(1, "At least one daily schedule time is required")
      .max(6, "Maximum 6 times per day")
      .refine(
        (times) => new Set(times).size === times.length,
        "Duplicate schedule times are not allowed",
      ),
    startDate: z
      .string()
      .refine(
        isValidCalendarDate,
        "Start date must be a valid calendar date (YYYY-MM-DD)",
      ),
    endDate: z
      .string()
      .refine(
        isValidCalendarDate,
        "End date must be a valid calendar date (YYYY-MM-DD)",
      )
      .nullable()
      .optional(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "End date must be greater than or equal to start date",
    path: ["endDate"],
  });

export const updateMedicationSchema = createMedicationSchema.and(
  z.object({
    active: z.boolean().default(true),
  }),
);

export const recordDoseSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("taken"),
  }),
  z.object({
    action: z.literal("snooze"),
    snoozeMinutes: z.number().int().min(5).max(60).default(15),
  }),
]);

export const createAppointmentSchema = z.object({
  title: z.string().trim().min(2, "Appointment title is required").max(100),
  provider: z
    .string()
    .trim()
    .min(2, "Healthcare provider or clinic name is required")
    .max(100),
  location: z
    .string()
    .trim()
    .min(2, "Location or address is required")
    .max(200),
  localDate: z
    .string()
    .refine(
      isValidCalendarDate,
      "Date must be a valid calendar date (YYYY-MM-DD)",
    ),
  localTime: z
    .string()
    .regex(timeFormatRegex, "Time must be HH:MM format (24-hour)"),
  notes: z.string().trim().max(500).optional(),
});

export const updateAppointmentSchema = createAppointmentSchema.extend({
  status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"),
});

export const acknowledgeAlertSchema = z.object({
  alertId: z.string().min(1, "Alert ID is required"),
});

export const resolveAlertSchema = z.object({
  alertId: z.string().min(1, "Alert ID is required"),
  notes: z.string().trim().max(300).optional(),
});

export const updateNotificationPreferencesSchema = z.object({
  upcomingDoses: z.boolean(),
  missedDoses: z.boolean(),
  appointments: z.boolean(),
});
