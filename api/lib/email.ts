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
