// FILE: /app/api/complaints/[id]/route.ts
import { getSheets, COMPLAINTS_SHEET_ID } from "@/app/lib/sheets";
import { rowToComplaint, complaintToRow } from "@/app/lib/mappers/complaints";
import type { Complaint } from "@/app/lib/types";

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
    range: `${TAB}!A:R`, // A..R per schema
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

    // read all to locate row
    const sheetsRO = getSheets("ro");
    const res = await sheetsRO.spreadsheets.values.get({
      spreadsheetId: COMPLAINTS_SHEET_ID,
      range: `${TAB}!A:R`,
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

    const merged: Complaint = {
      ...existing,
      ...patch,
      id: existing.id, // immutable
      updatedAt: new Date().toISOString(),
    };

    const a1 = `${TAB}!A${rowIdx}:R${rowIdx}`;
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
