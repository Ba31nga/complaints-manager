import type { Complaint, User } from "@/app/lib/types";
import { readDepartments, readUsers } from "@/app/lib/sheets";
import { appLink, sendMail } from "@/app/lib/mailer";
import {
  logoCidAttachment,
  renderParagraphsHtml,
  renderTicketEmail,
} from "@/app/lib/emailTemplates";
import type Mail from "nodemailer/lib/mailer";
import { isValidEmail } from "@/app/lib/utils";

function pickUserEmail(u?: User | null): string | null {
  if (!u) return null;
  if (u.googleMail && isValidEmail(u.googleMail)) return u.googleMail;
  if (u.armyMail && isValidEmail(u.armyMail)) return u.armyMail;
  return null;
}

export async function notifyOnComplaintPatch(args: {
  existing: Complaint;
  merged: Complaint;
  patch: Partial<Complaint>;
}): Promise<void> {
  const { existing, merged, patch } = args;

  // Read recipients context (users, departments) once
  let users: User[] = [] as unknown as User[];
  let departmentName = "—";
  try {
    const [sheetUsers, deps] = await Promise.all([
      readUsers(),
      readDepartments(),
    ]);
    users = sheetUsers.map((r) => ({
      id: r.id?.trim() || "",
      name: r.fullName?.trim() || "",
      role: (r.role?.trim() || "EMPLOYEE") as User["role"],
      departmentId: r.department?.trim() || "",
      armyMail: (r.armyMail || "").trim() || undefined,
      googleMail: (r.googleMail || "").trim() || undefined,
    }));
    departmentName =
      deps.find((d) => d.id === merged.departmentId)?.name || departmentName;
  } catch (e) {
    console.warn("[notify] failed to read users/departments context", e);
  }

  const findUserById = (id?: string | null): User | null => {
    const wanted = String(id || "").trim();
    if (!wanted) return null;
    return users.find((u) => u.id === wanted) || null;
  };

  const ticketUrl = appLink(`/complaints/${merged.id}`);

  const attachments: Mail.Attachment[] = [
    logoCidAttachment() as unknown as Mail.Attachment,
  ];

  const sendSafe = async (
    to: string | string[] | null | undefined,
    subject: string,
    html: string
  ) => {
    const list = Array.isArray(to) ? to : to ? [to] : [];
    const valid = list.filter(isValidEmail);
    if (!valid.length) return;
    try {
      await sendMail({ to: valid, subject, html, attachments });
    } catch (e) {
      console.error("[notify] sendMail failed", e);
    }
  };

  const changes: string[] = Object.keys(patch || {});

  // 1) Assignee changes: notify new assignee, and previous assignee if changed
  if (changes.includes("assigneeUserId")) {
    const prevAssignee = findUserById(existing.assigneeUserId);
    const nextAssignee = findUserById(merged.assigneeUserId);

    // Notify new assignee
    if (nextAssignee) {
      const email = pickUserEmail(nextAssignee);
      // Keep message concise: no duplicated details or inline link text
      const lines = [`${nextAssignee.name}, הוקצתה לך פנייה חדשה במערכת.`];
      const html = renderTicketEmail({
        url: ticketUrl,
        title: merged.title,
        departmentName,
        // Show the assignment time
        createdAtISO: new Date().toISOString(),
        headline: "הוקצתה לך פנייה",
        badgeText: "הוקצה",
        extraHtml: renderParagraphsHtml(lines),
      });
      await sendSafe(email, `פנייה חדשה הוקצתה אליך (#${merged.id})`, html);
    }

    // Notify previous assignee if different
    const prevId = String(existing.assigneeUserId || "").trim();
    const nextId = String(merged.assigneeUserId || "").trim();
    if (prevId && prevId !== nextId && prevAssignee) {
      const email = pickUserEmail(prevAssignee);
      const lines = [
        `${prevAssignee.name}, פנייה שהייתה משויכת אליך הועברה למטפל/ת אחר/ת.`,
      ];
      const html = renderTicketEmail({
        url: ticketUrl,
        title: merged.title,
        departmentName,
        createdAtISO: new Date().toISOString(),
        headline: "פנייה הועברה ממך",
        badgeText: "הועבר",
        extraHtml: renderParagraphsHtml(lines),
      });
      await sendSafe(email, `פנייה הועברה ממך (#${merged.id})`, html);
    }
  }

  // 2) Principal review: when status transitions into AWAITING_PRINCIPAL_REVIEW
  const statusChanged = changes.includes("status");
  const enteredPrincipalReview =
    statusChanged &&
    merged.status === "AWAITING_PRINCIPAL_REVIEW" &&
    existing.status !== "AWAITING_PRINCIPAL_REVIEW";

  if (enteredPrincipalReview) {
    const principals = users.filter(
      (u) => String(u.role).toUpperCase() === "PRINCIPAL"
    );
    const to = principals.map(pickUserEmail).filter(Boolean) as string[];
    const lines = ["פנייה ממתינה לסקירת מנהל/ת."]; // avoid duplication
    const html = renderTicketEmail({
      url: ticketUrl,
      title: merged.title,
      departmentName,
      createdAtISO: merged.updatedAt || new Date().toISOString(),
      headline: "פנייה ממתינה לסקירת מנהל/ת",
      badgeText: "סקירת מנהל/ת",
      extraHtml: renderParagraphsHtml(lines),
    });
    await sendSafe(to, `פנייה ממתינה לסקירת מנהל/ת (#${merged.id})`, html);
  }

  // 3) Optional: status became ASSIGNED but assignee not changed explicitly
  if (
    !changes.includes("assigneeUserId") &&
    statusChanged &&
    merged.status === "ASSIGNED"
  ) {
    const assignee = findUserById(merged.assigneeUserId);
    if (assignee) {
      const email = pickUserEmail(assignee);
      const lines = [`${assignee.name}, פנייה סומנה כ-"משויך" עבורך במערכת.`];
      const html = renderTicketEmail({
        url: ticketUrl,
        title: merged.title,
        departmentName,
        createdAtISO: new Date().toISOString(),
        headline: "פנייה שויכה עבורך",
        badgeText: "הוקצה",
        extraHtml: renderParagraphsHtml(lines),
      });
      await sendSafe(email, `פנייה שויכה עבורך (#${merged.id})`, html);
    }
  }

  // Non-fatal: do not throw on notification failures
}
