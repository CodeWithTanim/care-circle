export type CircleRole = "owner" | "caregiver" | "family";

export interface Circle {
  _id: string;
  name: string; // e.g. "Eleanor's Circle"
  recipientName: string; // The elder or person receiving care
  recipientRelationship: "self" | "parent" | "spouse" | "client" | "other";
  isRecipientUser: boolean; // True if the creator/owner is the care recipient themselves
  recipientUserId?: string | null;
  timezone: string; // IANA time zone, e.g. "America/New_York"
  sharingConsent: boolean; // Explicit elder consent flag
  consentNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // Better Auth user ID
}

export interface MemberNotificationPreferences {
  upcomingDoses: boolean;
  missedDoses: boolean;
  appointments: boolean;
}

export interface Membership {
  _id: string;
  circleId: string;
  userId: string;
  role: CircleRole;
  email: string;
  name: string;
  joinedAt: Date;
  notifications: MemberNotificationPreferences;
}

export interface Invite {
  _id: string;
  circleId: string;
  codeHash: string; // SHA-256 hash of passcode
  role: "caregiver" | "family";
  label?: string; // Optional label e.g. "For Dr. Smith" or "For daughter Sarah"
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  maxUses: number;
  useCount: number;
  failedAttempts: number;
  revoked: boolean;
}

export interface Medication {
  _id: string;
  circleId: string;
  name: string;
  dosage: string; // e.g. "10mg tablet"
  instructions?: string; // e.g. "Take after breakfast with water"
  scheduleTimes: string[]; // ["08:00", "20:00"] in circle timezone
  startDate: string; // "YYYY-MM-DD"
  endDate?: string | null; // "YYYY-MM-DD" or null
  active: boolean;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export type DoseStatus =
  "scheduled" | "taken" | "snoozed" | "unconfirmed_missed";

export interface DoseOccurrence {
  _id: string;
  circleId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  instructions?: string;
  scheduledDate: string; // "YYYY-MM-DD" in circle timezone
  scheduledTime: string; // "HH:MM" in circle timezone
  scheduledTimestamp: Date; // UTC Date of the scheduled dose
  status: DoseStatus;
  takenAt?: Date | null;
  takenBy?: {
    userId: string;
    name: string;
  } | null;
  snoozeUntil?: Date | null;
  snoozeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type AppointmentStatus = "scheduled" | "completed" | "cancelled";

export interface Appointment {
  _id: string;
  circleId: string;
  title: string;
  provider: string; // Doctor or clinic name
  location: string;
  scheduledTimestamp: Date; // UTC Date
  localDate: string; // "YYYY-MM-DD"
  localTime: string; // "HH:MM"
  notes?: string;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export type AlertType = "missed_dose" | "appointment_reminder";
export type AlertStatus = "pending" | "acknowledged" | "resolved";

export interface CareAlert {
  _id: string;
  circleId: string;
  type: AlertType;
  referenceId: string; // doseOccurrenceId or appointmentId
  title: string;
  details: string;
  status: AlertStatus;
  acknowledgedBy?: {
    userId: string;
    name: string;
  } | null;
  acknowledgedAt?: Date | null;
  resolutionNotes?: string | null;
  resolvedAt?: Date | null;
  resolvedBy?: {
    userId: string;
    name: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ReminderJobType = "upcoming_dose" | "missed_dose" | "appointment";
export type ReminderJobStatus =
  "pending" | "processing" | "sent" | "failed" | "cancelled";

export interface ReminderJob {
  _id: string;
  circleId: string;
  jobType: ReminderJobType;
  referenceId: string;
  idempotencyKey: string; // e.g. `${jobType}:${referenceId}:${recipientEmail}`
  recipientEmail: string;
  recipientName: string;
  recipientUserId: string;
  scheduledFor: Date;
  status: ReminderJobStatus;
  attempts: number;
  maxAttempts: number;
  claimedAt?: Date | null;
  claimedByWorker?: string | null;
  sentAt?: Date | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyRoutine {
  _id: string;
  circleId: string;
  date: string; // "YYYY-MM-DD" in circle timezone
  bloodPressure?: {
    systolic: number;
    diastolic: number;
    recordedAt?: string;
  } | null;
  bloodSugar?: {
    value: number; // e.g. 105 mg/dL
    unit?: string;
    context?: "fasting" | "post_meal" | "random";
    recordedAt?: string;
  } | null;
  waterGlasses?: number; // 0-12
  wellnessWalkDone?: boolean;
  notes?: string;
  recordedBy?: {
    userId: string;
    name: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}
