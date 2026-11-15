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
  const targetUtcEpoch = Date.UTC(year, month - 1, day, hour, minute);

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

  function getOffset(d: Date): number {
    const parts = formatter.formatToParts(d);
    const m: Record<string, string> = {};
    for (const p of parts) m[p.type] = p.value;
    let h = parseInt(m.hour, 10);
    if (h === 24) h = 0;
    const localAsUtc = Date.UTC(
      parseInt(m.year, 10),
      parseInt(m.month, 10) - 1,
      parseInt(m.day, 10),
      h,
      parseInt(m.minute, 10),
    );
    return localAsUtc - d.getTime();
  }

  let candidate = new Date(targetUtcEpoch);
  for (let i = 0; i < 4; i++) {
    const offset = getOffset(candidate);
    const nextCandidate = new Date(targetUtcEpoch - offset);
    if (nextCandidate.getTime() === candidate.getTime()) break;
    candidate = nextCandidate;
  }

  // Verify candidate round-trips to target local time
  const checkParts = formatter.formatToParts(candidate);
  const cm: Record<string, string> = {};
  for (const p of checkParts) cm[p.type] = p.value;
  let ch = parseInt(cm.hour, 10);
  if (ch === 24) ch = 0;
  const cmin = parseInt(cm.minute, 10);

  // If there is a discrepancy due to a spring-forward transition gap (e.g. 02:30 skipped to 03:00):
  // Shift forward by 1 hour (the gap) and recompute (standard compatible disambiguation).
  if (ch !== hour || cmin !== minute) {
    const gapShiftEpoch = targetUtcEpoch + 3600 * 1000;
    let gapCandidate = new Date(gapShiftEpoch);
    for (let i = 0; i < 4; i++) {
      const offset = getOffset(gapCandidate);
      const next = new Date(gapShiftEpoch - offset);
      if (next.getTime() === gapCandidate.getTime()) break;
      gapCandidate = next;
    }
    return gapCandidate;
  }

  return candidate;
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
