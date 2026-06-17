import type { LeadLensReport } from "@/types";

interface SendReportEmailInput {
  to: string;
  report: LeadLensReport;
  jobId: string;
}

interface SendResult {
  sent: boolean;
  provider?: string;
  error?: string;
}

/**
 * Sends the report summary to the customer via Resend.
 * Non-blocking — caller should not await in the critical path.
 * No-ops silently when RESEND_API_KEY is not configured.
 */
export async function sendReportEmail(input: SendReportEmailInput): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, provider: "resend", error: "RESEND_API_KEY not configured" };
  }

  const fromEmail = process.env.FROM_EMAIL ?? "reports@leadlens.ai";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/=$/, "");

  const hotLeads = input.report.processed_leads.filter(l => l.qualification.category === "HOT");
  const warmLeads = input.report.processed_leads.filter(l => l.qualification.category === "WARM");

  const html = buildEmailHtml({
    report: input.report,
    jobId: input.jobId,
    appUrl,
    hotCount: hotLeads.length,
    warmCount: warmLeads.length,
    topLeads: hotLeads.slice(0, 3),
  });

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
        subject: `Your LeadLens report is ready — ${input.report.hot_count} HOT leads found`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { sent: false, provider: "resend", error: `Resend API error ${res.status}: ${body}` };
    }

    return { sent: true, provider: "resend" };
  } catch (err) {
    return {
      sent: false,
      provider: "resend",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function buildEmailHtml(opts: {
  report: LeadLensReport;
  jobId: string;
  appUrl: string;
  hotCount: number;
  warmCount: number;
  topLeads: typeof opts.report.processed_leads;
}) {
  const { report, appUrl, hotCount, warmCount, topLeads } = opts;

  const leadRows = topLeads.map(l => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${l.candidate.name ?? "Unknown"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${l.candidate.title ?? "?"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${l.candidate.company}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-weight:700;color:#991b1b;">${l.qualification.fit_score}/10</td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#0c4a6e,#0284c7);padding:28px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;letter-spacing:-.02em;">Lead<span style="color:#7dd3fc">Lens</span> AI</h1>
      <p style="color:#bae6fd;margin:6px 0 0;font-size:14px;">Your report is ready</p>
    </div>
    <div style="padding:28px 32px;">
      <h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 16px;">
        ${report.total_leads} leads processed — ${hotCount} HOT, ${warmCount} WARM
      </h2>
      <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 20px;">${report.executive_summary}</p>

      ${topLeads.length > 0 ? `
      <h3 style="font-size:14px;font-weight:700;color:#334155;margin:0 0 12px;text-transform:uppercase;letter-spacing:.06em;">Top HOT leads</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#64748b;border-bottom:2px solid #e2e8f0;">Name</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#64748b;border-bottom:2px solid #e2e8f0;">Title</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#64748b;border-bottom:2px solid #e2e8f0;">Company</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;color:#64748b;border-bottom:2px solid #e2e8f0;">Score</th>
          </tr>
        </thead>
        <tbody>${leadRows}</tbody>
      </table>
      ` : ""}

      <p style="color:#64748b;font-size:13px;margin:0 0 20px;">
        Your full report (CSV + Markdown) is attached or available to download below. Review and send outreach manually — no automated sending.
      </p>

      <a href="${appUrl}/results/${report.job_id}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;">
        View full report →
      </a>
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #f1f5f9;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        LeadLens AI — Human-reviewed outreach. No automated sending.
        This report was generated on ${new Date(report.created_at).toLocaleDateString()}.
      </p>
    </div>
  </div>
</body>
</html>`;
}
