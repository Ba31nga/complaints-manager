// app/lib/mailer.ts
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer"; // for attachment typing
import { config } from "@/app/lib/config";

const GMAIL_USER = config.GMAIL_USER;
const GMAIL_APP_PASSWORD = config.GMAIL_APP_PASSWORD;
const MAIL_FROM = config.MAIL_FROM ?? GMAIL_USER;
const APP_URL = config.NEXT_PUBLIC_APP_URL ?? "";

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
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Mail.Attachment[];
}) {
  const toList = Array.isArray(opts.to) ? opts.to : [opts.to];
  if (!toList.length) throw new Error("Missing recipient");

  return transporter.sendMail({
    from: { name: "Techni Service", address: MAIL_FROM },
    to: toList,
    cc: opts.cc,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments,
  });
}

export function appLink(path: string) {
  // Prefer explicit public URL, otherwise try common deployment envs.
  const envUrl =
    APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const cleanedPath = `/${path.replace(/^\/+/, "")}`;

  if (envUrl) {
    return `${String(envUrl).replace(/\/+$/, "")}${cleanedPath}`;
  }

   // No public base URL available.
   // In development, fall back to localhost for convenience.
   if (process.env.NODE_ENV !== "production") {
     return `http://localhost:3000${cleanedPath}`;
   }

   // In production, avoid incorrect hosts; return relative path and warn.
   console.warn(
     "[mailer] No base URL env provided (NEXT_PUBLIC_APP_URL / NEXTAUTH_URL / VERCEL_URL). Returning relative path."
   );
   return cleanedPath;
}
