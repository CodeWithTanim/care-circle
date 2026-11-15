import type { Appointment } from "@/lib/models";

/**
 * Format date to Google Calendar UTC string: YYYYMMDDTHHMMSSZ
 */
function formatUtcForCalendar(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * Format provider name to avoid duplicate "Dr. Dr." prefixes.
 */
function formatProviderTitle(provider: string): string {
  const trimmed = provider.trim();
  if (/^dr\.?\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Dr. ${trimmed}`;
}

/**
 * Generate 1-click Google Calendar Event Template URL.
 */
export function getGoogleCalendarUrl(
  appointment: Appointment,
  circleName: string,
  recipientName: string,
): string {
  const start = new Date(appointment.scheduledTimestamp);
  // Default to 1-hour appointment window if end time is unspecified
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const providerLabel = formatProviderTitle(appointment.provider);
  const title = `${appointment.title} - ${providerLabel}`;
  const details = [
    `Care Circle Medical Appointment`,
    `Patient: ${recipientName}`,
    `Care Circle: ${circleName}`,
    `Healthcare Provider: ${providerLabel}`,
    appointment.notes ? `Clinical Notes: ${appointment.notes}` : "",
    `Coordinated with Care Circle.`,
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatUtcForCalendar(start)}/${formatUtcForCalendar(end)}`,
    details,
    location: appointment.location || "Clinic / Medical Center",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate 1-click Google Maps Navigation URL.
 */
export function getGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    location.trim(),
  )}`;
}

/**
 * Generate RFC 5545 compliant iCalendar (.ics) content.
 */
export function generateIcsContent(
  appointment: Appointment,
  circleName: string,
  recipientName: string,
): string {
  const start = new Date(appointment.scheduledTimestamp);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const now = new Date();
  const providerLabel = formatProviderTitle(appointment.provider);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Care Circle//Elder Care Platform//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:appt-${appointment._id}@carecircle.app`,
    `DTSTAMP:${formatUtcForCalendar(now)}`,
    `DTSTART:${formatUtcForCalendar(start)}`,
    `DTEND:${formatUtcForCalendar(end)}`,
    `SUMMARY:${appointment.title} - ${providerLabel}`,
    `DESCRIPTION:Care Circle appointment for ${recipientName} (${circleName}). Provider: ${providerLabel}.${
      appointment.notes ? " Notes: " + appointment.notes : ""
    }`,
    `LOCATION:${appointment.location || "Clinic"}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

/**
 * Trigger client-side download of the appointment's .ics file.
 */
export function downloadIcsFile(
  appointment: Appointment,
  circleName: string,
  recipientName: string,
): void {
  if (typeof window === "undefined") return;

  const content = generateIcsContent(appointment, circleName, recipientName);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${appointment.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
