// app/lib/mailer.ts
import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER!;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD!;
const MAIL_FROM = process.env.MAIL_FROM ?? GMAIL_USER;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

// Warn (don't crash) if missing critical envs
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.warn(
    "[mailer] missing GMAIL_USER/GMAIL_APP_PASSWORD; emails will fail to send"
  );
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

export async function sendMail(opts: {
  to: string | string[]; // <— supports multiple recipients
  cc?: string | string[]; // optional CC
  subject: string;
  text?: string;
  html?: string;
}) {
  const toList = Array.isArray(opts.to) ? opts.to : [opts.to];
  if (!toList.length) throw new Error("Missing recipient");

  return transporter.sendMail({
    from: MAIL_FROM,
    to: toList,
    cc: opts.cc,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

export function appLink(path: string) {
  if (!APP_URL) return path; // relative in dev if not set
  return `${APP_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
