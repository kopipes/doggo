import { Resend } from 'resend'
import { getDb } from '../db/database'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

function getCcEmail(): string {
  const db = getDb()
  const row = db
    .prepare("SELECT value FROM system_settings WHERE key = 'confirmation_cc_email'")
    .get() as { value: string } | undefined
  return row?.value ?? ''
}

export async function sendSubmissionConfirmation(opts: {
  toEmail: string
  toName: string
  ticketId: string
  eventName: string
  webUrl: string
  phone?: string
  ticketName?: string
  shirtSize?: string
  collarSize?: string
  certCount: number
  hasDogPhoto: boolean
}) {
  const cc = getCcEmail()
  const profileUrl = `${opts.webUrl}/register/${opts.ticketId}`

  const rows: { label: string; value: string }[] = [
    { label: 'Ticket ID', value: opts.ticketId },
    { label: 'Name', value: opts.toName },
    ...(opts.ticketName ? [{ label: 'Ticket Name', value: opts.ticketName }] : []),
    ...(opts.phone ? [{ label: 'Phone', value: opts.phone }] : []),
    ...(opts.shirtSize ? [{ label: 'Shirt Size', value: opts.shirtSize }] : []),
    ...(opts.collarSize ? [{ label: 'Collar Size', value: opts.collarSize }] : []),
    { label: 'Certificates Uploaded', value: `${opts.certCount} file${opts.certCount !== 1 ? 's' : ''}` },
    { label: 'Dog Photo', value: opts.hasDogPhoto ? 'Uploaded' : 'Not uploaded' },
  ]

  const tableRows = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 12px;font-weight:600;color:#555;white-space:nowrap;border-bottom:1px solid #eee;">${r.label}</td>
        <td style="padding:8px 12px;color:#222;border-bottom:1px solid #eee;">${r.value}</td>
      </tr>`,
    )
    .join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1a1a2e;padding:28px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${opts.eventName}</h1>
            <p style="margin:4px 0 0;color:#aaa;font-size:14px;">Registration Submission Confirmed</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:16px;color:#222;">Hi <strong>${opts.toName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
              Your submission for <strong>${opts.eventName}</strong> has been received. Our team will review your documents and update your status shortly.
            </p>

            <!-- Details table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;overflow:hidden;margin-bottom:24px;">
              ${tableRows}
            </table>

            <!-- CTA -->
            <p style="margin:0 0 16px;font-size:14px;color:#555;">You can view your registration status anytime at:</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1a1a2e;border-radius:6px;padding:12px 24px;">
                  <a href="${profileUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">View My Registration</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#999;text-align:center;">
              ${opts.eventName} &mdash; This is an automated confirmation. Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  const to = [opts.toEmail]
  const bcc = ['provaliantrun@gmail.com']
  if (cc) bcc.push(cc)

  await getResend().emails.send({
    from: process.env.EMAIL_FROM ?? 'no-reply@provaliantgroup.com',
    to,
    bcc,
    subject: `[${opts.eventName}] Submission confirmed — Ticket ${opts.ticketId}`,
    html,
  })
}
