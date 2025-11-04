import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isRole, isValidEmail } from "@/app/lib/utils";
import type { Complaint } from "@/app/lib/types";
import { complaintToRow } from "@/app/lib/mappers/complaints";
import { updateComplaintRow } from "@/app/lib/services/complaints/complaints.sheets";
import { notifyOnComplaintPatch } from "@/app/lib/services/complaints/complaints.notifications";
import { readDepartments, getUserByEmail } from "@/app/lib/sheets";
import path from "node:path";
import { buildComplaintClosurePdf } from "@/app/lib/pdf/complaintClosurePdf";
import { generatePdfFromGoogleDoc } from "@/app/lib/services/docsPdf";
import { config } from "@/app/lib/config";
import { appLink, sendMail } from "@/app/lib/mailer";
import { logoCidAttachment, renderTicketEmail, renderParagraphsHtml } from "@/app/lib/emailTemplates";
import type Mail from "nodemailer/lib/mailer";
import { DRIVE_FOLDER_ID, uploadPdfToDrive } from "@/app/lib/drive";

export async function closeComplaintFlow(params: {
  existing: Complaint;
  rowIdx: number;
  patch: Partial<Complaint> & Partial<{ principalReview: Complaint["principalReview"] }>;
}): Promise<{ ok: true; emailed: boolean } | { error: string; status: number }> {
  const { existing, rowIdx, patch } = params;

  const session = await getServerSession(authOptions);
  if (!session) return { error: "Unauthenticated", status: 401 } as const;
  const role = (session.user as { role?: string } | undefined)?.role;
  const isPrivileged = isRole(role, "PRINCIPAL") || isRole(role, "ADMIN");
  if (!isPrivileged) return { error: "Forbidden", status: 403 } as const;

  if (existing.status !== "AWAITING_PRINCIPAL_REVIEW") {
    return {
      error: "Cannot close: complaint is not awaiting principal review",
      status: 400,
    } as const;
  }

  const pr = (patch.principalReview || null) as Complaint["principalReview"];
  if (!pr || typeof pr.justified !== "boolean") {
    return { error: "Missing or invalid principalReview.justified", status: 400 } as const;
  }
  const summary = String(pr.summary ?? "").trim();
  if (!summary) return { error: "Principal summary is required", status: 400 } as const;
  if (summary.length > 5000)
    return { error: "Principal summary too long (max 5000)", status: 400 } as const;
  const signedByUserId = String(pr.signedByUserId || "").trim();
  if (!signedByUserId) return { error: "signedByUserId is required", status: 400 } as const;

  const signedAt = new Date().toISOString();
  const signatureImagePath = pr.signatureImagePath || undefined;

  const mergedClose: Complaint = {
    ...existing,
    status: "CLOSED",
    principalReview: {
      justified: !!pr.justified,
      summary,
      signedByUserId,
      signedAt,
      signatureImagePath,
    },
    updatedAt: signedAt,
  };

  // Persist
  const rowC = complaintToRow(mergedClose);
  await updateComplaintRow(rowIdx, rowC);

  // Internal notifications (best effort)
  try {
    await notifyOnComplaintPatch({ existing, merged: mergedClose, patch });
  } catch (e) {
    console.error("[complaint close] internal notify failed", e);
  }

  // Reporter email (best effort)
  let emailed = false;
  try {
    const reporterEmail = (mergedClose.reporter as { email?: string } | undefined)?.email || "";
    if (isValidEmail(reporterEmail)) {
      // Resolve department name
      let departmentName = "—";
      try {
        const deps = await readDepartments();
        const dep = deps.find((d) => d.id === mergedClose.departmentId);
        departmentName = dep?.name || "—";
      } catch (e) {
        console.warn("Failed to resolve department name:", e);
      }

      // Resolve principal display name/role
      let principalName = "—";
      let principalRole = "מנהל/ת בית הספר";
      const email = (session.user as { email?: string } | undefined)?.email || "";
      if (email) {
        try {
          const sheetUser = await getUserByEmail(email);
          principalName = sheetUser?.fullName || principalName;
          if (sheetUser?.role) principalRole = sheetUser.role;
        } catch (e) {
          console.warn("Failed to resolve principal user:", e);
        }
      }

      const logoPath = path.join(process.cwd(), "public", "emailLogo.png");

      let pdfBuffer: Buffer | null = null;
      let pdfFilename = "";
      try {
        if (config.GOOGLE_DOCS_TEMPLATE_ID) {
          const filename = `complaint-${mergedClose.id}.pdf`;
          const justifiedLabel = mergedClose.principalReview?.justified
            ? "מוצדקת"
            : "לא מוצדקת";
          const { buffer } = await generatePdfFromGoogleDoc({
            templateId: config.GOOGLE_DOCS_TEMPLATE_ID,
            filename,
            data: {
              COMPLAINT_ID: mergedClose.id,
              COMPLAINT_TITLE: mergedClose.title || "",
              DEPARTMENT_NAME: departmentName,
              PRINCIPAL_NAME: principalName,
              PRINCIPAL_ROLE: principalRole,
              SIGNED_AT: new Date(mergedClose.principalReview?.signedAt || mergedClose.updatedAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }),
              JUSTIFIED_LABEL: justifiedLabel,
              SUMMARY: mergedClose.principalReview?.summary || "",
              REPORTER_NAME: mergedClose.reporter.fullName || "",
            },
          });
          pdfBuffer = buffer;
          pdfFilename = filename;
        } else {
          const built = await buildComplaintClosurePdf({
            complaint: mergedClose,
            departmentName,
            principalName,
            principalRole,
            logoPath,
            signatureImagePath: mergedClose.principalReview?.signatureImagePath,
          });
          pdfBuffer = built.buffer;
          pdfFilename = built.filename;
        }
      } catch (e) {
        console.error("PDF build failed (will send without attachment):", e);
      }

      const ticketUrl = appLink(`/complaints/${mergedClose.id}`);
      const lines = [
        `שלום ${mergedClose.reporter.fullName},`,
        "הליך הטיפול בפנייתך הושלם.",
        mergedClose.principalReview?.justified
          ? "החלטה: הפנייה הוכרה כמוצדקת."
          : "החלטה: הפנייה לא הוכרה כמוצדקת.",
        pdfBuffer
          ? "מצורף קובץ PDF עם פירוט מלא, כולל סיכום מנהל/ת בית הספר."
          : "שימו לב: אירעה תקלה ביצירת קובץ ה-PDF. פרטי הסיכום זמינים במערכת.",
        `לצפייה בפנייה במערכת: ${ticketUrl}`,
      ];

      const html = renderTicketEmail({
        url: ticketUrl,
        title: mergedClose.title,
        departmentName,
        createdAtISO: mergedClose.createdAt,
        headline: "פנייתך נסגרה",
        badgeText: "נסגר",
        extraHtml: renderParagraphsHtml(lines),
      });

      const attachments: Mail.Attachment[] = [logoCidAttachment() as unknown as Mail.Attachment];
      if (pdfBuffer && pdfFilename) {
        attachments.push({ filename: pdfFilename, content: pdfBuffer } as Mail.Attachment);
      }

      try {
        await sendMail({
          to: reporterEmail,
          subject: `סיכום טיפול בפנייה: ${mergedClose.title} (#${mergedClose.id})`,
          html,
          attachments,
        });
        emailed = true;
      } catch (e) {
        console.error("Failed to send reporter email:", e);
      }

      // Best-effort: upload PDF to Drive folder if configured
      try {
        if (pdfBuffer && pdfFilename && DRIVE_FOLDER_ID) {
          await uploadPdfToDrive({ buffer: pdfBuffer, filename: pdfFilename, folderId: DRIVE_FOLDER_ID });
        }
      } catch (e) {
        console.warn("Drive upload failed:", e);
      }
    } else {
      console.warn("Reporter email missing/invalid; skipping send.");
    }
  } catch (e) {
    console.error("Reporter email flow failed:", e);
  }

  return { ok: true, emailed } as const;
}


