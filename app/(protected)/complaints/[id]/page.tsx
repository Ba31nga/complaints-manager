/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import type { Complaint, Role, User } from "@/app/lib/types";
import {
  // data & getters
  users,
  departments,
  getComplaint,
  assignableUsersForDept,
  // mutators
  assignComplaint,
  changeDepartment,
  saveAssigneeLetter,
  submitForPrincipalReview,
  principalReturnForRedo,
  principalApproveAndClose,
} from "@/app/lib/mock";

/* ─────────────────────────── Viewer (from localStorage) ─────────────────────────── */
type Viewer = { role: Role; userId: string; departmentId?: string };

function readViewer(): Viewer {
  const role = (localStorage.getItem("role") as Role | null) ?? "EMPLOYEE";
  const userId = localStorage.getItem("userId") ?? "u2";
  let departmentId = localStorage.getItem("departmentId") ?? "";
  const u = users.find((x) => x.id === userId);
  if (u && !departmentId) departmentId = u.departmentId;
  return { role, userId, departmentId };
}

/* ─────────────────────────── Helpers ─────────────────────────── */
const statusLabel: Record<Complaint["status"], string> = {
  OPEN: "פתוח",
  ASSIGNED: "הוקצה",
  IN_PROGRESS: "בטיפול",
  AWAITING_PRINCIPAL_REVIEW: "ממתין לאישור מנהל/ת בית הספר",
  CLOSED: "סגור",
};

// ADMIN or PRINCIPAL can change department
function canChangeDepartment(viewer: Viewer) {
  return viewer.role === "ADMIN" || viewer.role === "PRINCIPAL";
}

// ADMIN/PRINCIPAL can assign anywhere; MANAGER can assign only in their dept
function canAssign(viewer: Viewer, effectiveDeptId: string) {
  if (viewer.role === "ADMIN" || viewer.role === "PRINCIPAL") return true;
  if (viewer.role === "MANAGER" && viewer.departmentId === effectiveDeptId)
    return true;
  return false;
}

// Whoever is assigned can write (manager/admin/principal if assigned to self)
function canAssigneeWrite(viewer: Viewer, assigneeId?: string | null) {
  return !!assigneeId && viewer.userId === assigneeId;
}

function canPrincipalAct(viewer: Viewer) {
  return viewer.role === "PRINCIPAL" || viewer.role === "ADMIN";
}

