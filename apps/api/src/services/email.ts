import nodemailer from 'nodemailer'
import { getDb } from '../db/database'

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  })
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
}) {
  const cc = getCcEmail()
  const profileUrl = `${opts.webUrl}/register/${opts.ticketId}`

  const html = `
    <p>Hi ${opts.toName},</p>
    <p>Your vaccine certificate and dog photo have been received for <strong>${opts.eventName}</strong>.</p>
    <p>Ticket ID: <strong>${opts.ticketId}</strong></p>
    <p>You can view your profile at: <a href="${profileUrl}">${profileUrl}</a></p>
    <p>See you at the race!</p>
  `

  await getTransport().sendMail({
    from: process.env.EMAIL_FROM ?? 'noreply@dogreg.local',
    to: opts.toEmail,
    cc: cc || undefined,
    subject: `[${opts.eventName}] Submission confirmed — Ticket ${opts.ticketId}`,
    html,
  })
}
