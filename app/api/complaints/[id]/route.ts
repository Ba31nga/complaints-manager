// FILE: app/api/complaints/[id]/route.ts
import { COMPLAINTS_SHEET_ID } from "@/app/lib/sheets";
import { rowToComplaint, complaintToRow } from "@/app/lib/mappers/complaints";
import type { Complaint } from "@/app/lib/types";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
// mail helpers used inside the notify service

// Email template (single built-in CTA button)
// email template helpers used inside the notify service
import { notifyOnComplaintPatch } from "@/app/lib/services/complaints/complaints.notifications";
import { normalizeId, isRole } from "@/app/lib/utils";
import {
  unwrapParams,
  getAllComplaintRows,
  locateComplaintRow,
  updateComplaintRow,
} from "@/app/lib/services/complaints/complaints.sheets";
import type { CtxMaybePromise } from "@/app/lib/services/complaints/complaints.sheets";
import { validatePatchOrThrow } from "@/app/lib/services/complaints/complaints.validate";
import {
  canReadComplaint,
  canMutateComplaint,
} from "@/app/lib/services/complaints/complaints.access";
import { closeComplaintFlow } from "@/app/lib/services/complaints/complaints.close";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// complaints tab name is resolved inside the core helpers

/* ───────── helpers (centralized in app/lib/services) ───────── */

// moved to service: unwrapParams, reading rows, and locating/updating rows

/* Minimal shapes */
// shapes and recipient helpers moved into service layer

/* paragraphsHtml imported from emailTemplates */

/* ───────── GET /api/complaints/[id] ───────── */
export async function GET(_req: Request, ctx: CtxMaybePromise) {
  try {
    const { id } = await unwrapParams(ctx);

    const values = await getAllComplaintRows();
    const wanted = normalizeId(id);
    const loc = locateComplaintRow(
      values.map((r) => r.map((c) => (c ?? "").toString())),
      wanted
    );
    const found = loc.row;
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
      if (!canReadComplaint(user, c)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
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
    const patch = (await req.json()) as Partial<Complaint> &
      Partial<{
        close: boolean;
        principalReview: Complaint["principalReview"];
      }>;
    try {
      validatePatchOrThrow(patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid payload";
      return Response.json({ error: msg }, { status: 400 });
    }

    // read all to locate row
    const values = await getAllComplaintRows();
    const wanted = normalizeId(id);
    const loc = locateComplaintRow(
      values.map((r) => r.map((c) => (c ?? "").toString())),
      wanted
    );
    const rowIdx = loc.a1RowNumber;
    const existingRow = loc.row;
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
      if (!canMutateComplaint(user, existing)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch (err) {
      console.error("Error while checking session for complaint PATCH:", err);
    }

    // Lock while awaiting principal review
    if (existing.status === "AWAITING_PRINCIPAL_REVIEW") {
      const session = await getServerSession(authOptions);
      const role = (session as unknown as { user?: { role?: string } })?.user
        ?.role;
      const isPrivileged = isRole(role, "PRINCIPAL") || isRole(role, "ADMIN");
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

    // ───────── Close flow (principal) ─────────
    if ((patch as { close?: boolean })?.close) {
      const result = await closeComplaintFlow({ existing, rowIdx, patch });
      if ("error" in result) {
        return Response.json(
          { error: result.error },
          { status: result.status }
        );
      }
      return Response.json({ data: result });
    }

    const merged: Complaint = {
      ...existing,
      ...patch,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    const row = complaintToRow(merged);
    await updateComplaintRow(rowIdx, row);

    /* ───────── Notifications ───────── */
    try {
      await notifyOnComplaintPatch({ existing, merged, patch });
    } catch (notifyErr) {
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
