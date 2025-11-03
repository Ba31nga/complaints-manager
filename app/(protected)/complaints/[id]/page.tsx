// FILE: app/(protected)/complaints/[id]/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Complaint, Role, User, Department } from "@/app/lib/types";
import Card from "@/app/components/Card";
import ErrorShell from "@/app/components/ErrorShell";

/* ─────────────────────────── DB Adapters ─────────────────────────── */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function fetchComplaint(id: string): Promise<Complaint> {
  const { data } = await api<{ data: Complaint }>(`/api/complaints/${id}`);
  return data;
}
async function fetchUsers(): Promise<User[]> {
  const { data } = await api<{ data: User[] }>(`/api/users`);
  return data;
}
async function fetchDepartments(): Promise<Department[]> {
  const { data } = await api<{ data: Department[] }>(`/api/departments`);
  return data;
}
async function fetchUserByEmail(email: string): Promise<User | null> {
  const { data } = await api<{ data: User | null }>(
    `/api/users/by-email?email=${encodeURIComponent(email)}`
  );
  return data ?? null;
}

async function patchAssign(id: string, userId: string | null) {
  await api<unknown>(`/api/complaints/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assigneeUserId: userId }),
  });
}
async function patchChangeDepartment(id: string, departmentId: string | null) {
  await api<unknown>(`/api/complaints/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ departmentId: departmentId ?? "" }),
  });
}

