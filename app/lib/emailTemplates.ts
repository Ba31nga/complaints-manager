// app/lib/emailTemplates.ts
import path from "node:path";

/** if you use cid mode, attachments must use this cid. */
export const LOGO_CID = "appLogoCID";

/** escape text for safe html interpolation */
export const esc = (s?: string): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });

/** render simple paragraphs (each line becomes a <p>) */
export function renderParagraphsHtml(lines: string[] = []): string {
  const safe = Array.isArray(lines) ? lines : [];
  return safe
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 12px;line-height:1.7;font-size:14px">${esc(
          p as string
        )}</p>`
    )
    .join("");
}

/** build an absolute url for a public asset in /public (email safe) */
export function publicAssetUrl(pathname: string, base?: string): string {
  const baseFromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const baseUrl = (base || baseFromEnv || "").replace(/\/+$/, "");
  if (baseUrl)
    return `${baseUrl}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
  // fallback to root-relative; most clients resolve it when the message is viewed in a web client
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

/** convenience for cid-based logo attachment used by email templates */
export function logoCidAttachment() {
  return {
    filename: "emailLogo.png",
    path: path.join(process.cwd(), "public", "emailLogo.png"),
    cid: LOGO_CID,
  } as const;
}

export type DetailRow = { label: string; value: string };

/** renders the details panel (label/value lines) inside the card */
export function renderDetailsPanel(rows: DetailRow[] = []): string {
  if (!rows.length) return "";
  const lines = rows
    .map(
      ({ label, value }) => `
        <tr>
          <td class="meta" align="right" style="padding:6px 0;">
            <strong>${esc(label)}:</strong> ${esc(value)}
          </td>
        </tr>`
    )
    .join("");
  return `
<table role="presentation" width="100%" style="margin:0 0 18px 0; border:1px solid #e7eaee; border-radius:10px;">
  <tr>
    <td style="padding:14px 16px;">
      <table role="presentation" width="100%">${lines}</table>
    </td>
  </tr>
</table>`.trim();
}

/** compact two-column table (good for embedding anywhere) */
export function renderTicketMiniTable(c: {
  id: string;
  title: string;
  status: string;
  /** department name only */
  departmentName?: string;
}): string {
  const cell = (label: string, value: string) =>
    `
    <tr>
      <td style="padding:6px 10px;background:#f9fafb;border:1px solid #e5e7eb">${esc(
        label
      )}</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb">${esc(value)}</td>
    </tr>`.trim();

  return `
<table style="border-collapse:collapse;border:1px solid #e5e7eb;width:100%;">
  <tbody>
    ${cell("כותרת", c.title)}
    ${cell("מזהה", c.id)}
    ${cell("מחלקה", c.departmentName || "—")}
    ${cell("סטטוס", c.status)}
  </tbody>
</table>`.trim();
}

/**
 * generic email shell: same design, custom content.
 * default logo mode uses inline CID (attach /public/emailLogo.png with cid: LOGO_CID).
 * if you prefer a hosted public image, pass logoMode: "public".
 */
