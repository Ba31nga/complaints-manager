// FILE: app/(protected)/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Complaint, Role, User, Department } from "@/app/lib/types";

const DEADLINE_DAYS = 7;

/* -------------------- Date helpers -------------------- */
function diffDays(from: Date, to = new Date()) {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
function parseISOOrFallback(s: string): Date {
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : new Date(0);
}
function daysLeft(createdAt: string) {
  const age = diffDays(parseISOOrFallback(createdAt));
  return DEADLINE_DAYS - age;
}
function urgencyMeta(createdAt: string) {
  const age = diffDays(parseISOOrFallback(createdAt));
  if (age > 7)
    return {
      label: "באיחור",
      rank: 3,
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-400",
    } as const;
  if (age > 5)
    return {
      label: "דחוף",
      rank: 2,
      bg: "bg-orange-100 dark:bg-orange-900/30",
      text: "text-orange-700 dark:text-orange-400",
    } as const;
  if (age > 3)
    return {
      label: "בינוני",
      rank: 1,
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      text: "text-yellow-700 dark:text-yellow-400",
    } as const;
  return {
    label: "נמוך",
    rank: 0,
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
  } as const;
}

/* -------------------- Viewer -------------------- */
type Viewer = { role: Role; userId: string; departmentId?: string };

function readViewerFallback(users: User[] = []): Viewer {
  const role = (localStorage.getItem("role") as Role | null) ?? "EMPLOYEE";
  const userId = localStorage.getItem("userId") ?? "u2";
  let departmentId = localStorage.getItem("departmentId") ?? "";
  if (!departmentId) {
    const u = users.find((x) => x.id === userId);
    if (u) departmentId = u.departmentId;
  }
  return { role, userId, departmentId };
}

/* -------------------- Page -------------------- */
type AppData = {
  users: User[];
  departments: Department[];
  complaints: Complaint[];
};

export default function OpenComplaintsPage() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Build a quick lookup map for assignees
  const userById = useMemo(() => {
    const m = new Map<string, User>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  // Load from API (users + departments + complaints)
  useEffect(() => {
    const ctrl = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch("/api/app-data", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(await res.text());

        const { data }: { data: AppData } = await res.json();
        setUsers(data.users);
        setComplaints(data.complaints);
        setViewer(readViewerFallback(data.users));
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "Failed to load data";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, []);

  // Keep viewer in sync if user switches role/user in another tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (["role", "userId", "departmentId"].includes(e.key ?? "")) {
        setViewer(readViewerFallback(users));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [users]);

  const filtered = useMemo((): Complaint[] => {
    if (!viewer) return [];
    const active: Complaint["status"][] = [
      "OPEN",
      "ASSIGNED",
      "IN_PROGRESS",
      "AWAITING_PRINCIPAL_REVIEW",
    ];
    const openish = complaints.filter((c) => active.includes(c.status));

    if (viewer.role === "ADMIN" || viewer.role === "PRINCIPAL") return openish;
    if (viewer.role === "MANAGER")
      return openish.filter((c) => c.departmentId === viewer.departmentId);
    return openish.filter((c) => c.assigneeUserId === viewer.userId);
  }, [viewer, complaints]);

  const sorted = useMemo(() => {
    // Sort by urgency rank desc, then createdAt desc (newest first)
    return [...filtered].sort((a, b) => {
      const ua = urgencyMeta(a.createdAt).rank;
      const ub = urgencyMeta(b.createdAt).rank;
      if (ub !== ua) return ub - ua;

      const ta = parseISOOrFallback(a.createdAt).getTime();
      const tb = parseISOOrFallback(b.createdAt).getTime();
      return tb - ta;
    });
  }, [filtered]);

  if (loading) {
    return (
      <div className="p-4" dir="rtl">
        <div
          className="rounded-xl border bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          role="status"
          aria-live="polite"
        >
          טוען נתונים…
        </div>
      </div>
    );
  }
  if (err) {
    return (
      <div className="p-4" dir="rtl">
        <div className="rounded-xl border bg-red-100 p-6 text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          שגיאה בטעינת הנתונים: {err}
        </div>
      </div>
    );
  }
  if (!viewer) return null;

  return (
    <div className="p-4" dir="rtl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">פניות פתוחות</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            מוצגות לפי דחיפות — יעד טיפול: {DEADLINE_DAYS} ימים.
          </p>
        </div>

        <div
          className="text-xs text-neutral-600 dark:text-neutral-400"
          aria-label="viewer info"
        >
          תפקיד: <span className="font-medium">{viewer.role}</span> · משתמש:{" "}
          <span className="font-mono">{viewer.userId}</span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          אין פניות תואמות.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((c) => {
            const meta = urgencyMeta(c.createdAt);
            const left = daysLeft(c.createdAt);
            const assignee = c.assigneeUserId
              ? userById.get(c.assigneeUserId) ?? null
              : null;

            return (
              <Link
                key={c.id}
                href={`/complaints/${c.id}`}
                className={`rounded-lg border p-4 shadow-sm transition hover:shadow-md bg-white dark:bg-neutral-900 dark:border-neutral-800 ${meta.bg}`}
                aria-label={`פתח תלונה: ${c.title}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {c.title}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.text}`}
                    title={`דחיפות: ${meta.label}`}
                  >
                    {meta.label}
                  </span>
                </div>

                <p className="mt-2 line-clamp-3 text-sm text-neutral-700 dark:text-neutral-300">
                  {c.body}
                </p>

                {viewer.role !== "EMPLOYEE" && c.reporter && (
                  <div className="mt-3 text-xs text-neutral-700 dark:text-neutral-300">
                    מאת:{" "}
                    <span className="font-medium">{c.reporter.fullName}</span> (
                    {c.reporter.email})
                  </div>
                )}

                <div className="mt-3 grid gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                  <div>
                    נוצרה:{" "}
                    {parseISOOrFallback(c.createdAt).toLocaleDateString(
                      "he-IL",
                      { timeZone: "Asia/Jerusalem" }
                    )}
                  </div>
                  <div>
                    זמן עד יעד:{" "}
                    {left < 0 ? (
                      <span className="text-red-700 dark:text-red-400">
                        באיחור {Math.abs(left)} ימים
                      </span>
                    ) : (
                      <span className="text-neutral-800 dark:text-neutral-200">
                        {left} ימים
                      </span>
                    )}
                  </div>
                  {assignee && <div>מוקצה ל: {assignee.name}</div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
