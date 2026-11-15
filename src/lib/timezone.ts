export const DEFAULT_GRACE_PERIOD_MINUTES = 60; // 60 minutes after due time before unconfirmed missed

/**
 * Converts a date string (YYYY-MM-DD) and 24-hr time string (HH:MM) in an IANA time zone into a UTC Date.
 * Accurately accounts for standard time vs daylight saving time transitions.
 */
export function localToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string = "UTC",
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  // Initial estimate assuming UTC
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcGuess);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  let h = parseInt(map.hour, 10);
  if (h === 24) h = 0;

  const localGuessAsUtc = Date.UTC(
    parseInt(map.year, 10),
    parseInt(map.month, 10) - 1,
    parseInt(map.day, 10),
    h,
    parseInt(map.minute, 10),
  );

  const offsetMs = localGuessAsUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

/**
 * Converts a UTC Date into local date (YYYY-MM-DD) and time (HH:MM) strings in an IANA time zone.
 */
export function utcToLocalDate(
  date: Date,
  timeZone: string = "UTC",
): { localDate: string; localTime: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // en-CA formats date as YYYY-MM-DD
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  let hour = map.hour;
  if (hour === "24") hour = "00";

  const localDate = `${map.year}-${map.month}-${map.day}`;
  const localTime = `${hour}:${map.minute}`;

  return { localDate, localTime };
}

/**
 * Returns today's YYYY-MM-DD string in the specified IANA time zone.
 */
export function getTodayLocalDate(
  timeZone: string = "UTC",
  now: Date = new Date(),
): string {
  const { localDate } = utcToLocalDate(now, timeZone);
  return localDate;
}

/**
 * Format a Date for human reading in the circle's time zone.
 */
export function formatInTimeZone(
  date: Date,
  timeZone: string = "UTC",
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    ...options,
  }).format(date);
}

/**
 * Determines whether a dose occurrence has passed its grace period without confirmation.
 */
export function isDoseOverdue(
  scheduledUtc: Date,
  snoozeUntil?: Date | null,
  gracePeriodMinutes: number = DEFAULT_GRACE_PERIOD_MINUTES,
  nowUtc: Date = new Date(),
): boolean {
  const referenceTime =
    snoozeUntil && snoozeUntil > scheduledUtc ? snoozeUntil : scheduledUtc;
  const deadlineMs = referenceTime.getTime() + gracePeriodMinutes * 60 * 1000;
  return nowUtc.getTime() > deadlineMs;
}
