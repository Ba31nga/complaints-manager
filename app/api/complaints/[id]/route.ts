// FILE: app/api/complaints/[id]/route.ts
import {
  getSheets,
  COMPLAINTS_SHEET_ID,
  readUsers,
  readDepartmentsRaw,
} from "@/app/lib/sheets";
import { rowToComplaint, complaintToRow } from "@/app/lib/mappers/complaints";
import type { Complaint } from "@/app/lib/types";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendMail, appLink } from "@/app/lib/mailer";

export const runtime = "nodejs"; // nodemailer
export const dynamic = "force-dynamic";

const TAB = process.env.GOOGLE_COMPLAINTS_TAB || "database";

/* ───────── helpers ───────── */
function escapeHtml(value: unknown): string {
  const s = String(value ?? "");
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return s.replace(/[&<>"']/g, (ch) => map[ch]);
}

function normalizeId(raw: unknown): string {
  if (raw == null) return "";
  let s = String(raw)
    .trim()
    .replace(/[\u200E\u200F]/g, "")
    .replace(/^'/, "");
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (!Number.isNaN(n)) s = String(n); // '01' -> '1'
  }
  return s;
}

type ParamsObj = { id: string };
type CtxMaybePromise = { params: ParamsObj } | { params: Promise<ParamsObj> };
function isPromise<T>(v: unknown): v is Promise<T> {
  return !!v && typeof (v as { then?: unknown }).then === "function";
}
async function unwrapParams(ctx: CtxMaybePromise): Promise<ParamsObj> {
  const p = (ctx as { params: unknown }).params;
  return isPromise<ParamsObj>(p) ? await p : (p as ParamsObj);
}

async function readAllValues(): Promise<string[][]> {
  const sheets = getSheets("ro");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: COMPLAINTS_SHEET_ID!,
    range: `${TAB}!A:S`, // includes messagesJSON + returnInfoJSON
  });
  return res.data.values || [];
}

/* Minimal shapes returned from sheets helpers */
type SheetUser = {
  id?: string;
  name?: string;
  role?: string;
  departmentId?: string;
  armyMail?: string;
  googleMail?: string;
};

type SheetDepartment = {
  id: string;
  name?: string;
  managerUserId?: string;
};