export function renderEmailShell({
  preheader = 'התראה חדשה ממערכת "פניות לקוח".',
  badgeText = "עדכון",
  headline = "התראה חדשה",
  details = [],
  bodyHtml = "",
  button,
  footerNote = 'מייל זה נשלח אוטומטית ממערכת "פניות לקוח".',
  logoMode = "cid", // default inline image
  appBaseUrl, // used only if logoMode === "public"
}: {
  preheader?: string;
  badgeText?: string;
  headline?: string;
  details?: DetailRow[];
  bodyHtml?: string;
  button?: { href: string; label: string };
  footerNote?: string;
  logoMode?: "public" | "cid";
  appBaseUrl?: string;
}): string {
  const detailsPanel = renderDetailsPanel(details);
  const buttonBlock = button
    ? `
<table role="presentation" align="center" style="margin:10px auto;">
  <tr>
    <td class="btn" bgcolor="#155eef" align="center">
      <a href="${esc(button.href)}" aria-label="${esc(button.label)}">${esc(
        button.label
      )}</a>
    </td>
  </tr>
</table>`.trim()
    : "";

  const logoSrc =
    logoMode === "cid"
      ? `cid:${LOGO_CID}`
      : publicAssetUrl("/emailLogo.png", appBaseUrl);

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(headline)}</title>
  <style>
    body { margin:0; padding:0; background:#f3f5f7; }
    table { border-collapse:collapse; border-spacing:0; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; outline:none; text-decoration:none; max-width:100%; }
    a { text-decoration:none; color:#0b57d0; }
    .container { max-width:760px; }
    .card { background:#ffffff; border:1px solid #e7eaee; border-radius:14px; }
    .h1 { font-family:Arial,Helvetica,sans-serif; font-size:22px; line-height:1.45; color:#0f172a; margin:0; }
    .p  { font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:1.75; color:#1f2937; margin:0; }
    .muted { font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#6b7280; }
    .meta { font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#111827; }
    .badge { display:inline-block; padding:4px 8px; border-radius:999px; background:#eef2ff; color:#1f4ed8; font-family:Arial,Helvetica,sans-serif; font-size:12px; font-weight:bold; }
    .btn  { background:#155eef; border-radius:10px; text-align:center; }
    .btn a { display:inline-block; padding:12px 22px; font-family:Arial,Helvetica,sans-serif; font-size:15px; font-weight:bold; color:#ffffff; }

    @media (prefers-color-scheme: dark) {
      body { background:#0f1115; }
      .card { background:#171a21 !important; border-color:#2a2f39 !important; }
      .h1, .meta { color:#e6e8eb !important; }
      .p { color:#cfd6df !important; }
      .muted { color:#aab2bd !important; }
      .badge { background:#1f2a44 !important; color:#93c5fd !important; }
      .btn  { background:#3b82f6 !important; }
      a { color:#93c5fd !important; }
    }

    @media screen and (max-width:480px) {
      .wrap { padding:18px !important; }
      .h1 { font-size:20px !important; }
    }
  </style>
</head>
<body style="direction:rtl;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${esc(preheader)}
  </div>

  <table role="presentation" width="100%" bgcolor="#f3f5f7" style="background:#f3f5f7;" dir="rtl">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" width="100%" class="container" dir="rtl" style="max-width:760px;">
          <!-- header -->
          <tr>
            <td align="center" style="padding:0 0 16px 0;">
              <img src="${esc(
                logoSrc
              )}" alt="פניות לקוח" width="140" style="display:block;margin:auto;border:0;outline:none;text-decoration:none;">
            </td>
          </tr>

          <!-- body card -->
          <tr>
            <td class="card wrap" style="padding:26px;">
              <table role="presentation" width="100%">
                <tr>
                  <td align="right" style="padding:0 0 8px 0">
                    <span class="badge">${esc(badgeText)}</span>
                  </td>
                </tr>
                <tr>
                  <td align="right" style="padding:0 0 10px 0;">
                    <h1 class="h1">${esc(headline)}</h1>
                  </td>
                </tr>
              </table>

              ${detailsPanel}

              ${bodyHtml || ""}

              ${buttonBlock}

              <p class="muted" style="margin:18px 0 0 0;text-align:center;">
                ${esc(footerNote)}
              </p>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td align="center" class="muted" style="padding:14px 0 0 0;">
              © ${new Date().getFullYear()} תפעול והדרכה
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** convenience: ready-made “new/updated ticket” variant using the shell */
export function renderTicketEmail({
  url,
  title,
  departmentName,
  createdAtISO,
  headline = "פרטי פנייה",
  badgeText = "עדכון",
  extraHtml = "",
  logoMode, // default cid (from renderEmailShell)
  appBaseUrl,
}: {
  url: string;
  title?: string;
  /** department name only */
  departmentName?: string;
  createdAtISO?: string;
  headline?: string;
  badgeText?: string;
  extraHtml?: string;
  logoMode?: "public" | "cid";
  appBaseUrl?: string;
}) {
  const details: DetailRow[] = [
    { label: "נושא", value: title || "(ללא כותרת)" },
    { label: "מחלקה", value: departmentName || "(לא צוינה)" },
    {
      label: "תאריך",
      value: new Date(createdAtISO || Date.now()).toLocaleString("he-IL", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    },
  ];

  return renderEmailShell({
    preheader: "פרטי פנייה וקישור מהיר.",
    badgeText,
    headline,
    details,
    bodyHtml: extraHtml,
    button: { href: url, label: "פתיחה במערכת" },
    logoMode,
    appBaseUrl,
  });
}