/* ─────────────────────────── Page ─────────────────────────── */
export default function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();

  // bump this to re-read the DB (mock arrays) after mutations
  const [rev, setRev] = useState(0);

  const complaint = useMemo(() => getComplaint(id), [id, rev]);
  const [viewer, setViewer] = useState<Viewer | null>(null);

  // form state
  const [employeeDraft, setEmployeeDraft] = useState("");
  const [principalDraft, setPrincipalDraft] = useState("");
  const [principalJust, setPrincipalJust] = useState<boolean | null>(null);
  const [returnReason, setReturnReason] = useState("");

  useEffect(() => {
    // viewer from localStorage
    setViewer(readViewer());
    // keep viewer in sync if user switches role/user in another tab
    const onStorage = (e: StorageEvent) => {
      if (["role", "userId", "departmentId"].includes(e.key ?? "")) {
        setViewer(readViewer());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // initialize editor values from DB each time complaint changes
  useEffect(() => {
    if (!complaint) return;
    setEmployeeDraft(complaint.assigneeLetter?.body ?? "");
    setPrincipalDraft(""); // principal writes fresh summary per review
    setPrincipalJust(null);
    setReturnReason(""); // input for new return reason (banner shows from DB if exists)
  }, [complaint?.id, complaint?.status, rev]);

  if (!complaint || !viewer) {
    return (
      <div className="p-4" dir="rtl">
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-lg font-semibold mb-1">הפנייה לא נמצאה</div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            ייתכן שהקישור שגוי או שהפנייה הועברה/נמחקה.
          </div>
        </div>
      </div>
    );
  }

  // Effective values are always the DB values
  const effectiveDeptId = complaint.departmentId;
  const effectiveAssigneeId = complaint.assigneeUserId ?? null;

  const dept = departments.find((d) => d.id === effectiveDeptId) ?? null;
  const assignee: User | null = effectiveAssigneeId
    ? users.find((u) => u.id === effectiveAssigneeId) ?? null
    : null;

  const displayStatus = complaint.status;

  /* ───── Precomputed booleans ───── */
  const isAssigned = !!effectiveAssigneeId;
  const canAssignHere = canAssign(viewer, effectiveDeptId);
  const canChangeDeptHere = canChangeDepartment(viewer);
  const canWriteHere = canAssigneeWrite(viewer, effectiveAssigneeId);
  const canPrincipalHere = canPrincipalAct(viewer);

  const isAwaitingPrincipal = displayStatus === "AWAITING_PRINCIPAL_REVIEW";
  const isClosed = displayStatus === "CLOSED";
  const isInProgress =
    displayStatus === "IN_PROGRESS" || displayStatus === "ASSIGNED";

  const hasEmployeeLetter =
    !!complaint.assigneeLetter?.body &&
    complaint.assigneeLetter.body.trim().length > 0;

  // principal may respond/return only if there is a letter and status is AWAITING_PRINCIPAL_REVIEW
  const canPrincipalRespond =
    canPrincipalHere && isAwaitingPrincipal && hasEmployeeLetter;

  const nextHint = !isAssigned
    ? "יש לשייך מטפל/ת לפנייה לפני תחילת הטיפול."
    : isAwaitingPrincipal
    ? "ממתין/ה לאישור מנהל/ת בית הספר."
    : isInProgress
    ? "הפנייה בטיפול אצל המטפל/ת."
    : isClosed
    ? "הפנייה נסגרה."
    : "";

  /* ─────────────────────────── Actions (DB-backed) ─────────────────────────── */
  const rerender = () => setRev((x) => x + 1);

  // ADMIN / PRINCIPAL: change department
  const onChangeDept = (deptId: string) => {
    if (!(canChangeDeptHere && !isClosed)) return;
    changeDepartment(complaint.id, deptId, { clearAssigneeIfNotInDept: true });
    rerender();
  };

  // ADMIN / PRINCIPAL / MANAGER-of-dept: assign assignee (employee or manager)
  const onChangeAssignee = (userId: string) => {
    if (!(canAssignHere && !isClosed)) return;
    assignComplaint(complaint.id, userId || null);
    rerender();
  };

  // ASSIGNEE: save letter / submit to principal
  const onSaveAssigneeLetter = () => {
    if (!canWriteHere || !isAssigned || isClosed) return;
    const body = employeeDraft.trim();
    if (!body) return;
    saveAssigneeLetter(complaint.id, viewer.userId, body);
    rerender();
  };

  const onSubmitToPrincipal = () => {
    if (!canWriteHere || !isAssigned || isAwaitingPrincipal || isClosed) return;
    const body = (employeeDraft || "").trim();
    if (!body) return;
    // ensure latest draft saved before submit
    saveAssigneeLetter(complaint.id, viewer.userId, body);
    submitForPrincipalReview(complaint.id, viewer.userId);
    rerender();
  };

  // PRINCIPAL: close with justified flag + summary (only if an employee letter exists)
  const onPrincipalClose = () => {
    if (!canPrincipalRespond) return;
    if (principalJust === null || !principalDraft.trim()) return;
    principalApproveAndClose(
      complaint.id,
      viewer.userId,
      principalJust,
      principalDraft.trim()
    );
    rerender();
  };

  // PRINCIPAL: return to assignee for redo (DB persists reason; only if letter exists)
  const onPrincipalReturn = () => {
    if (!canPrincipalRespond) return;
    const reason = returnReason.trim();
    if (!reason) return;
    principalReturnForRedo(complaint.id, viewer.userId, reason);
    setReturnReason("");
    rerender();
  };

  /* ─────────────────────────── UI ─────────────────────────── */
  return (
    <div className="p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs text-neutral-500">
            <Link href="/" className="hover:underline">
              פניות לקוח
            </Link>{" "}
            /{" "}
            <span className="text-neutral-700 dark:text-neutral-300">
              פרטי פנייה
            </span>
          </div>
          <h1 className="text-2xl font-semibold">{complaint.title}</h1>
          <div className="text-xs text-neutral-600 dark:text-neutral-400">
            סטטוס:{" "}
            <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] dark:bg-neutral-800">
              {statusLabel[displayStatus]}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {nextHint}
          </p>
        </div>

        <div className="text-xs text-neutral-600 dark:text-neutral-400">
          תפקיד: <span className="font-medium">{viewer.role}</span> · משתמש:{" "}
          <span className="font-mono">{viewer.userId}</span>
        </div>
      </div>

      {/* Stepper (2 steps) */}
      <div className="mb-6">
        <ol className="flex items-center text-[11px] text-neutral-600 dark:text-neutral-400">
          <li
            className={`flex items-center ${
              displayStatus === "ASSIGNED" ||
              displayStatus === "IN_PROGRESS" ||
              isAwaitingPrincipal ||
              isClosed
                ? "font-semibold text-neutral-900 dark:text-neutral-100"
                : ""
            }`}
          >
            1. מכתב המטפל/ת
          </li>
          <span className="mx-2 h-px w-10 bg-neutral-300 dark:bg-neutral-700" />
          <li
            className={`flex items-center ${
              isAwaitingPrincipal || isClosed
                ? "font-semibold text-neutral-900 dark:text-neutral-100"
                : ""
            }`}
          >
            2. אישור מנהל/ת בית הספר וסגירה
          </li>
        </ol>
      </div>

      {/* Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr,360px]">
        {/* Main */}
        <div className="space-y-4">
          {/* Details */}
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-2 text-sm font-semibold">פרטי הפנייה</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-800 dark:text-neutral-200">
              {complaint.body}
            </p>
          </section>

          {/* Return notice from DB */}
          {complaint.returnInfo && isInProgress && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-900/20">
              <div className="font-medium mb-1">
                הוחזר לעריכה ע&quot;י מנהל/ת בית הספר
              </div>
              <div className="text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
                {complaint.returnInfo.reason}
              </div>
            </div>
          )}

          {/* Assignee letter */}
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">מכתב המטפל/ת</h3>
              {isAwaitingPrincipal && (
                <span className="text-[11px] text-neutral-500">
                  הוגש לאישור מנהל/ת בית הספר
                </span>
              )}
            </div>

            <textarea
              className="w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none dark:border-neutral-800 dark:bg-neutral-900"
              rows={8}
              placeholder="כתוב/כתבי כאן מכתב מפורט לפונה (ללא דיאלוג פנימי)."
              value={employeeDraft}
              onChange={(e) => setEmployeeDraft(e.target.value)}
              disabled={
                !canWriteHere || !isAssigned || isAwaitingPrincipal || isClosed
              }
            />

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded-md border bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
                onClick={onSaveAssigneeLetter}
                disabled={
                  !canWriteHere ||
                  !isAssigned ||
                  !employeeDraft.trim() ||
                  isClosed
                }
              >
                שמור מכתב
              </button>
              <button
                className="rounded-md border border-blue-600 px-3 py-1.5 text-sm text-blue-700 transition hover:bg-blue-50 disabled:opacity-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950/20"
                onClick={onSubmitToPrincipal}
                disabled={
                  !canWriteHere ||
                  !isAssigned ||
                  !employeeDraft.trim() ||
                  isAwaitingPrincipal ||
                  isClosed
                }
              >
                סיימתי טיפול — העבר לאישור מנהל/ת בית הספר
              </button>
            </div>
          </section>

          {/* Principal summary + return */}
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="mb-3 text-sm font-semibold">
              אישור מנהל/ת בית הספר / החזרה לעריכה
            </h3>

            {/* Only actionable during review AND only if an employee letter exists */}
            <fieldset disabled={!canPrincipalRespond || isClosed}>
              {!hasEmployeeLetter && isAwaitingPrincipal && (
                <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] dark:border-amber-900/40 dark:bg-amber-900/20">
                  אין מכתב מטפל/ת שמור. לא ניתן לאשר או להחזיר עד שהמטפל/ת
                  יכתוב/תשמור מכתב.
                </div>
              )}

              <div className="mb-3 flex gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={principalJust === true}
                    onChange={() => setPrincipalJust(true)}
                  />
                  מוצדקת
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={principalJust === false}
                    onChange={() => setPrincipalJust(false)}
                  />
                  לא מוצדקת
                </label>
              </div>

              <textarea
                className="mb-2 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none dark:border-neutral-800 dark:bg-neutral-900"
                rows={6}
                placeholder="סיכום מנהל/ת בית הספר (ייכלל במייל הסגירה לפונה)."
                value={principalDraft}
                onChange={(e) => setPrincipalDraft(e.target.value)}
              />

              {/* Return to assignee */}
              <div className="mt-4 rounded-lg border bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/40">
                <div className="mb-2 font-medium">החזרה לעריכה אצל המטפל/ת</div>
                <textarea
                  className="w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none dark:border-neutral-800 dark:bg-neutral-900"
                  rows={3}
                  placeholder="סיבה קצרה להחזרה (תוצג למטפל/ת)"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    className="rounded-md border px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-200 dark:hover:bg-neutral-800/60"
                    onClick={onPrincipalReturn}
                    disabled={!returnReason.trim() || !canPrincipalRespond}
                    type="button"
                  >
                    החזר לעריכה
                  </button>
                  <button
                    className="rounded-md border bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
                    onClick={onPrincipalClose}
                    disabled={
                      !canPrincipalRespond ||
                      principalJust === null ||
                      !principalDraft.trim()
                    }
                    type="button"
                  >
                    שלח מייל סיכום וסגור
                  </button>
                </div>
              </div>
            </fieldset>
          </section>
        </div>

        {/* Side panel */}
        <aside className="space-y-4 lg:sticky lg:top-6 h-fit">
          {/* Assignment & Department */}
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h4 className="mb-3 text-sm font-semibold">שיוך וטיפול</h4>

            {/* Department select (ADMIN + PRINCIPAL) */}
            <div className="mb-3">
              <div className="text-xs text-neutral-500">מחלקה מטפלת</div>
              {canChangeDeptHere ? (
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                  value={effectiveDeptId}
                  onChange={(e) => onChangeDept(e.target.value)}
                  disabled={isClosed}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1 text-sm">{dept?.name ?? "—"}</div>
              )}
            </div>

            {/* Assignee select (ADMIN / PRINCIPAL / MANAGER of dept) */}
            <div>
              <div className="text-xs text-neutral-500">מוקצה ל</div>
              {canAssignHere && !isClosed ? (
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                  value={effectiveAssigneeId ?? ""}
                  onChange={(e) => onChangeAssignee(e.target.value)}
                >
                  <option value="">— ללא</option>
                  {assignableUsersForDept(effectiveDeptId).map((m) => {
                    const isDeptManager =
                      departments.find((d) => d.id === effectiveDeptId)
                        ?.managerUserId === m.id;
                    const isMe = viewer.userId === m.id;
                    return (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {isDeptManager ? " (מנהל/ת)" : ""}
                        {isMe ? " (אני)" : ""}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="mt-1 text-sm">
                  {assignee ? assignee.name : "—"}
                </div>
              )}
            </div>

            {!isAssigned && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                לא ניתן להתחיל בתהליך ללא שיוך מטפל/ת.
              </p>
            )}
          </section>

          {/* Progress snapshot (from DB) */}
          <section className="rounded-xl border bg-white p-5 shadow-sm text-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h4 className="mb-2 font-semibold">תקציר התקדמות</h4>
            <ul className="space-y-1">
              <li>
                <span className="text-neutral-500">מכתב המטפל/ת:</span>{" "}
                {complaint.assigneeLetter?.body ? "קיים" : "—"}
              </li>
              <li>
                <span className="text-neutral-500">מצב אישור:</span>{" "}
                {isClosed
                  ? complaint.principalReview?.justified
                    ? "נסגר — מוצדקת"
                    : "נסגר — לא מוצדקת"
                  : isAwaitingPrincipal
                  ? hasEmployeeLetter
                    ? "ממתין לאישור"
                    : "ממתין למכתב מטפל/ת"
                  : isInProgress && complaint.returnInfo
                  ? "הוחזר לעריכה"
                  : "—"}
              </li>
            </ul>
            {isInProgress && complaint.returnInfo && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                סיבת החזרה: {complaint.returnInfo.reason}
              </p>
            )}
          </section>

          {/* Back link */}
          <section className="rounded-xl border bg-white p-5 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-2 font-medium">ניווט מהיר</div>
            <ul className="space-y-1">
              <li>
                <Link className="text-blue-600 hover:underline" href="/">
                  ← חזרה לכל הפניות
                </Link>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