function parseDepartments(raw: string[][]): SheetDepartment[] {
  if (!raw.length) return [];
  const [header, ...rows] = raw;
  const col = (key: string) =>
    header.findIndex((h) => (h || "").toLowerCase() === key.toLowerCase());

  const idIdx = col("id");
  const nameIdx = col("name");
  const mgrIdx = col("managerUserId");

  return rows
    .map((r) => ({
      id: normalizeId(idIdx >= 0 ? r[idIdx] : ""),
      name: (nameIdx >= 0 ? r[nameIdx] : "") || undefined,
      managerUserId: normalizeId(mgrIdx >= 0 ? r[mgrIdx] : ""),
    }))
    .filter((d) => !!d.id);
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uniq = <T>(arr: T[]) => Array.from(new Set(arr));

function userRecipients(u?: SheetUser | null): string[] {
  if (!u) return [];
  const army = (u.armyMail || "").trim();
  const civ = (u.googleMail || "").trim();
  return uniq([army, civ].filter((e) => e && emailRe.test(e)));
}

function displayName(u?: SheetUser | null) {
  return u?.name || "";
}

function buildTicketTableHtml(c: Complaint) {
  return `
<table style="border-collapse:collapse;border:1px solid #e5e7eb">
  <tbody>
    <tr>
      <td style="padding:6px 10px;background:#f9fafb;border:1px solid #e5e7eb">כותרת</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(
        c.title
      )}</td>
    </tr>
    <tr>
      <td style="padding:6px 10px;background:#f9fafb;border:1px solid #e5e7eb">מזהה</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(
        c.id
      )}</td>
    </tr>
    <tr>
      <td style="padding:6px 10px;background:#f9fafb;border:1px solid #e5e7eb">מחלקה</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(
        c.departmentId || "—"
      )}</td>
    </tr>
    <tr>
      <td style="padding:6px 10px;background:#f9fafb;border:1px solid #e5e7eb">סטטוס</td>
      <td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(
        c.status
      )}</td>
    </tr>
  </tbody>
</table>`.trim();
}

/* ───────── GET /api/complaints/[id] ───────── */
export async function GET(_req: Request, ctx: CtxMaybePromise) {
  try {
    const { id } = await unwrapParams(ctx);

    const values = await readAllValues();
    const hasHeader =
      values.length > 0 && (values[0][0] || "").toLowerCase() === "id";
    const rows = values.slice(hasHeader ? 1 : 0);

    const wanted = normalizeId(id);
    const found = rows.find((r) => normalizeId(r?.[0]) === wanted);
    if (!found) return Response.json({ error: "Not found" }, { status: 404 });

    const c = rowToComplaint(found);
    if (!c) return Response.json({ error: "Not found" }, { status: 404 });

    // Access control
    try {
      const session = await getServerSession(authOptions);
      if (!session)
        return Response.json({ error: "Unauthenticated" }, { status: 401 });
      const user = session.user as
        | { id?: string; department?: string; role?: string }
        | undefined;
      const role = user?.role;
      const userId = user?.id;
      const userDept = user?.department;

      if (role === "MANAGER") {
        if (!userDept || c.departmentId !== userDept) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
      } else if (role === "EMPLOYEE") {
        if (!userId || c.assigneeUserId !== userId) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
      }
      // PRINCIPAL/ADMIN: allowed
    } catch (err) {
      console.error("Error while checking session for complaint GET:", err);
    }

    return Response.json({ data: c });
  } catch (e) {
    console.error("GET complaint error:", e);
    return Response.json(
      { error: "Failed to load complaint" },
      { status: 500 }
    );
  }
}

/* ───────── PATCH /api/complaints/[id] ───────── */
export async function PATCH(req: Request, ctx: CtxMaybePromise) {
  try {
    if (!COMPLAINTS_SHEET_ID) {
      return Response.json(
        { error: "Missing GOOGLE_SHEETS_COMPLAINTS_ID" },
        { status: 500 }
      );
    }

    const { id } = await unwrapParams(ctx);
    const patch = (await req.json()) as Partial<Complaint>;

    // Basic validation
    if (patch.messages !== undefined) {
      const messagesUnknown = patch.messages as unknown;
      if (!Array.isArray(messagesUnknown)) {
        return Response.json(
          { error: "messages must be an array" },
          { status: 400 }
        );
      }
      for (const mUnknown of messagesUnknown as unknown[]) {
        const m = mUnknown as Record<string, unknown> | null;
        if (
          !m ||
          typeof m.id !== "string" ||
          typeof m.authorId !== "string" ||
          typeof m.body !== "string" ||
          typeof m.createdAt !== "string"
        ) {
          return Response.json(
            { error: "invalid message shape" },
            { status: 400 }
          );
        }
      }
    }

    if (patch.returnInfo !== undefined && patch.returnInfo !== null) {
      const ri = patch.returnInfo as Record<string, unknown> | null;
      if (
        !ri ||
        typeof ri.count !== "number" ||
        typeof ri.reason !== "string" ||
        typeof ri.returnedAt !== "string" ||
        typeof ri.returnedByUserId !== "string"
      ) {
        return Response.json(
          { error: "invalid returnInfo shape" },
          { status: 400 }
        );
      }
    }

    // read all to locate row
    const sheetsRO = getSheets("ro");
    const res = await sheetsRO.spreadsheets.values.get({
      spreadsheetId: COMPLAINTS_SHEET_ID,
      range: `${TAB}!A:S`,
    });
    const values = res.data.values || [];
    const hasHeader =
      values.length > 0 && (values[0][0] || "").toLowerCase() === "id";
    const headerOffset = hasHeader ? 1 : 0;
    const rows = values.slice(headerOffset);

    const wanted = normalizeId(id);
    let rowIdx = -1;
    let existingRow: string[] | null = null;

    for (let i = 0; i < rows.length; i++) {
      if (normalizeId(rows[i]?.[0]) === wanted) {
        rowIdx = i + headerOffset + 1; // A1 row
        existingRow = rows[i];
        break;
      }
    }
    if (rowIdx === -1 || !existingRow) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const existing = rowToComplaint(existingRow);
    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Access control
    try {
      const session = await getServerSession(authOptions);
      if (!session)
        return Response.json({ error: "Unauthenticated" }, { status: 401 });
      const user = session.user as
        | { id?: string; department?: string; role?: string }
        | undefined;
      const role = user?.role;
      const userId = user?.id;
      const userDept = user?.department;

      if (role !== "PRINCIPAL" && role !== "ADMIN") {
        if (role === "MANAGER") {
          if (!userDept || existing.departmentId !== userDept) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }
        } else if (role === "EMPLOYEE") {
          if (!userId || existing.assigneeUserId !== userId) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }
        } else {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    } catch (err) {
      console.error("Error while checking session for complaint PATCH:", err);
    }

    // Lock while awaiting principal review
    if (existing.status === "AWAITING_PRINCIPAL_REVIEW") {
      const session = await getServerSession(authOptions);
      const role = (session as unknown as { user?: { role?: string } })?.user
        ?.role;
      const isPrivileged = role === "PRINCIPAL" || role === "ADMIN";
      if (!isPrivileged) {
        const forbiddenKeys = [
          "messages",
          "status",
          "assigneeUserId",
          "assigneeLetter",
        ] as const;
        const pr = patch as Record<string, unknown>;
        if (forbiddenKeys.some((k) => pr[k] !== undefined)) {
          return Response.json(
            { error: "Forbidden: complaint is awaiting principal review" },
            { status: 403 }
          );
        }
      }
    }

    const merged: Complaint = {
      ...existing,
      ...patch,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    const a1 = `${TAB}!A${rowIdx}:S${rowIdx}`;
    const row = complaintToRow(merged);

    const sheetsRW = getSheets("rw");
    await sheetsRW.spreadsheets.values.update({
      spreadsheetId: COMPLAINTS_SHEET_ID,
      range: a1,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });

    /* ───────── Notifications ───────── */
    try {
      const prevAssignee = normalizeId(existing.assigneeUserId);
      const nextAssignee = normalizeId(merged.assigneeUserId);

      // Load users + departments (for manager)
      const [users, departmentsRaw] = await Promise.all([
        readUsers(),
        readDepartmentsRaw(),
      ]);
      const departments = parseDepartments(departmentsRaw);

      const usersById = new Map<string, SheetUser>();
      for (const u of users as SheetUser[]) {
        const idNorm = normalizeId(u.id);
        if (idNorm) usersById.set(idNorm, u);
      }

      const nextUser = nextAssignee
        ? usersById.get(nextAssignee) || null
        : null;
      const prevUser = prevAssignee
        ? usersById.get(prevAssignee) || null
        : null;

      const dept =
        departments.find(
          (d) => normalizeId(d.id) === normalizeId(merged.departmentId)
        ) || null;
      const managerUser = dept?.managerUserId
        ? usersById.get(normalizeId(dept.managerUserId)) || null
        : null;

      const ticketUrl = appLink(`/complaints/${encodeURIComponent(merged.id)}`);
      const ticketHtmlTable = buildTicketTableHtml(merged);

      /* 1) New assignee (only if changed to someone) */
      if (nextAssignee && nextAssignee !== prevAssignee && nextUser) {
        const recipients = userRecipients(nextUser);
        if (recipients.length) {
          const subject = `הוקצתה לך פנייה חדשה: ${merged.title} (#${merged.id})`;
          const text = [
            `שלום ${displayName(nextUser)},`,
            ``,
            `הוקצתה לך פנייה חדשה במערכת:`,
            `כותרת: ${merged.title}`,
            `מחלקה: ${merged.departmentId || "—"}`,
            `סטטוס: ${merged.status}`,
            ``,
            `פתיחה מהירה: ${ticketUrl}`,
            ``,
            `— המערכת`,
          ].join("\n");

          const html = `
<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
  <p>שלום ${escapeHtml(displayName(nextUser))},</p>
  <p>הוקצתה לך פנייה חדשה במערכת.</p>
  ${ticketHtmlTable}
  <p style="margin-top:12px;">
    <a href="${ticketUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:8px 12px;border-radius:6px">לפתיחת הפנייה</a>
  </p>
  <p style="color:#6b7280;">— המערכת</p>
</div>`.trim();

          console.log("[notify] assignee ->", recipients);
          await sendMail({ to: recipients, subject, text, html });
        } else {
          console.warn(
            "[notify] new assignee has no valid email:",
            nextAssignee,
            nextUser?.name
          );
        }
      }

      /* 2) Department manager FYI (only: a complaint in your department) */
      if (dept && managerUser) {
        const recipients = userRecipients(managerUser);
        if (recipients.length) {
          const subject = `פנייה חדשה במחלקה שלך: ${merged.title} (#${merged.id})`;
          const text = [
            `שלום ${displayName(managerUser)},`,
            ``,
            `נפתחה/עודכנה פנייה במחלקה שלך.`,
            `כותרת: ${merged.title}`,
            `מחלקה: ${merged.departmentId || "—"}`,
            `סטטוס: ${merged.status}`,
            ``,
            `צפייה מהירה: ${ticketUrl}`,
            ``,
            `— המערכת`,
          ].join("\n");

          const html = `
<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
  <p>שלום ${escapeHtml(displayName(managerUser))},</p>
  <p>לתשומת ליבך: קיימת פנייה במחלקה שלך.</p>
  ${ticketHtmlTable}
  <p style="margin-top:12px;">
    <a href="${ticketUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:8px 12px;border-radius:6px">לצפייה בפנייה</a>
  </p>
  <p style="color:#6b7280;">— המערכת</p>
</div>`.trim();

          console.log("[notify] department manager ->", recipients);
          await sendMail({ to: recipients, subject, text, html });
        } else {
          console.warn(
            "[notify] dept manager has no valid email:",
            dept.managerUserId,
            managerUser?.name
          );
        }
      }

      /* 3) Previous assignee (only if there was one and it changed) */
      if (prevAssignee && nextAssignee !== prevAssignee && prevUser) {
        const recipients = userRecipients(prevUser);
        if (recipients.length) {
          const subject = `עדכון: פנייה הועברה למטפל/ת אחר/ת — ${merged.title} (#${merged.id})`;
          const text = [
            `שלום ${displayName(prevUser)},`,
            ``,
            `לעדכון: הפנייה הועברה למטפל/ת אחר/ת.`,
            `כותרת: ${merged.title}`,
            `מחלקה: ${merged.departmentId || "—"}`,
            ``,
            `צפייה מהירה: ${ticketUrl}`,
            ``,
            `— המערכת`,
          ].join("\n");

          const html = `
<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
  <p>שלום ${escapeHtml(displayName(prevUser))},</p>
  <p>לעדכון בלבד: הפנייה הועברה למטפל/ת אחר/ת.</p>
  ${ticketHtmlTable}
  <p style="margin-top:12px;">
    <a href="${ticketUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:8px 12px;border-radius:6px">לצפייה בפנייה</a>
  </p>
  <p style="color:#6b7280;">— המערכת</p>
</div>`.trim();

          console.log("[notify] previous assignee ->", recipients);
          await sendMail({ to: recipients, subject, text, html });
        } else {
          console.warn(
            "[notify] previous assignee has no valid email:",
            prevAssignee,
            prevUser?.name
          );
        }
      }
      /* ───── end notifications ───── */
    } catch (notifyErr) {
      // Never fail the PATCH because of an email problem; just log.
      console.error("[complaint PATCH] notification failed:", notifyErr);
    }

    return Response.json({ data: { ok: true } });
  } catch (e) {
    console.error("PATCH complaint error:", e);
    return Response.json(
      { error: "Failed to update complaint" },
      { status: 500 }
    );
  }
}
