import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isRole } from "@/app/lib/utils";
import type { Complaint } from "@/app/lib/types";
import { complaintToRow } from "@/app/lib/mappers/complaints";
import { updateComplaintRow } from "@/app/lib/services/complaints/complaints.sheets";
import { notifyOnComplaintPatch } from "@/app/lib/services/complaints/complaints.notifications";
import { config } from "@/app/lib/config";
import { createHash } from "crypto";

export async function closeComplaintFlow(params: {
  existing: Complaint;
  rowIdx: number;
  patch: Partial<Complaint> &
    Partial<{ principalReview: Complaint["principalReview"] }>;
}): Promise<
  | { ok: true; form?: { submitted: boolean; prefillView?: string } }
  | { error: string; status: number }
> {
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
    return {
      error: "Missing or invalid principalReview.justified",
      status: 400,
    } as const;
  }
  const summary = String(pr.summary ?? "").trim();
  if (!summary)
    return { error: "Principal summary is required", status: 400 } as const;
  if (summary.length > 5000)
    return {
      error: "Principal summary too long (max 5000)",
      status: 400,
    } as const;
  const signedByUserId = String(pr.signedByUserId || "").trim();
  if (!signedByUserId)
    return { error: "signedByUserId is required", status: 400 } as const;

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
    // Avoid logging potentially sensitive data from errors. Log only name and
    // truncated message.
    if (e instanceof Error) {
      console.error(
        "[complaint close] internal notify failed:",
        `${e.name}: ${String(e.message).slice(0, 200)}`
      );
    } else {
      console.error(
        "[complaint close] internal notify failed:",
        String(e).slice(0, 200)
      );
    }
  }

  // Programmatically submit complaint id to Google Form's formResponse endpoint
  // and pick a usable human-facing prefill view link.
  let formSubmitted = false;
  let chosenPrefillView: string | undefined = undefined;

  try {
    const rawFormId = config.GOOGLE_FORM_ID;
    const entryId = config.entryID;
    if (!rawFormId || !entryId) {
      console.warn(
        "[complaint close] Google Form configuration missing; skipping submission."
      );
    } else {
      // Normalize form id (accept full URL or raw id)
      // Examples to accept:
      // - full URL: https://docs.google.com/forms/d/e/<id>/viewform
      // - editor URL: https://docs.google.com/forms/d/<id>/edit
      // - just the id: <id>
      let formId = rawFormId.trim();
      try {
        const u = new URL(formId);
        // extract id after /d/ or /d/e/
        const m = u.pathname.match(/\/d\/(?:e\/)?([^\/]+)/);
        if (m) formId = m[1];
      } catch {
        // not a URL, keep as-is
      }

      const encodedValue = encodeURIComponent(String(mergedClose.id));
      const params = new URLSearchParams();
      params.append(`entry.${entryId}`, String(mergedClose.id));

      // Try multiple URL patterns to handle different form id types. Prefer
      // the query-string submit URL which simulates the user clicking the
      // Submit link (includes submit=Submit). If the URL contains query
      // parameters we'll use GET; otherwise POST form-encoded.
      const tryUrls = [
        `https://docs.google.com/forms/d/e/${formId}/formResponse?entry.${entryId}=${encodedValue}&submit=Submit`,
        `https://docs.google.com/forms/d/e/${formId}/formResponse?entry.${entryId}=${encodedValue}`,
        `https://docs.google.com/forms/d/e/${formId}/formResponse`,
        `https://docs.google.com/forms/d/${formId}/formResponse`,
      ];

      let submitted = false;
      for (const url of tryUrls) {
        try {
          const u = new URL(url);
          const safeUrl = `${u.origin}${u.pathname}`;

          console.log(
            `[complaint close] attempting formResponse to ${safeUrl}`
          );
          const hasQuery = url.includes("?");
          const fetchOpts: RequestInit = hasQuery
            ? {
                method: "GET",
                redirect: "follow",
                headers: {
                  Accept:
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                  Referer: `https://docs.google.com/forms/d/e/${formId}/viewform`,
                  "User-Agent": "complaints-manager/1.0",
                },
              }
            : {
                method: "POST",
                redirect: "follow",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Accept:
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                  Referer: `https://docs.google.com/forms/d/e/${formId}/viewform`,
                  "User-Agent": "complaints-manager/1.0",
                },
                body: params.toString(),
              };

          const res = await fetch(url, fetchOpts);
          const text = await res.text();

          // Hash the response body instead of printing it to logs.
          const h = createHash("sha256")
            .update(text || "")
            .digest("hex");
          console.log(
            `[complaint close] formResponse ${safeUrl} -> ${res.status} (body ${
              text.length
            } bytes, sha256=${h.slice(0, 16)}...)`
          );

          if (res.status >= 200 && res.status < 400) {
            console.log(
              "[complaint close] formResponse submitted successfully to",
              safeUrl
            );
            submitted = true;
            break;
          }

          console.warn(
            `[complaint close] formResponse submit returned status ${res.status} for ${safeUrl}`
          );
        } catch (innerErr) {
          if (innerErr instanceof Error) {
            console.warn(
              `[complaint close] attempt to POST failed: ${
                innerErr.name
              }: ${String(innerErr.message).slice(0, 200)}`
            );
          } else {
            console.warn(
              "[complaint close] attempt to POST failed:",
              String(innerErr).slice(0, 200)
            );
          }
        }
      }

      if (!submitted) {
        console.warn(
          "[complaint close] All formResponse attempts failed; check GOOGLE_FORM_ID and entryID"
        );
      }
      formSubmitted = submitted;

      // Resolve a human-facing prefill view link. Try /d/e then /d/ and pick the
      // first that returns a non-error HTML response. If none match, fall back to
      // the editor link so the principal can open the form GUI.
      const prefillCandidates = [
        `https://docs.google.com/forms/d/e/${formId}/viewform?usp=pp_url&entry.${entryId}=${encodedValue}`,
        `https://docs.google.com/forms/d/${formId}/viewform?usp=pp_url&entry.${entryId}=${encodedValue}`,
      ];
      for (const p of prefillCandidates) {
        try {
          const r = await fetch(p, { method: "GET", redirect: "follow" });
          if (r.status >= 200 && r.status < 400) {
            chosenPrefillView = p;
            console.log("[complaint close] chosen prefill view:", p);
            break;
          }
        } catch {
          // ignore and try next
        }
      }
      if (!chosenPrefillView) {
        chosenPrefillView = `https://docs.google.com/forms/d/${formId}/edit`;
        console.warn(
          "[complaint close] no public prefill view found; falling back to editor link",
          chosenPrefillView
        );
      }
    }
  } catch (e) {
    console.error("[complaint close] form submission unexpected error:", e);
  }

  // Do not send any mail on close. Previously this function emailed the reporter
  // with a Google Form link; that behavior was removed per request.
  console.log(
    "[complaint close] mail sending disabled; not sending reporter email"
  );

  return {
    ok: true,
    form: { submitted: formSubmitted, prefillView: chosenPrefillView },
  } as const;
}
