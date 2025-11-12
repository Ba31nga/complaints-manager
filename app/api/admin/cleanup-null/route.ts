import { COMPLAINTS_HEADER_AR } from "@/app/lib/mappers/complaints";
import {
  getAllComplaintRows,
  updateComplaintRow,
} from "@/app/lib/services/complaints/complaints.sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Protected, one-off endpoint to clean literal "null" strings from JSON columns
// in the complaints sheet. Call with ?secret=YOUR_SECRET (set SHEETS_CLEANUP_SECRET).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") || "";
  if (
    !process.env.SHEETS_CLEANUP_SECRET ||
    secret !== process.env.SHEETS_CLEANUP_SECRET
  ) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
    });
  }

  try {
    const values = await getAllComplaintRows();
    const hasHeader =
      values.length > 0 && (values[0][0] || "").toLowerCase() === "id";
    const headerOffset = hasHeader ? 1 : 0;
    const totalCols = COMPLAINTS_HEADER_AR.length;

    let updated = 0;
    for (let i = headerOffset; i < values.length; i++) {
      const row = values[i] || [];
      const padded = [...row, ...Array(totalCols).fill("")].slice(0, totalCols);

      let changed = false;
      // JSON columns positions (0-based) per COMPLAINTS_HEADER_AR
      const jsonIdxs = [18, 19, 20, 21, 22, 23]; // messagesJSON, assigneeLetterJSON, returnInfoJSON, reviewCyclesJSON, principalReviewJSON, notificationEmailJSON
      for (const idx of jsonIdxs) {
        if (padded[idx] === "null") {
          padded[idx] = "";
          changed = true;
        }
      }

      if (changed) {
        const a1RowNumber = i + 1; // rows array is zero-based, sheet A1 row is index+1
        await updateComplaintRow(a1RowNumber, padded);
        updated++;
      }
    }

    return new Response(JSON.stringify({ ok: true, updated }), { status: 200 });
  } catch (e) {
    console.error("cleanup-null failed:", e);
    return new Response(JSON.stringify({ error: "cleanup failed" }), {
      status: 500,
    });
  }
}
