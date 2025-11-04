import { readComplaintsRaw, getSheets, COMPLAINTS_SHEET_ID } from "@/app/lib/sheets";
import { COMPLAINTS_HEADER_AR } from "@/app/lib/mappers/complaints";
import { config } from "@/app/lib/config";

export type ParamsObj = { id: string };
export type CtxMaybePromise = { params: ParamsObj } | { params: Promise<ParamsObj> };

function isPromise<T>(v: unknown): v is Promise<T> {
  return !!v && typeof (v as { then?: unknown }).then === "function";
}

export async function unwrapParams(ctx: CtxMaybePromise): Promise<ParamsObj> {
  const p = (ctx as { params: unknown }).params;
  return isPromise<ParamsObj>(p) ? await p : (p as ParamsObj);
}

export async function getAllComplaintRows(): Promise<string[][]> {
  return readComplaintsRaw();
}

export function locateComplaintRow(values: string[][], wantedId: string) {
  const hasHeader = values.length > 0 && (values[0][0] || "").toLowerCase() === "id";
  const headerOffset = hasHeader ? 1 : 0;
  const rows = values.slice(headerOffset);

  let rowIdx = -1; // A1 row index (1-based)
  let foundRow: string[] | null = null;
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i]?.[0] || "").trim() === wantedId) {
      rowIdx = i + headerOffset + 1; // convert to A1 row
      foundRow = rows[i];
      break;
    }
  }
  return { hasHeader, headerOffset, a1RowNumber: rowIdx, row: foundRow, rows } as const;
}

export function complaintsTabName(): string {
  return config.GOOGLE_COMPLAINTS_TAB || "database";
}

export async function updateComplaintRow(a1RowNumber: number, row: (string | number | boolean)[]) {
  const TAB = complaintsTabName();
  if (!COMPLAINTS_SHEET_ID) throw new Error("Missing GOOGLE_SHEETS_COMPLAINTS_ID");
  // Compute end column from header length (e.g. 19 -> S, 20 -> T)
  const totalCols = COMPLAINTS_HEADER_AR.length;
  const endCol = a1ColumnLetter(totalCols);
  const a1 = `${TAB}!A${a1RowNumber}:${endCol}${a1RowNumber}`;
  const sheetsRW = getSheets("rw");
  await sheetsRW.spreadsheets.values.update({
    spreadsheetId: COMPLAINTS_SHEET_ID,
    range: a1,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

function a1ColumnLetter(n: number): string {
  // 1 -> A, 2 -> B, ... 26 -> Z, 27 -> AA
  let res = "";
  let x = n;
  while (x > 0) {
    const rem = (x - 1) % 26;
    res = String.fromCharCode(65 + rem) + res;
    x = Math.floor((x - 1) / 26);
  }
  return res;
}


