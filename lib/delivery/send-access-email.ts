// Customer delivery email. Server-side only.
// Sends the lead download link via Resend when a search is delivery-ready.
// Never throws — caller wraps in try/catch or ignores the promise entirely.
// Requires RESEND_API_KEY env var; silently skips if not set.

export interface DeliveryEmailInput {
  toEmail:          string;
  toName:           string | null;
  searchName:       string;
  signedUrl:        string;
  /** Preferred. Falls back to leadCount if omitted (back-compat). */
  opportunityCount?: number;
  /** @deprecated Use opportunityCount. */
  leadCount?:        number;
  expiresInDays?:   number;
}

export async function sendDeliveryAccessEmail(
  input: DeliveryEmailInput,
): Promise<{ sent: boolean; error?: string }> {

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[delivery-email] RESEND_API_KEY not set — skipping email");
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }

  const fromEmail       = process.env.RESEND_FROM_EMAIL ?? "LeadLens <leads@leadlens.ai>";
  const expiryDays      = input.expiresInDays ?? 7;
  const greeting        = input.toName ? `Hi ${input.toName.split(" ")[0]},` : "Hi,";
  const opportunityCount = input.opportunityCount ?? input.leadCount ?? 0;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #0f172a;">
  <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700;">Your Opportunity Snapshot is ready</h2>
  <p style="color: #64748b; margin: 0 0 24px; font-size: 15px;">${greeting}</p>
  <p style="font-size: 15px; margin: 0 0 8px;">
    Your LeadLens order is complete. We've identified <strong>${opportunityCount} priority accounts</strong>
    for "<em>${input.searchName}</em>" — ranked by public buying signals and account fit.
  </p>
  <p style="font-size: 14px; color: #64748b; margin: 0 0 28px;">
    Each account includes company context, opportunity score, confidence score,
    buying signal evidence, priority tier (HOT / WARM / COLD), and risk notes.
  </p>
  <a href="${input.signedUrl}"
     style="display: inline-block; background: #0f172a; color: #fff; text-decoration: none;
            font-weight: 600; font-size: 15px; padding: 13px 28px; border-radius: 8px; margin-bottom: 20px;">
    Download Opportunity Snapshot CSV →
  </a>
  <p style="font-size: 13px; color: #94a3b8; margin: 20px 0 0;">
    This link expires in ${expiryDays} days. Reply to this email if you have any questions.
  </p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;">
  <p style="font-size: 12px; color: #cbd5e1; margin: 0;">LeadLens AI · Opportunity Snapshot</p>
</body>
</html>`.trim();

  const text = `
${greeting}

Your LeadLens Opportunity Snapshot is ready — ${opportunityCount} priority accounts for "${input.searchName}", ranked by public buying signals.

Download your CSV here:
${input.signedUrl}

This link expires in ${expiryDays} days.

— LeadLens AI
`.trim();

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from:    fromEmail,
      to:      input.toEmail,
      subject: `Your Opportunity Snapshot is ready — ${input.searchName}`,
      html,
      text,
    });

    if (error) {
      console.error("[delivery-email] Resend error:", error);
      return { sent: false, error: typeof error === "object" ? JSON.stringify(error) : String(error) };
    }

    console.log(`[delivery-email] sent to ${input.toEmail} (${opportunityCount} accounts)`);
    return { sent: true };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[delivery-email] exception:", msg);
    return { sent: false, error: msg };
  }
}