async function patchComplaint(id: string, patch: Partial<unknown>) {
  await api<unknown>(`/api/complaints/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ─────────────────────────── Viewer (resolved from session + DB) ─────────────────────────── */
type Viewer = { role: Role; userId: string; departmentId?: string };

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (typeof err === "object" && err) {
    const name = (err as { name?: unknown }).name;
    const code = (err as { code?: unknown }).code;
    if (name === "AbortError") return true;
    if (code === 20) return true; // legacy
  }
  return false;
}

/* ─────────────────────────── Helpers ─────────────────────────── */
const statusLabel: Record<Complaint["status"], string> = {
  OPEN: "פתוח",
  ASSIGNED: "הוקצה",
  IN_PROGRESS: "בטיפול",
  AWAITING_PRINCIPAL_REVIEW: "ממתין לאישור מנהל/ת בית הספר",
  CLOSED: "סגור",
};

function canChangeDepartment(viewer: Viewer) {
  return viewer.role === "ADMIN" || viewer.role === "PRINCIPAL";
}
function canAssign(viewer: Viewer, effectiveDeptId: string) {
  if (viewer.role === "ADMIN" || viewer.role === "PRINCIPAL") return true;
  if (viewer.role === "MANAGER" && viewer.departmentId === effectiveDeptId)
    return true;
  return false;
}
function canAssigneeWrite(viewer: Viewer, assigneeId?: string | null) {
  return !!assigneeId && viewer.userId === assigneeId;
}
function canPrincipalAct(viewer: Viewer) {
  return viewer.role === "PRINCIPAL" || viewer.role === "ADMIN";
}

// Format Israeli phone numbers for display and create a tel: href.
function formatIsraeliPhone(phone?: string | null) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return phone;
  let local = digits;
  if (local.startsWith("972")) local = local.slice(3);
  else if (local.startsWith("0")) local = local.slice(1);
  if (local.length === 9) {
    const m = local.match(/^(\d{2})(\d{3})(\d{4})$/);
    if (m) return `0${m[1]}-${m[2]}-${m[3]}`;
  }
  if (local.length === 8) {
    const m = local.match(/^(\d{1})(\d{3})(\d{4})$/);
    if (m) return `0${m[1]}-${m[2]}-${m[3]}`;
  }
  return phone;
}

function makeTelHref(phone?: string | null) {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (!digits) return phone;
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  if (!digits.startsWith("+")) digits = `+${digits}`;
  return `tel:${digits}`;
}

/* ─────────────────────────── Page ─────────────────────────── */
export default function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status: sessionStatus } = useSession();

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // form state (future messages integration)
  const [employeeDraft, setEmployeeDraft] = useState("");
  const [principalDraft, setPrincipalDraft] = useState("");
  const [principalJust, setPrincipalJust] = useState<boolean | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // NEW: blocking overlay state + helper
  const [blocking, setBlocking] = useState(false);
  async function withBlocking<T>(fn: () => Promise<T>) {
    try {
      setBlocking(true);
      return await fn();
    } finally {
      setBlocking(false);
    }
  }

  // Load DB + resolve viewer from session.email
  useEffect(() => {
    const ctrl = new AbortController();
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (sessionStatus === "loading") return;

        const [u, d, c] = await Promise.all([
          fetchUsers(),
          fetchDepartments(),
          fetchComplaint(id),
        ]);
        if (!alive) return;
        setUsers(u);
        setDepartments(d);
        setComplaint(c);

        const email = session?.user?.email?.toLowerCase() ?? "";
        let me: User | null = null;
        if (email) {
          try {
            me = await fetchUserByEmail(email);
          } catch (e) {
            if (!isAbortError(e)) console.warn("by-email lookup failed:", e);
          }
        }
        const chosen = me ?? u[0] ?? null;

        if (chosen) {
          setViewer({
            userId: chosen.id,
            role: chosen.role,
            departmentId: chosen.departmentId,
          });
        } else {
          setViewer(null);
        }

        setEmployeeDraft(c.assigneeLetter?.body ?? "");
        setPrincipalDraft("");
        setPrincipalJust(null);
        setReturnReason("");
      } catch (e) {
        if (isAbortError(e)) return;
        const message = e instanceof Error ? e.message : "Failed to load";
        if (alive) setErr(message);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [id, session?.user?.email, sessionStatus]);

  // assignable users per dept
  const assignableUsersForDept = useMemo(() => {
    const map = new Map<string, User[]>();
    for (const d of departments) {
      const inDept = users.filter((u) => u.departmentId === d.id);
      const extra =
        d.managerUserId && !inDept.some((u) => u.id === d.managerUserId)
          ? users.filter((u) => u.id === d.managerUserId)
          : [];
      map.set(d.id, [...inDept, ...extra]);
    }
    return (deptId: string) => map.get(deptId) ?? [];
  }, [users, departments]);

  if (loading || sessionStatus === "loading") {
    return (
      <div className="p-4" dir="rtl">
        <div className="card p-8 flex items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
          <svg
            className="h-5 w-5 animate-spin text-neutral-500"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              className="opacity-25"
            />
            <path
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              className="opacity-75"
            />
          </svg>
          <span>טוען נתונים…</span>
        </div>
      </div>
    );
  }
  if (err) {
    const lower = (err || "").toString().toLowerCase();
    if (lower.includes("unauthenticated") || lower.includes("401")) {
      return (
        <ErrorShell
          title="לא מחובר/ת"
          message={"עליך להתחבר כדי לצפות בפנייה זו."}
          showRetry={false}
          reportSubject={"דווח%20שגיאה%20-401"}
        />
      );
    }
    if (lower.includes("forbidden") || lower.includes("403")) {
      return (
        <ErrorShell
          title="אין לך הרשאה"
          message={"אין לך הרשאות לצפות או לערוך פנייה זו."}
          showRetry={false}
          reportSubject={"דווח%20שגיאה%20-403"}
        />
      );
    }

    return (
      <div className="p-4" dir="rtl">
        <div className="rounded-xl border bg-red-100 p-8 text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          שגיאה בטעינת הנתונים: {err}
        </div>
      </div>
    );
  }
  if (!complaint || !viewer) {
    return (
      <div className="p-4" dir="rtl">
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-lg font-semibold mb-1">הפנייה לא נמצאה</div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            ייתכן שהקישור שגוי או שהפנייה הועברה/נמחקה.
          </div>
          <Link className="text-primary hover:underline" href="/">
            ← חזרה לכל הפניות
          </Link>
        </div>
      </div>
    );
  }

  // Effective values (DB) – default department to "" (no selection)
  const effectiveDeptId = complaint.departmentId || "";
  const effectiveAssigneeId = complaint.assigneeUserId ?? null;
  const dept = departments.find((d) => d.id === effectiveDeptId) ?? null;
  const assignee: User | null = effectiveAssigneeId
    ? users.find((u) => u.id === effectiveAssigneeId) ?? null
    : null;

  const reporter = complaint.reporter;
  const displayStatus = complaint.status;

  /* ───── Permissions ───── */
  const hasDept = !!effectiveDeptId;
  const isAssigned = !!effectiveAssigneeId;
  const canAssignHere = hasDept && canAssign(viewer, effectiveDeptId);
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

  const canPrincipalRespond =
    canPrincipalHere && isAwaitingPrincipal && hasEmployeeLetter;

  const nextHint = !hasDept
    ? "יש לבחור מחלקה לפני התחלת הטיפול."
    : !isAssigned
    ? "יש לשייך מטפל/ת לפנייה לפני תחילת הטיפול."
    : isAwaitingPrincipal
    ? "ממתין/ה לאישור מנהל/ת בית הספר."
    : isInProgress
    ? "הפנייה בטיפול אצל המטפל/ת."
    : isClosed
    ? "הפנייה נסגרה."
    : "";

  /* ─────────────────────────── Actions (DB) ─────────────────────────── */

  const refetchComplaint = async () => {
    const c = await fetchComplaint(complaint.id);
    setComplaint(c);
  };

  const onChangeDept = async (deptId: string) => {
    if (!canChangeDeptHere || isClosed) return;
    await withBlocking(async () => {
      const newDeptId = deptId || ""; // allow clearing to "— ללא"
      // When clearing department, also clear assignee on the server
      await patchChangeDepartment(complaint.id, newDeptId || null);
      if (!newDeptId && isAssigned) {
        await patchAssign(complaint.id, null);
      }
      await refetchComplaint();
    });
  };

  const onChangeAssignee = async (userId: string) => {
    if (!hasDept) return; // cannot assign without department
    if (!(canAssignHere && !isClosed)) return;
    await withBlocking(async () => {
      await patchAssign(complaint.id, userId || null);
      await refetchComplaint();
    });
  };

  // TODOs – require schema extension in Sheets
  const onSaveAssigneeLetter = async () => {
    if (!canWriteHere || !isAssigned || isClosed) return;
    const body = employeeDraft.trim();
    if (!body) return;

    setActionLoading(true);
    setErr(null);
    try {
      const newMsg = {
        id: makeId(),
        authorId: viewer!.userId,
        body,
        createdAt: new Date().toISOString(),
      };
      const updatedMessages = [...(complaint.messages || []), newMsg];
      await patchComplaint(complaint.id, { messages: updatedMessages });
      await refetchComplaint();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const onSubmitToPrincipal = async () => {
    if (!canWriteHere || !isAssigned || isClosed) return;
    const body = (employeeDraft || "").trim();
    if (!body) return;

    setActionLoading(true);
    setErr(null);
    try {
      const newMsg = {
        id: makeId(),
        authorId: viewer!.userId,
        body,
        createdAt: new Date().toISOString(),
      };
      const updatedMessages = [...(complaint.messages || []), newMsg];
      await patchComplaint(complaint.id, {
        messages: updatedMessages,
        status: "AWAITING_PRINCIPAL_REVIEW",
      });
      await refetchComplaint();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const onPrincipalClose = async () => {
    if (!canPrincipalRespond) return;
    if (principalJust === null || !principalDraft.trim()) return;
    alert("סגירה דורשת הרחבת הסכמה (messagesJSON/עמודות חדשות).");
  };

  const onPrincipalReturn = async () => {
    if (!canPrincipalRespond) return;
    const reason = returnReason.trim();
    if (!reason) return;
    const makeIdLocal = () =>
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newMsg = {
      id: makeIdLocal(),
      authorId: viewer!.userId,
      body: `__RETURN__:${reason}`,
      createdAt: new Date().toISOString(),
    };
    const updatedMessages = [...(complaint.messages || []), newMsg];
    const newReturnInfo = {
      count: (complaint.returnInfo?.count || 0) + 1,
      reason,
      returnedAt: new Date().toISOString(),
      returnedByUserId: viewer!.userId,
    };
    setActionLoading(true);
    setErr(null);
    try {
      await patchComplaint(complaint.id, {
        messages: updatedMessages,
        returnInfo: newReturnInfo,
        status: "IN_PROGRESS",
      });
      await refetchComplaint();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  /* ─────────────────────────── UI ─────────────────────────── */
  return (
    <div className="p-4 md:p-6 container-max" dir="rtl">
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

      {/* Stepper */}
      <div className="mb-6">
        <ol className="flex items-center text-[11px] text-neutral-600 dark:text-neutral-400">
          <li
            className={`flex items-center ${
              displayStatus === "ASSIGNED" ||
              displayStatus === "IN_PROGRESS" ||
              displayStatus === "AWAITING_PRINCIPAL_REVIEW" ||
              displayStatus === "CLOSED"
                ? "font-semibold text-neutral-900 dark:text-neutral-100"
                : ""
            }`}
          >
            1. מכתב המטפל/ת
          </li>
          <span className="mx-2 h-px w-10 bg-neutral-300 dark:bg-neutral-700" />
          <li
            className={`flex items-center ${
              displayStatus === "AWAITING_PRINCIPAL_REVIEW" ||
              displayStatus === "CLOSED"
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
          <Card>
            <h2 className="mb-2 text-sm font-semibold">פרטי הפנייה</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-800 dark:text-neutral-200">
              {complaint.body}
            </p>
          </Card>

          {complaint.returnInfo &&
            (displayStatus === "IN_PROGRESS" ||
              displayStatus === "ASSIGNED") && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-900/20">
                <div className="font-medium mb-1">
                  הוחזר לעריכה על ידי מנהל/ת בית הספר
                </div>
                <div className="text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
                  {complaint.returnInfo.reason}
                </div>
              </div>
            )}

          <section className="card">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">מכתב המטפל/ת</h3>
              {displayStatus === "AWAITING_PRINCIPAL_REVIEW" && (
                <span className="text-[11px] text-neutral-500">
                  הוגש לאישור מנהל/ת בית הספר
                </span>
              )}
            </div>

            <textarea
              className={`w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none dark:border-neutral-800 ${
                isAwaitingPrincipal
                  ? "opacity-60 cursor-not-allowed bg-neutral-100 dark:bg-neutral-900/20"
                  : "dark:bg-neutral-900"
              }`}
              rows={8}
              placeholder="כתוב/כתבי כאן מכתב מפורט לפונה (ללא דיאלוג פנימי)."
              value={employeeDraft}
              onChange={(e) => setEmployeeDraft(e.target.value)}
              disabled={
                !canWriteHere || !isAssigned || isClosed || isAwaitingPrincipal
              }
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={`btn-primary ${actionLoading ? "opacity-70" : ""} ${
                  isAwaitingPrincipal ? "opacity-60 cursor-not-allowed" : ""
                }`}
                onClick={onSaveAssigneeLetter}
                disabled={
                  actionLoading ||
                  !canWriteHere ||
                  !isAssigned ||
                  !employeeDraft.trim() ||
                  isClosed ||
                  isAwaitingPrincipal
                }
              >
                שמור מכתב
              </button>
              <button
                className={`btn-ghost ${actionLoading ? "opacity-70" : ""} ${
                  isAwaitingPrincipal ? "opacity-60 cursor-not-allowed" : ""
                }`}
                onClick={onSubmitToPrincipal}
                disabled={
                  actionLoading ||
                  !canWriteHere ||
                  !isAssigned ||
                  !employeeDraft.trim() ||
                  isClosed ||
                  isAwaitingPrincipal
                }
              >
                סיימתי טיפול — העבר לאישור מנהל/ת בית הספר
              </button>
            </div>
          </section>

          <Card>
            <h3 className="mb-3 text-sm font-semibold">
              אישור מנהל/ת בית הספר / החזרה לעריכה
            </h3>

            <fieldset disabled={!canPrincipalRespond || isClosed}>
              {!hasEmployeeLetter &&
                displayStatus === "AWAITING_PRINCIPAL_REVIEW" && (
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
                  />{" "}
                  מוצדקת
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={principalJust === false}
                    onChange={() => setPrincipalJust(false)}
                  />{" "}
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

              <div className="mt-4 panel text-sm">
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
                    className={`btn-ghost ${actionLoading ? "opacity-70" : ""}`}
                    onClick={onPrincipalReturn}
                    disabled={
                      actionLoading ||
                      !returnReason.trim() ||
                      !canPrincipalRespond
                    }
                    type="button"
                  >
                    החזר לעריכה
                  </button>
                  <button
                    className={`btn-primary ${
                      actionLoading ? "opacity-70" : ""
                    }`}
                    onClick={onPrincipalClose}
                    disabled={
                      actionLoading ||
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
          </Card>
        </div>

        {/* Side panel */}
        <aside className="space-y-4 lg:sticky lg:top-20 h-fit">
          <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h4 className="mb-3 text-sm font-semibold">שיוך וטיפול</h4>

            {/* Department select */}
            <div className="mb-3">
              <div className="text-xs text-neutral-500">מחלקה מטפלת</div>
              {canChangeDeptHere ? (
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                  value={effectiveDeptId} // "" means "— ללא"
                  onChange={(e) => onChangeDept(e.target.value)}
                  disabled={blocking || isClosed}
                >
                  <option value="">{`— ללא`}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1 text-sm">{dept?.name ?? "—"}</div>
              )}
              {!canChangeDeptHere && (
                <div className="mt-1 text-xs text-neutral-500">
                  אין הרשאה לשנות מחלקה
                </div>
              )}
              {!hasDept && (
                <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  יש לבחור מחלקה לפני שיוך מטפל/ת.
                </div>
              )}
            </div>

            {/* Assignee select */}
            <div>
              <div className="text-xs text-neutral-500">מוקצה ל</div>
              {canAssignHere && !isClosed ? (
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                  value={effectiveAssigneeId ?? ""}
                  onChange={(e) => onChangeAssignee(e.target.value)}
                  disabled={blocking || !hasDept}
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
              {(!hasDept || !(canAssignHere && !isClosed)) && (
                <div className="mt-1 text-xs text-neutral-500">
                  {!hasDept
                    ? "בחר/י מחלקה כדי לשייך מטפל/ת"
                    : "אין הרשאה לשייך מטפל/ת"}
                </div>
              )}
            </div>

            {!isAssigned && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                לא ניתן להתחיל בתהליך ללא שיוך מטפל/ת.
              </p>
            )}
          </section>

          {/* Reporter details (side panel) */}
          <section className="rounded-xl border bg-white p-5 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h4 className="mb-3 text-sm font-semibold">פרטי המדווח</h4>
            <div className="text-sm text-neutral-800 dark:text-neutral-200 space-y-1">
              <div className="font-medium">{reporter.fullName}</div>
              {reporter.phone && (
                <div>
                  טלפון:
                  <a
                    className="text-primary hover:underline"
                    href={makeTelHref(reporter.phone)}
                  >
                    {formatIsraeliPhone(reporter.phone)}
                  </a>
                </div>
              )}
              {reporter.email && (
                <div>
                  אימייל:
                  <a
                    className="text-primary hover:underline"
                    href={`mailto:${reporter.email}`}
                  >
                    {reporter.email}
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* Progress snapshot */}
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

          {/* Back link (bottom) */}
          <section className="rounded-xl border bg-white p-5 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-2 font-medium">ניווט מהיר</div>
            <ul className="space-y-1">
              <li>
                <Link className="text-primary hover:underline" href="/">
                  ← חזרה לכל הפניות
                </Link>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      {/* Full-screen blocking spinner */}
      {blocking && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-black/50"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-3">
            <svg
              className="h-8 w-8 animate-spin text-neutral-600 dark:text-neutral-300"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-25"
              />
              <path
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                className="opacity-75"
              />
            </svg>
            <div className="text-sm text-neutral-700 dark:text-neutral-200">
              מעדכן…
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
