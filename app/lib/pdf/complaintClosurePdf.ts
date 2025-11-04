/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
// pdfkit's ESM build (pdfkit.es.js) pulls in fontkit/module.mjs which
// currently breaks under Next.js 16 Turbopack. Force the CommonJS build
// explicitly by dynamically importing the CJS entry.
// This also guarantees server-only usage.
type PDFDocumentCtor = new (...args: any[]) => any;
import type { Complaint } from "@/app/lib/types";

type BuildOpts = {
  complaint: Complaint;
  departmentName: string;
  principalName: string;
  principalRole: string;
  logoPath: string;
  signatureImagePath?: string;
};

type PdfDocLike = {
  text: (...args: any[]) => any;
  image: (...args: any[]) => any;
  moveTo: (...args: any[]) => any;
  lineTo: (...args: any[]) => any;
  strokeColor: (...args: any[]) => any;
  lineWidth: (...args: any[]) => any;
  stroke: (...args: any[]) => any;
  fillColor: (...args: any[]) => any;
  font: (...args: any[]) => any;
  fontSize: (...args: any[]) => any;
  roundedRect: (...args: any[]) => any;
  page: any;
  moveDown: (...args: any[]) => any;
  registerFont: (...args: any[]) => any;
  end: () => any;
  on: (...args: any[]) => any;
};

function tryStat(p?: string) {
  try {
    if (!p) return false;
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function safeHeb(s: unknown): string {
  return String(s ?? "");
}

function rtl(
  doc: PdfDocLike,
  text: string,
  x: number,
  y: number,
  opts: Record<string, unknown> = {}
) {
  doc.text(text, x, y, { align: "right", ...opts });
}

export async function buildComplaintClosurePdf(
  opts: BuildOpts
): Promise<{ buffer: Buffer; filename: string }> {
  // Dynamically import the CJS build to avoid ESM fontkit issues in Turbopack
  const PDFDocumentMaybe: PDFDocumentCtor | { default: PDFDocumentCtor } =
    (await import("pdfkit/js/pdfkit.js")) as unknown as
      | PDFDocumentCtor
      | { default: PDFDocumentCtor };
  const PdfKit: PDFDocumentCtor =
    (PDFDocumentMaybe as { default?: PDFDocumentCtor })?.default ||
    (PDFDocumentMaybe as PDFDocumentCtor);
  const { complaint, departmentName, principalName, principalRole, logoPath } =
    opts;
  const id = complaint.id;
  const justified = !!complaint.principalReview?.justified;
  const summary = safeHeb(complaint.principalReview?.summary || "");
  const signedAtISO =
    complaint.principalReview?.signedAt || new Date().toISOString();
  const signedAtStr = new Date(signedAtISO).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const doc = new PdfKit({
    size: "A4",
    margins: { top: 54, bottom: 54, left: 54, right: 54 },
  });

  // Buffer aggregation
  const chunks: Buffer[] = [];
  const bufPromise = new Promise<Buffer>((resolve) => {
    doc.on("data", (d: Buffer) => chunks.push(d));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Fonts: try Assistant Hebrew font if present; fallback to Helvetica
  const assistantPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "Assistant-Regular.ttf"
  );
  const assistantBoldPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "Assistant-Bold.ttf"
  );
  const hasAssistant = tryStat(assistantPath);
  const hasAssistantBold = tryStat(assistantBoldPath);
  if (hasAssistant) doc.registerFont("hebrew", assistantPath);
  if (hasAssistantBold) doc.registerFont("hebrew-bold", assistantBoldPath);
  const baseFont = hasAssistant ? "hebrew" : "Helvetica";
  const boldFont = hasAssistantBold
    ? "hebrew-bold"
    : hasAssistant
    ? "hebrew"
    : "Helvetica-Bold";
  doc.font(baseFont);

  // Header: logo top-right and title
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left as number; // symmetric margins
  const contentWidth = pageWidth - margin - (doc.page.margins.right as number);
  const right = pageWidth - margin;

  if (tryStat(logoPath)) {
    try {
      const imgW = 90;
      doc.image(logoPath, right - imgW, margin - 10, {
        width: imgW,
        align: "right",
      });
    } catch {}
  }

  doc.fillColor("#111827").font(boldFont).fontSize(20);
  rtl(doc, "סיכום סגירת פנייה", right, 90);

  // Decision badge
  const badgeText = justified ? "מוצדקת" : "לא מוצדקת";
  const badgeColor = justified ? "#10B981" : "#EF4444";
  const badgeTextColor = "#ffffff";
  const badgeWidth = 90;
  const badgeHeight = 22;
  const badgeX = right - badgeWidth;
  const badgeY = 110;
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 6).fill(badgeColor);
  doc.fillColor(badgeTextColor).font(boldFont).fontSize(12);
  rtl(doc, badgeText, right - 10, badgeY + 6);

  // Separator
  doc
    .moveTo(margin, 145)
    .lineTo(right, 145)
    .strokeColor("#e5e7eb")
    .lineWidth(1)
    .stroke();

  // Sections
  const section = (title: string) => {
    doc.moveDown(1.0);
    doc.fillColor("#111827").font(boldFont).fontSize(14);
    rtl(doc, title, right, doc.y);
    doc.moveDown(0.3);
    doc
      .moveTo(margin, doc.y)
      .lineTo(right, doc.y)
      .strokeColor("#f1f5f9")
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.4);
    doc.font(baseFont).fontSize(12).fillColor("#1f2937");
  };

  // Metadata
  section("פרטי פנייה");
  const createdStr = new Date(complaint.createdAt).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const metaLines = [
    `מזהה: ${complaint.id}`,
    `כותרת: ${safeHeb(complaint.title)}`,
    `מחלקה: ${safeHeb(departmentName || "—")}`,
    `נפתח בתאריך: ${createdStr}`,
  ];
  for (const line of metaLines)
    rtl(doc, line, right, doc.y, { width: contentWidth });

  // Reporter
  section("פרטי מדווח/ת");
  const rp = complaint.reporter;
  const rpLines = [
    `שם: ${safeHeb(rp.fullName || "—")}`,
    rp.email ? `אימייל: ${rp.email}` : "",
    rp.phone ? `טלפון: ${rp.phone}` : "",
  ].filter(Boolean);
  for (const line of rpLines)
    rtl(doc, line, right, doc.y, { width: contentWidth });

  // Decision
  section("החלטה");
  rtl(
    doc,
    justified ? "הפנייה הוכרה כמוצדקת" : "הפנייה לא הוכרה כמוצדקת",
    right,
    doc.y,
    { width: contentWidth }
  );

  // Summary
  section("סיכום מנהל/ת");
  const summaryText = summary || "—";
  doc.text(summaryText, margin, doc.y, { width: contentWidth, align: "right" });

  // Signature
  section("חתימה");
  const sigImg =
    opts.signatureImagePath && tryStat(opts.signatureImagePath)
      ? opts.signatureImagePath
      : undefined;
  if (sigImg) {
    try {
      const w = 140;
      const x = right - w;
      doc.image(sigImg, x, doc.y, { width: w });
      doc.moveDown(0.5);
    } catch {}
  }
  rtl(doc, principalName, right, doc.y);
  rtl(doc, principalRole, right, doc.y);
  rtl(doc, `נחתם בתאריך: ${signedAtStr}`, right, doc.y);

  doc.end();
  const buffer = await bufPromise;
  const filename = `Complaint-${id}-Closure.pdf`;
  return { buffer, filename };
}
