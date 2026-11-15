import { getServerEnv } from "@/lib/env";

export function formatAppUrl(path: string = "/dashboard"): string {
  try {
    const env = getServerEnv();
    return `${env.BETTER_AUTH_URL}${path}`;
  } catch {
    return `http://localhost:3000${path}`;
  }
}

export function upcomingDoseTemplate(params: {
  recipientName: string;
  careRecipientName: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  circleId: string;
}) {
  const dashboardUrl = formatAppUrl(`/dashboard?circle=${params.circleId}`);
  const subject = `Medication Reminder: ${params.careRecipientName} at ${params.scheduledTime}`;
  const text = `Hello ${params.recipientName},

This is a reminder from Care Circle for ${params.careRecipientName}.

Medication: ${params.medicationName} (${params.dosage})
Scheduled Time: ${params.scheduledTime}

Please visit your secure Care Circle dashboard to confirm when taken:
${dashboardUrl}

Care Circle — Accessible family and elderly care coordination.`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
    <h2 style="color: #166534; margin-top: 0; font-size: 20px;">Medication Reminder</h2>
    <p style="font-size: 16px; margin-bottom: 8px;"><strong>Care Recipient:</strong> ${params.careRecipientName}</p>
    <p style="font-size: 16px; margin-bottom: 8px;"><strong>Medication:</strong> ${params.medicationName} (${params.dosage})</p>
    <p style="font-size: 16px; margin-bottom: 0;"><strong>Scheduled Time:</strong> ${params.scheduledTime}</p>
  </div>
  <p style="margin-bottom: 24px;">
    <a href="${dashboardUrl}" style="background-color: #15803d; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px; display: inline-block; font-weight: 500;">
      Open Care Circle
    </a>
  </p>
  <p style="font-size: 13px; color: #64748b; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
    You are receiving this because you opted into care notifications for ${params.careRecipientName}.
  </p>
</body>
</html>`;

  return { subject, text, html };
}

export function missedDoseAlertTemplate(params: {
  recipientName: string;
  careRecipientName: string;
  medicationName: string;
  scheduledTime: string;
  circleId: string;
}) {
  const dashboardUrl = formatAppUrl(`/dashboard?circle=${params.circleId}`);
  const subject = `Notice: Unconfirmed dose for ${params.careRecipientName} (${params.scheduledTime})`;
  const text = `Hello ${params.recipientName},

A scheduled dose for ${params.careRecipientName} has passed its grace period without confirmation:

Medication: ${params.medicationName}
Scheduled Time: ${params.scheduledTime}

If you are following up with ${params.careRecipientName}, please select "I'll handle this" on the dashboard so others know:
${dashboardUrl}

Care Circle — Accessible family and elderly care coordination.`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
    <h2 style="color: #9a3412; margin-top: 0; font-size: 20px;">Unconfirmed Dose Alert</h2>
    <p style="font-size: 16px; margin-bottom: 8px;"><strong>Care Recipient:</strong> ${params.careRecipientName}</p>
    <p style="font-size: 16px; margin-bottom: 8px;"><strong>Medication:</strong> ${params.medicationName}</p>
    <p style="font-size: 16px; margin-bottom: 0;"><strong>Scheduled Time:</strong> ${params.scheduledTime}</p>
  </div>
  <p style="font-size: 15px; color: #334155;">
    If you are following up with ${params.careRecipientName}, please select <em>"I'll handle this"</em> on the dashboard so the circle knows who is assisting.
  </p>
  <p style="margin-bottom: 24px;">
    <a href="${dashboardUrl}" style="background-color: #c2410c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px; display: inline-block; font-weight: 500;">
      View Alert & Follow Up
    </a>
  </p>
  <p style="font-size: 13px; color: #64748b; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
    Care Circle respects privacy: no private medical records or passcode links are transmitted via email.
  </p>
</body>
</html>`;

  return { subject, text, html };
}

export function appointmentReminderTemplate(params: {
  recipientName: string;
  careRecipientName: string;
  title: string;
  provider: string;
  location: string;
  dateStr: string;
  timeStr: string;
  circleId: string;
}) {
  const dashboardUrl = formatAppUrl(`/dashboard?circle=${params.circleId}`);
  const subject = `Upcoming Appointment: ${params.careRecipientName} - ${params.title}`;
  const text = `Hello ${params.recipientName},

This is an appointment reminder for ${params.careRecipientName}:

Appointment: ${params.title}
Provider: ${params.provider}
Location: ${params.location}
Date & Time: ${params.dateStr} at ${params.timeStr}

View full details in your Care Circle:
${dashboardUrl}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
    <h2 style="color: #1e40af; margin-top: 0; font-size: 20px;">Upcoming Appointment</h2>
    <p style="font-size: 16px; margin-bottom: 8px;"><strong>Care Recipient:</strong> ${params.careRecipientName}</p>
    <p style="font-size: 16px; margin-bottom: 8px;"><strong>Appointment:</strong> ${params.title}</p>
    <p style="font-size: 16px; margin-bottom: 8px;"><strong>Provider:</strong> ${params.provider}</p>
    <p style="font-size: 16px; margin-bottom: 8px;"><strong>Location:</strong> ${params.location}</p>
    <p style="font-size: 16px; margin-bottom: 0;"><strong>Date & Time:</strong> ${params.dateStr} at ${params.timeStr}</p>
  </div>
  <p style="margin-bottom: 24px;">
    <a href="${dashboardUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px; display: inline-block; font-weight: 500;">
      View Appointment in Circle
    </a>
  </p>
</body>
</html>`;

  return { subject, text, html };
}
