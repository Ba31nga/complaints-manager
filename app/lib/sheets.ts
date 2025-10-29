// /app/lib/sheets.ts  (or /src/lib/sheets.ts)
import { google } from "googleapis";

const sheetsClient = () => {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SA_CLIENT_EMAIL,
    key: (process.env.GOOGLE_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
};

export type SheetUser = {
  /** Column A */
  count?: string;
  /** Column B */
  fullName?: string;
  /** Column C */
  id?: string;
  /** Column D */
  armyMail?: string;
  /** Column E — used for matching */
  googleMail?: string;
  /** Column F */
  role?: string;
  /** Column G */
  department?: string;
};

export async function getUserByEmail(email: string): Promise<SheetUser | null> {
  const sheets = sheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
  // A..G covers: count, full name, id, army mail, google mail, role, department
  const range = "users!A2:G";

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values || [];

  for (const row of rows) {
    // Be defensive: pad to 7 cells so destructuring never breaks on short rows
    const cells = [...(row as string[]), "", "", "", "", "", "", ""]
      .slice(0, 7)
      .map((v) => v?.trim());
    const [count, fullName, id, armyMail, googleMail, role, department] = cells;

    // Match by Google mail (E). Case-insensitive.
    if (googleMail && googleMail.toLowerCase() === email.toLowerCase()) {
      return { count, fullName, id, armyMail, googleMail, role, department };
    }
  }

  return null;
}
