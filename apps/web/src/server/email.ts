import { appUrl } from "@/lib/utils";
import { BRAND, MAIL_FOOTER } from "@/lib/company";

export type Mail = { to: string; subject: string; text: string };

/**
 * Provider-agnostic mail sender. EMAIL_PROVIDER=resend uses Resend's REST API (no SDK needed);
 * anything else logs the message (development). Add other providers by extending this switch.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER;
  if (provider === "resend") {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY missing");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? `${BRAND.name} <no-reply@example.com>`,
        to: mail.to,
        subject: mail.subject,
        text: mail.text + MAIL_FOOTER,
      }),
    });
    if (!res.ok) throw new Error(`Email send failed: ${res.status}`);
    return;
  }
  console.info(`[mail:dev] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
}

export const verifyUrl = (token: string) => `${appUrl()}/verify-email?token=${token}`;
export const resetUrl = (token: string) => `${appUrl()}/reset-password?token=${token}`;
