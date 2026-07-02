// HTML-escapes untrusted strings before they're interpolated into an email
// body — reason/displayName/email are user-controlled input.
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const APP_URL = (process.env.APP_URL || 'https://cedarguard.co.uk').replace(/\/+$/, '');
const LOGO_URL = `${APP_URL}/logo.png`;

// Wraps body content in a professional, email-client-safe layout: table-based
// (no flexbox/grid), inline styles (clients strip <style>/classes), a 600px
// centred white card, an optional CTA button, and the CedarGuard logo in the
// footer. `heading` and `bodyHtml` are trusted markup built by callers; any
// user-supplied text inside them must already be escapeHtml()'d.
export function renderEmail(opts: {
  previewText: string;
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
}): string {
  const ctaHtml = opts.cta
    ? `<div style="margin:28px 0 4px;">
         <a href="${opts.cta.url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 26px;border-radius:8px;">${escapeHtml(opts.cta.label)}</a>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f5f7;">${escapeHtml(opts.previewText)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
          <tr>
            <td style="padding:36px 40px 8px;">
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#0f172a;">${escapeHtml(opts.heading)}</h1>
              <div style="font-size:14px;line-height:1.65;color:#334155;">${opts.bodyHtml}</div>
              ${ctaHtml}
              <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#334155;">Kind regards,<br /><strong>The CedarGuard Team</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 32px;">
              <div style="border-top:1px solid #e5e7eb;padding-top:24px;text-align:center;">
                <img src="${LOGO_URL}" alt="CedarGuard — Social Housing Governance" width="180" style="width:180px;max-width:60%;height:auto;display:block;margin:0 auto;" />
                <p style="margin:12px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;">This is an automated message from CedarGuard. Please do not reply to this email.</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Single swappable email module. Gated on RESEND_API_KEY/EMAIL_FROM — if
// either is unset, logs and skips (the feature works without email
// configured). Calls Resend's REST API directly via fetch; no npm dependency.
export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.log(`[email] RESEND_API_KEY/EMAIL_FROM not configured — skipping email to ${opts.to}: "${opts.subject}"`);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      // Best-effort: e.g. an unverified sending domain restricts delivery to
      // the account owner's own email. Never hard-fail the caller's flow
      // over an email delivery problem.
      const body = await res.text().catch(() => '');
      console.error(`[email] Resend send failed (${res.status}) to ${opts.to}: ${body}`);
    }
  } catch (e: any) {
    console.error('[email] Resend request threw (non-fatal):', e?.message || e);
  }
}
