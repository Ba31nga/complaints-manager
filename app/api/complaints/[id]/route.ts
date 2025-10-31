// FILE: /app/api/complaints/[id]/route.ts
import { getSheets, COMPLAINTS_SHEET_ID } from "@/app/lib/sheets";
import { rowToComplaint, complaintToRow } from "@/app/lib/mappers/complaints";
import type { Complaint } from "@/app/lib/types";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const TAB = process.env.GOOGLE_COMPLAINTS_TAB || "database";
export const dynamic = "force-dynamic";

/* ───────── helpers ───────── */
function normalizeId(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  let s = String(raw)
    .trim()
    .replace(/^\u200F|\u200E/g, "") // strip RTL/LTR marks
    .replace(/^'/, ""); // strip leading apostrophe from Sheets
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
    range: `${TAB}!A:S`, // A..S per schema (messagesJSON + returnInfoJSON)
  });
  return res.data.values || [];
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

    // Basic validation to avoid corrupting the sheet.
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
        rowIdx = i + headerOffset + 1; // A1 row (1-based) incl. header
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

    // Server-side lock: if complaint is already awaiting principal review,
    // only principals/admins may modify messages/status/assignee fields.
    if (existing.status === "AWAITING_PRINCIPAL_REVIEW") {
      const session = await getServerSession(authOptions);
      const role =
        session &&
        (session as unknown as { user?: { role?: string } }).user?.role;
      const isPrivileged = role === "PRINCIPAL" || role === "ADMIN";
      if (!isPrivileged) {
        const forbiddenKeys = [
          "messages",
          "status",
          "assigneeUserId",
          "assigneeLetter",
        ];
        const patchRecord = patch as Partial<Record<string, unknown>>;
        if (forbiddenKeys.some((k) => patchRecord[k] !== undefined)) {
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
      id: existing.id, // immutable
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

    return Response.json({ data: { ok: true } });
  } catch (e) {
    console.error("PATCH complaint error:", e);
    return Response.json(
      { error: "Failed to update complaint" },
      { status: 500 }
    );
  }
}
