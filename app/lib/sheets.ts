// FILE: /app/lib/sheets.ts
import { google, sheets_v4 } from "googleapis";

/** ── ENV (required) ───────────────────────────────────────────────────────── */
const SA_EMAIL = process.env.GOOGLE_SA_CLIENT_EMAIL;

// Normalize multiline private key if it arrives with escaped "\n"
const SA_KEY_RAW = process.env.GOOGLE_SA_PRIVATE_KEY;
const SA_KEY =
  SA_KEY_RAW && SA_KEY_RAW.includes("\\n")
    ? SA_KEY_RAW.replace(/\\n/g, "\n")
    : SA_KEY_RAW;

// users + departments live here
export const USERS_SHEET_ID = process.env.GOOGLE_SHEETS_ID!;

// complaints (Apps Script writes here)
export const COMPLAINTS_SHEET_ID = process.env.GOOGLE_SHEETS_COMPLAINTS_ID;

/** ── Tab names (override via .env if you rename) ──────────────────────────── */
const USERS_TAB = process.env.GOOGLE_USERS_TAB || "users";
const DEPARTMENTS_TAB = process.env.GOOGLE_DEPARTMENTS_TAB || "departments";
const ROLES_TAB = process.env.GOOGLE_ROLES_TAB || "roles";
const COMPLAINTS_TAB = process.env.GOOGLE_COMPLAINTS_TAB || "database";

/** ── Memoized clients (read-only / read-write) ────────────────────────────── */
let roClient: sheets_v4.Sheets | null = null;
let rwClient: sheets_v4.Sheets | null = null;

/**
 * Get a Google Sheets client.
 * @param mode 'ro' (read-only) | 'rw' (read/write)
 */
export function getSheets(mode: "ro" | "rw" = "ro"): sheets_v4.Sheets {
  if (!SA_EMAIL || !SA_KEY) {
    throw new Error("Missing GOOGLE_SA_CLIENT_EMAIL or GOOGLE_SA_PRIVATE_KEY");
  }

  if (mode === "ro" && roClient) return roClient;
  if (mode === "rw" && rwClient) return rwClient;

  const scopes =
    mode === "rw"
      ? ["https://www.googleapis.com/auth/spreadsheets"]
      : ["https://www.googleapis.com/auth/spreadsheets.readonly"];

  const auth = new google.auth.JWT({ email: SA_EMAIL, key: SA_KEY, scopes });
  const client = google.sheets({ version: "v4", auth });

  if (mode === "ro") roClient = client;
  else rwClient = client;

  return client;
}

/** ── Thin helpers ─────────────────────────────────────────────────────────── */
export async function readRange(
  spreadsheetId: string,
  range: string,
  mode: "ro" | "rw" = "ro"
) {
  const sheets = getSheets(mode);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values || []) as string[][];
}

export async function appendRows(
  spreadsheetId: string,
  range: string,
  rows: (string | number | boolean)[][],
  mode: "ro" | "rw" = "rw"
) {
  const sheets = getSheets(mode);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}

export async function updateRange(
  spreadsheetId: string,
  a1: string, // e.g. "database!A2:R2"
  row: (string | number | boolean)[],
  mode: "ro" | "rw" = "rw"
) {
  const sheets = getSheets(mode);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: a1,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

/** ── Users sheet helpers ──────────────────────────────────────────────────── */

export type SheetUser = {
  /** Column A */ count?: string;
  /** Column B */ fullName?: string;
  /** Column C */ id?: string;
  /** Column D */ armyMail?: string;
  /** Column E — used for matching */ googleMail?: string;
  /** Column F */ role?: string;
  /** Column G */ department?: string;
};

/**
 * Look up a user by Google email from USERS_SHEET_ID in the `users` tab.
 * Expected columns: A..G = count, fullName, id, armyMail, googleMail, role, department
 */
export async function getUserByEmail(email: string): Promise<SheetUser | null> {
  if (!USERS_SHEET_ID)
    throw new Error("Missing GOOGLE_SHEETS_ID (users sheet)");
  const RANGE = `${USERS_TAB}!A2:G`;

  const rows = await readRange(USERS_SHEET_ID, RANGE, "ro");
  const lc = email.toLowerCase();

  for (const row of rows) {
    const cells = [...row, "", "", "", "", "", "", ""]
      .slice(0, 7)
      .map((v) => (v ?? "").trim());
    const [count, fullName, id, armyMail, googleMail, role, department] = cells;

    if (googleMail && googleMail.toLowerCase() === lc) {
      return { count, fullName, id, armyMail, googleMail, role, department };
    }
  }
  return null;
}

export async function readUsers(): Promise<SheetUser[]> {
  if (!USERS_SHEET_ID) return [];
  const rows = await readRange(USERS_SHEET_ID, `${USERS_TAB}!A2:G`, "ro");
  return rows.map((row) => {
    const cells = [...row, "", "", "", "", "", "", ""]
      .slice(0, 7)
      .map((v) => (v ?? "").trim());
    const [count, fullName, id, armyMail, googleMail, role, department] = cells;
    return { count, fullName, id, armyMail, googleMail, role, department };
  });
}

/** ── Departments (A:name, B:id) ───────────────────────────────────────────── */

export type SheetDepartment = {
  /** Column A */ name: string;
  /** Column B */ id: string;
};

/**
 * Reads departments as typed objects.
 * Expected columns: A=name, B=id (starting at row 2)
 */
export async function readDepartments(): Promise<SheetDepartment[]> {
  if (!USERS_SHEET_ID)
    throw new Error("Missing GOOGLE_SHEETS_ID (users sheet)");
  const RANGE = `${DEPARTMENTS_TAB}!A2:B`;
  const rows = await readRange(USERS_SHEET_ID, RANGE, "ro");

  return rows
    .map((r) => {
      const [name = "", id = ""] = r;
      return { name: name.trim(), id: id.trim() };
    })
    .filter((d) => d.name && d.id);
}

/**
 * Raw departments matrix (now A:B rather than A:A).
 * Useful for callers that still expect a 2D array.
 */
export async function readDepartmentsRaw(): Promise<string[][]> {
  if (!USERS_SHEET_ID) return [];
  return readRange(USERS_SHEET_ID, `${DEPARTMENTS_TAB}!A:B`, "ro");
}

/** Roles: single-column list (A:A) */
export async function readRolesRaw(): Promise<string[][]> {
  if (!USERS_SHEET_ID) return [];
  return readRange(USERS_SHEET_ID, `${ROLES_TAB}!A:A`, "ro");
}

/** Complaints: A..X (id..notificationEmailJSON) in `database` tab */
export async function readComplaintsRaw(): Promise<string[][]> {
  if (!COMPLAINTS_SHEET_ID)
    throw new Error("Missing GOOGLE_SHEETS_COMPLAINTS_ID");
  // Include columns up to X so returnInfoJSON/principalReview/notificationEmail are read
  return readRange(COMPLAINTS_SHEET_ID, `${COMPLAINTS_TAB}!A:X`, "ro");
}
