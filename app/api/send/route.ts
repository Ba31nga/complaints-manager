// File: app/api/send/route.ts

import { NextResponse } from "next/server";
import type { SendMailOptions } from "nodemailer";
import { sendMail } from "@/app/lib/mailer";
import { z } from "zod";

/* ------------ Runtime ------------ */
// Ensure this route runs on Node.js (not Edge)
export const runtime = "nodejs";

/* ------------ Validation ------------ */
const AttachmentSchema = z.object({
  filename: z.string().min(1),
  // one (or none) of the following sources:
  base64: z.string().optional(), // raw base64 (no data: prefix)
  url: z.string().url().optional(), // fetch file from URL
  diskPath: z.string().optional(), // absolute/bundled path on server
  generate: z.boolean().optional(), // generate a sample PDF on server
  contentType: z.string().optional(), // defaults to application/pdf
});

const RequestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(), // optional!
});

type SendRequest = z.infer<typeof RequestSchema>;

// Uses centralized transport in app/lib/mailer to avoid duplication

/* ------------ Optional: generate simple PDF ------------ */
async function generateSamplePdf(): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText("Hello from Next.js + Gmail!", {
    x: 48,
    y: 780,
    size: 24,
    font,
    color: rgb(0, 0, 0),
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

/* ------------ Build attachments (typed, no 'any') ------------ */
type MailAttachments = NonNullable<SendMailOptions["attachments"]>;
type MailAttachment = MailAttachments[number];

async function buildAttachments(
  list?: SendRequest["attachments"]
): Promise<MailAttachments> {
  if (!list?.length) return [];

  const results: MailAttachments = [];

  for (const a of list) {
    const contentType = a.contentType ?? "application/pdf";

    if (a.generate) {
      const pdf = await generateSamplePdf();
      results.push({
        filename: a.filename,
        content: pdf,
        contentType,
      } as MailAttachment);
      continue;
    }

    if (a.base64) {
      results.push({
        filename: a.filename,
        content: Buffer.from(a.base64, "base64"),
        contentType,
      } as MailAttachment);
      continue;
    }

    if (a.url) {
      const res = await fetch(a.url);
      if (!res.ok) throw new Error(`Failed to fetch attachment URL: ${a.url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      results.push({
        filename: a.filename,
        content: buf,
        contentType,
      } as MailAttachment);
      continue;
    }

    if (a.diskPath) {
      results.push({
        filename: a.filename,
        path: a.diskPath,
        contentType,
      } as MailAttachment);
      continue;
    }

    throw new Error(`Attachment "${a.filename}" has no content source`);
  }

  return results;
}

/* ------------ Route ------------ */
export async function POST(req: Request) {
  try {
    const data = RequestSchema.parse(await req.json());

    const attachments = await buildAttachments(data.attachments);

    const info = await sendMail({
      to: data.to,
      subject: data.subject,
      text: data.text ?? undefined,
      html: data.html ?? undefined,
      // attach only if provided
      attachments: attachments.length ? attachments : undefined,
    });

    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mail] send error:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
