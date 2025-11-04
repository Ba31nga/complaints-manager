"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Complaint, Department, User } from "@/app/lib/types";
import Card from "@/app/components/Card";

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

// Phone formatting helpers (IL)
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

export default function ClosedComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { status: sessionStatus } = useSession();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let alive = true;
    (async () => {
      if (sessionStatus === "loading") return;
      try {
        setLoading(true);
        setErr(null);
        const [c, u, d] = await Promise.all([
          api<{ data: Complaint }>(`/api/complaints/${id}`, {
            signal: ctrl.signal,
          }),
          api<{ data: User[] }>("/api/users", { signal: ctrl.signal }),
          api<{ data: Department[] }>("/api/departments", {
            signal: ctrl.signal,
          }),
        ]);
        if (!alive) return;
        setComplaint(c.data);
        setUsers(u.data);
        setDepartments(d.data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [id, sessionStatus]);

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
    return (
      <div className="p-4" dir="rtl">
        <div className="rounded-xl border bg-red-100 p-8 text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          שגיאה בטעינת הנתונים: {err}
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="p-4" dir="rtl">
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-lg font-semibold mb-1">הפנייה לא נמצאה</div>
          <Link className="text-primary hover:underline" href="/closed">
            ← חזרה לתלונות סגורות
          </Link>
        </div>
      </div>
    );
  }

  const dept =
    departments.find((d) => d.id === (complaint.departmentId || "")) || null;
  const assignee = complaint.assigneeUserId
    ? users.find((u) => u.id === complaint.assigneeUserId) || null
    : null;
  const reporter = complaint.reporter;

  const justified = complaint.principalReview?.justified ?? null;
  const decisionColor =
    justified === null
      ? "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
      : justified
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300";

  return (
    <div className="p-4 md:p-6 container-max" dir="rtl">
      {/* Top summary card */}
      <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-neutral-500">
              <Link href="/closed" className="hover:underline">
                תלונות סגורות
              </Link>{" "}
              /{" "}
              <span className="text-neutral-700 dark:text-neutral-300">
                פרטי פנייה
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold truncate">
              {complaint.title}
            </h1>
            <div className="mt-2 grid gap-2 text-xs text-neutral-600 dark:text-neutral-400 sm:grid-cols-4">
              <div className="inline-flex items-center gap-2">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] dark:bg-neutral-800">
                  סגור
                </span>
                {justified !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${decisionColor}`}
                  >
                    {justified ? "מוצדקת" : "לא מוצדקת"}
                  </span>
                )}
              </div>
              <div>
                מחלקה: <span className="font-medium">{dept?.name || "—"}</span>
              </div>
              <div>
                מטפל/ת:{" "}
                <span className="font-medium">{assignee?.name || "—"}</span>
              </div>
              <div>
                נסגר בתאריך:{" "}
                <span className="font-medium">
                  {new Date(
                    complaint.principalReview?.signedAt || complaint.updatedAt
                  ).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}
                </span>
              </div>
            </div>
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400">
            נוצר:{" "}
            {new Date(complaint.createdAt).toLocaleDateString("he-IL", {
              timeZone: "Asia/Jerusalem",
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,360px]">
        {/* Main column */}
        <div className="space-y-4">
          <Card>
            <h3 className="mb-2 text-sm font-semibold">
              סיכום מנהל/ת בית הספר
            </h3>
            {complaint.principalReview ? (
              <div className="space-y-2 text-sm">
                <div
                  className={`inline-flex items-center gap-2 ${decisionColor} rounded-full px-2 py-0.5 text-[11px]`}
                >
                  {complaint.principalReview.justified ? "מוצדקת" : "לא מוצדקת"}
                </div>
                <div className="whitespace-pre-wrap leading-6 text-neutral-800 dark:text-neutral-200">
                  {complaint.principalReview.summary}
                </div>
              </div>
            ) : (
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                —
              </div>
            )}
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold">מכתב המטפל/ת</h3>
            <div className="text-sm whitespace-pre-wrap leading-6 text-neutral-800 dark:text-neutral-200">
              {complaint.assigneeLetter?.body || "—"}
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold">פרטי הפנייה</h3>
            <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-800 dark:text-neutral-200">
              {complaint.body}
            </p>
          </Card>
        </div>

        {/* Side column */}
        <aside className="space-y-4 lg:sticky lg:top-20 h-fit">
          {/* Reporter details */}
          <section className="rounded-xl border bg-white p-5 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h4 className="mb-3 text-sm font-semibold">פרטי המדווח</h4>
            <div className="space-y-1 text-neutral-800 dark:text-neutral-200">
              <div className="font-medium">{reporter?.fullName || "—"}</div>
              {reporter?.phone && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">טלפון</span>
                  <a
                    className="text-primary hover:underline"
                    href={makeTelHref(reporter.phone)}
                  >
                    {formatIsraeliPhone(reporter.phone)}
                  </a>
                </div>
              )}
              {reporter?.email && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">אימייל</span>
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

          <section className="rounded-xl border bg-white p-5 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-2 font-medium">ניווט מהיר</div>
            <ul className="space-y-1">
              <li>
                <Link className="text-primary hover:underline" href="/closed">
                  ← חזרה לתלונות סגורות
                </Link>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
