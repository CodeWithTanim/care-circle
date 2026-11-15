import "server-only";

export interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey?: string;
}

export interface EmailDeliveryResult {
  messageId: string;
  success: boolean;
  provider: string;
  isTestTransport: boolean;
}

export interface EmailProvider {
  name: string;
  isTestTransport: boolean;
  sendEmail(params: SendEmailParams): Promise<EmailDeliveryResult>;
}

export interface RecordedEmail extends SendEmailParams {
  id: string;
  sentAt: Date;
  status: "delivered_to_test_inbox";
}

// In-memory test transport that stores sent emails for testing and local verification
class MemoryTestEmailTransport implements EmailProvider {
  name = "MemoryTestEmailTransport";
  isTestTransport = true;
  private sentMails: RecordedEmail[] = [];

  async sendEmail(params: SendEmailParams): Promise<EmailDeliveryResult> {
    const id = `test-msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.sentMails.push({
      ...params,
      id,
      sentAt: new Date(),
      status: "delivered_to_test_inbox",
    });
    return {
      messageId: id,
      success: true,
      provider:
        "MemoryTestEmailTransport (TEST TRANSPORT - NO EXTERNAL DELIVERY)",
      isTestTransport: true,
    };
  }

  getSentEmails(): RecordedEmail[] {
    return [...this.sentMails];
  }

  clear(): void {
    this.sentMails = [];
  }
}

class ResendEmailProvider implements EmailProvider {
  name = "Resend";
  isTestTransport = false;
  private apiKey: string;
  private from: string;

  constructor(apiKey: string, from?: string) {
    this.apiKey = apiKey;
    this.from = from ?? "Care Circle <notifications@resend.dev>";
  }

  async sendEmail(params: SendEmailParams): Promise<EmailDeliveryResult> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(params.idempotencyKey
          ? { "Idempotency-Key": params.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from: this.from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Resend email delivery failed (${res.status}): ${errText}`,
      );
    }

    const data = (await res.json()) as { id: string };
    return {
      messageId: data.id,
      success: true,
      provider: "Resend",
      isTestTransport: false,
    };
  }
}

export const testEmailTransport = new MemoryTestEmailTransport();

let activeProvider: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (activeProvider) return activeProvider;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    activeProvider = new ResendEmailProvider(
      resendApiKey,
      process.env.EMAIL_FROM,
    );
    return activeProvider;
  }

  // Default to safe test transport
  activeProvider = testEmailTransport;
  return activeProvider;
}

/**
 * Reset provider (useful for testing)
 */
export function setCustomEmailProvider(provider?: EmailProvider) {
  activeProvider = provider;
}
