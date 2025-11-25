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
  type LetterMeta = {
    exists?: boolean;
    fileName?: string;
    modifiedTime?: string;
    size?: number;
  };
  const [letterMeta, setLetterMeta] = useState<LetterMeta | null>(null);
  const [letterStatus, setLetterStatus] = useState<
    "idle" | "loading" | "ready" | "missing" | "error"
  >("idle");

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

  useEffect(() => {
    if (!complaint?.id) return;
    let alive = true;
    setLetterMeta(null);
    setLetterStatus("loading");
    (async () => {
      try {
        const res = await fetch(
          `/api/complaints/${complaint.id}/letter?mode=meta`,
          { cache: "no-store" }
        );
        if (!alive) return;
        if (!res.ok) {
          if (res.status === 404) {
            setLetterStatus("missing");
            return;
          }
          throw new Error(await res.text());
        }
        const json = (await res.json()) as { data?: LetterMeta };
        if (!alive) return;
        if (!json?.data?.exists) {
          setLetterStatus("missing");
          return;
        }
        setLetterMeta(json.data);
        setLetterStatus("ready");
      } catch (error) {
        if (!alive) return;
        setLetterStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [complaint?.id]);

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
            ← חזרה לפניות סגורות
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
  const usersById = new Map(users.map((u) => [u.id, u]));
  const closureDateValue =
    complaint.principalReview?.signedAt || complaint.updatedAt;
  const closureDate = closureDateValue ? new Date(closureDateValue) : null;
  const formatDateTime = (
    value?: string | null,
    options?: Intl.DateTimeFormatOptions
  ) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      ...options,
    });
  };
  const createdDate = new Date(complaint.createdAt);
  const closureDateHuman = closureDateValue
    ? formatDateTime(closureDateValue)
    : "—";
  const createdDateHuman = formatDateTime(complaint.createdAt);
  const durationDays =
    closureDate && createdDate
      ? Math.max(
          1,
          Math.round(
            (closureDate.getTime() - createdDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null;
  const reporterTypeLabel =
    reporter?.type === "STAFF"
      ? "חבר/ת צוות"
      : reporter?.type === "PARENT_STUDENT"
      ? "הורה / תלמיד"
      : reporter?.type === "BISLAT"
      ? 'ביסל"ט'
      : "—";
  const letterViewerUrl = complaint
    ? `/api/complaints/${complaint.id}/letter`
    : null;
  const principalSigner = complaint.principalReview?.signedByUserId
    ? usersById.get(complaint.principalReview.signedByUserId) || null
    : null;
  const principalSignedAtHuman = formatDateTime(
    complaint.principalReview?.signedAt
  );
  const messageTimeline = [...(complaint.messages ?? [])].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const resolveAuthorName = (authorId: string) => {
    if (!authorId) return "לא מזוהה";
    return usersById.get(authorId)?.name || authorId;
  };

  return (
    <div className="p-4 md:p-6 container-max" dir="rtl">
      {/* Top summary card */}
      <div className="mb-6 rounded-2xl border bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="text-xs text-neutral-500">
              <Link href="/closed" className="hover:underline">
                פניות סגורות
              </Link>{" "}
              /{" "}
              <span className="text-neutral-700 dark:text-neutral-300">
                דף למידה
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                פנייה #{complaint.id}
              </p>
              <h1 className="text-2xl font-semibold leading-snug text-neutral-900 dark:text-white">
                {complaint.title}
              </h1>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {complaint.subject}
              </p>
            </div>
            <div className="grid gap-3 text-sm text-neutral-600 dark:text-neutral-400 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1 rounded-xl bg-neutral-50 p-3 text-xs dark:bg-neutral-800/60">
                <div className="text-neutral-500 dark:text-neutral-400">
                  סטטוס
                </div>
                <div className="inline-flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium dark:bg-neutral-700">
                    סגור
                  </span>
                  {justified !== null && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${decisionColor}`}
                    >
                      {justified ? "מוצדקת" : "לא מוצדקת"}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1 rounded-xl bg-neutral-50 p-3 text-xs dark:bg-neutral-800/60">
                <div className="text-neutral-500 dark:text-neutral-400">
                  מחלקה מובילה
                </div>
                <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                  {dept?.name || "—"}
                </div>
              </div>
              <div className="space-y-1 rounded-xl bg-neutral-50 p-3 text-xs dark:bg-neutral-800/60">
                <div className="text-neutral-500 dark:text-neutral-400">
                  משך טיפול
                </div>
                <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                  {durationDays ? `${durationDays} ימים` : "—"}
                </div>
              </div>
              <div className="space-y-1 rounded-xl bg-neutral-50 p-3 text-xs dark:bg-neutral-800/60">
                <div className="text-neutral-500 dark:text-neutral-400">
                  תאריך סגירה
                </div>
                <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                  {closureDateHuman}
                </div>
              </div>
            </div>
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400">
            <div>נוצר: {createdDateHuman}</div>
            <div>עודכן: {closureDateHuman}</div>
            <div>מטפל/ת מוביל/ה: {assignee?.name || "—"}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,360px]">
        {/* Main column */}
        <div className="space-y-4">
          <Card>
            <h3 className="mb-2 text-sm font-semibold">תיאור האירוע המקורי</h3>
            <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-800 dark:text-neutral-200">
              {complaint.body}
            </p>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">תובנות עיקריות ללמידה</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  מיפוי מהיר של ההכרעה והגורמים שהובילו אליה
                </p>
              </div>
              {justified !== null && (
                <span
                  className={`rounded-full px-3 py-1 text-[12px] font-medium ${decisionColor}`}
                >
                  {justified ? "הפנייה נמצאה מוצדקת" : "הפנייה לא נמצאה מוצדקת"}
                </span>
              )}
            </div>
            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/50">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  גורם מטפל מרכזי
                </div>
                <div className="text-neutral-900 dark:text-neutral-50">
                  {assignee?.name || "—"}
                </div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/50">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  מקור הדיווח
                </div>
                <div className="text-neutral-900 dark:text-neutral-50">
                  {reporterTypeLabel}
                </div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/50">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  חזרות לטיפול
                </div>
                <div className="text-neutral-900 dark:text-neutral-50">
                  {complaint.returnInfo?.count
                    ? `${complaint.returnInfo.count} פעמים`
                    : "לא חזר לביצוע"}
                </div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/50">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  מזהה מתעדכן
                </div>
                <div className="text-neutral-900 dark:text-neutral-50">
                  {complaint.id}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">מכתב רשמי למשפחה</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  נוסח החתימה של מנהל/ת בית הספר שנשלח למשפחה
                </p>
              </div>
              {complaint.principalReview && (
                <div className="text-xs text-neutral-500 dark:text-neutral-400 text-left">
                  <div>נחתם ע"י {principalSigner?.name || "—"}</div>
                  <div>בתאריך {principalSignedAtHuman}</div>
                </div>
              )}
            </div>
            {complaint.principalReview ? (
              <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-800 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-100">
                <p className="whitespace-pre-wrap">
                  {complaint.principalReview.summary}
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed p-4 text-sm text-neutral-500">
                טרם הוזן מכתב חתום למקרה זה.
              </div>
            )}
            <div className="mt-4">
              {letterStatus === "ready" && letterViewerUrl ? (
                <div className="rounded-xl border bg-neutral-50 p-2 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <object
                    data={letterViewerUrl}
                    type="application/pdf"
                    className="h-[420px] w-full rounded-lg border border-neutral-200 shadow-sm dark:border-neutral-800"
                  >
                    <p className="p-4 text-sm">
                      לא ניתן להציג את המסמך בדפדפן.{" "}
                      <a
                        href={letterViewerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        לחצו כאן להורדה
                      </a>
                      .
                    </p>
                  </object>
                  <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                    <a
                      href={letterViewerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      הורדת המכתב כ-PDF
                    </a>
                    {letterMeta?.size
                      ? ` · ${Math.round(letterMeta.size / 1024)}KB`
                      : ""}
                  </div>
                </div>
              ) : letterStatus === "loading" ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                  טוען מסמך חתום…
                </div>
              ) : letterStatus === "missing" ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                  לא נמצא מסמך PDF בתיקייה הייעודית. ודאו שהופיע קובץ בשם{" "}
                  <span className="font-medium">{complaint.id}.pdf</span> בתיקיית
                  הדרייב המוגדרת.
                </div>
              ) : (
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                  אירעה שגיאה בטעינת המכתב מן הדרייב. נסו לרענן את הדף או פנו
                  לתמיכה.
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">היסטוריית תקשורת</h3>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {messageTimeline.length} הודעות
              </span>
            </div>
            {messageTimeline.length ? (
              <ol className="mt-4 space-y-3">
                {messageTimeline.map((msg) => (
                  <li
                    key={msg.id}
                    className="rounded-xl border bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="font-medium text-neutral-800 dark:text-neutral-100">
                        {resolveAuthorName(msg.authorId)}
                      </span>
                      <span>{formatDateTime(msg.createdAt)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-800 dark:text-neutral-100">
                      {msg.body}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                אין הודעות תיעוד למקרה זה.
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">טיוטת מטפל/ת (פנימי)</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  טקסט שהמטפל/ת הכין/ה לצורך תהליך הסגירה
                </p>
              </div>
              {complaint.assigneeLetter?.submittedAt && (
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  עודכן {formatDateTime(complaint.assigneeLetter.submittedAt)}
                </span>
              )}
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-800 dark:text-neutral-200">
              {complaint.assigneeLetter?.body || "—"}
            </div>
          </Card>
        </div>

        {/* Side column */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <section className="rounded-xl border bg-white p-5 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h4 className="mb-3 text-sm font-semibold">פרטי המדווח/ת</h4>
            <div className="space-y-2 text-neutral-800 dark:text-neutral-200">
              <div className="text-base font-medium">
                {reporter?.fullName || "—"}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {reporterTypeLabel}
              </div>
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
              {reporter?.type === "BISLAT" && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">תפקיד / גף</span>
                  <span>
                    {(reporter.jobTitle || "—") +
                      (reporter.flight ? ` · ${reporter.flight}` : "")}
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-2 font-medium">ניווט מהיר</div>
            <ul className="space-y-1">
              <li>
                <Link className="text-primary hover:underline" href="/closed">
                  ← חזרה לפניות סגורות
                </Link>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
