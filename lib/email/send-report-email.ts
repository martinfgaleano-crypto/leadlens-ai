interface SendReportReadyEmailInput {
  to: string;
  jobId: string;
  productLabel?: string;   // e.g. "Portfolio", "Premium" — product type only, never research content
  appUrl?: string;
}

interface SendResult {
  sent: boolean;
  provider?: string;
  error?: string;
}

/**
 * Report-ready transactional email (current Account Opportunity Intelligence product).
 * CONTENT-SAFE by design: it carries ONLY the LeadLens identity, the product type, a safe link to the
 * report, and a support contact — never company names, decisions, evidence, scores or any research
 * content (that lives behind the authenticated /results page). Non-blocking; no-ops silently when
 * RESEND_API_KEY is not configured. Idempotency is the CALLER's responsibility (send exactly once per
 * durable completion).
 */
export async function sendReportReadyEmail(input: SendReportReadyEmailInput): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, provider: "resend", error: "RESEND_API_KEY not configured" };
  }
  if (!input.to || !/.+@.+\..+/.test(input.to)) {
    return { sent: false, provider: "resend", error: "invalid recipient" };
  }

  const fromEmail = process.env.FROM_EMAIL ?? "reports@leadlens.ai";
  const supportEmail = process.env.SUPPORT_EMAIL ?? "support@leadlens.ai";
  const appUrl = (input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/=$/, "");
  const product = input.productLabel ? `${input.productLabel} report` : "intelligence report";
  const html = buildReadyHtml({ appUrl, jobId: input.jobId, product, supportEmail });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [input.to],
        subject: `Your LeadLens ${product} is ready`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { sent: false, provider: "resend", error: `Resend API error ${res.status}: ${body}` };
    }
    return { sent: true, provider: "resend" };
  } catch (err) {
    return { sent: false, provider: "resend", error: err instanceof Error ? err.message : String(err) };
  }
}

function buildReadyHtml(opts: { appUrl: string; jobId: string; product: string; supportEmail: string }) {
  const { appUrl, jobId, product, supportEmail } = opts;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#0c4a6e,#0284c7);padding:28px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;letter-spacing:-.02em;">Lead<span style="color:#7dd3fc">Lens</span></h1>
      <p style="color:#bae6fd;margin:6px 0 0;font-size:14px;">Your ${product} is ready</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Your LeadLens ${product} has finished and is ready to review in your workspace. Open it any time —
        it is saved to your account, so you don't need to keep a browser tab open.
      </p>
      <a href="${appUrl}/results/${encodeURIComponent(jobId)}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;">
        Open my report →
      </a>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #f1f5f9;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        LeadLens — Commercial Intelligence. Need help? Contact
        <a href="mailto:${supportEmail}" style="color:#0284c7;">${supportEmail}</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
}
