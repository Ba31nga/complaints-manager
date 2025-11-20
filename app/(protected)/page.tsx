// FILE: app/(protected)/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Complaint, Role, User, Department } from "@/app/lib/types";
import Card from "@/app/components/Card";
import StatusPill from "@/app/components/StatusPill";

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
  // Return only a simple label + rank. Visual treatment is handled with the
  // minimal two-color system (primary + neutral) elsewhere.
  const age = diffDays(parseISOOrFallback(createdAt));
  if (age > 7) return { label: "באיחור", rank: 3 } as const;
  if (age > 5) return { label: "דחוף", rank: 2 } as const;
  if (age > 3) return { label: "בינוני", rank: 1 } as const;
  return { label: "נמוך", rank: 0 } as const;
}

/* -------------------- Viewer -------------------- */
type Viewer = { role: Role; userId: string; departmentId?: string };

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (typeof err === "object" && err) {
    const n = (err as { name?: unknown }).name;
    if (n === "AbortError") return true;
    const c = (err as { code?: unknown }).code;
    if (c === 20) return true; // old Firefox
  }
  return false;
}

/* -------------------- Page -------------------- */
type AppData = {
  users: User[];
  departments: Department[];
  complaints: Complaint[];
};

export default function OpenComplaintsPage() {
  const { data: session, status } = useSession(); // ← NextAuth session
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [assigneeUserId, setAssigneeUserId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const dedupedUsers = useMemo(() => {
    const seen = new Set<string>();
    return users.filter((u) => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
  }, [users]);

  const userById = useMemo(() => {
    const m = new Map<string, User>();
    for (const u of dedupedUsers) m.set(u.id, u);
    return m;
  }, [dedupedUsers]);

  useEffect(() => {
    const ctrl = new AbortController();
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // 1) Load app data (users + complaints)
        const res = await fetch("/api/app-data", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(await res.text());
        const { data }: { data: AppData } = await res.json();
        if (!alive) return;
        setUsers(data.users);
        setDepartments(data.departments);
        setComplaints(data.complaints);

        // 2) Resolve logged-in user (by email → sheet user)
        let resolved: User | null = null;
        const email = session?.user?.email?.toLowerCase();
        if (email) {
          try {
            const meRes = await fetch(
              `/api/users/by-email?email=${encodeURIComponent(email)}`,
              { cache: "no-store", signal: ctrl.signal }
            );
            if (meRes.ok) {
              const me: { data: User | null } = await meRes.json();
              resolved = me.data ?? null;
            }
          } catch (e) {
            if (!isAbortError(e)) {
              // do not block UI on this; we’ll fallback below
              console.warn("by-email lookup failed:", e);
            }
          }
        }

        // 3) Fallback: if not resolved by email, pick first user (UI remains usable)
        const chosen = resolved ?? data.users[0] ?? null;
        if (!alive) return;
        if (chosen) {
          setViewer({
            userId: chosen.id,
            role: chosen.role,
            departmentId: chosen.departmentId,
          });
        } else {
          setViewer(null);
        }
      } catch (e) {
        if (isAbortError(e)) return;
        const msg = e instanceof Error ? e.message : "Failed to load data";
        if (alive) setErr(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [session?.user?.email, status]); // rerun if login state changes

  // Debounce q for smoother client-side filtering
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  // No need for local storage sync anymore as we only use NextAuth session

  const filtered = useMemo((): Complaint[] => {
    if (!viewer) return [];
    const active: Complaint["status"][] = [
      "OPEN",
      "ASSIGNED",
      "IN_PROGRESS",
      "AWAITING_PRINCIPAL_REVIEW",
    ];
    let openish = complaints.filter((c) => active.includes(c.status));

    // Role scope
    if (viewer.role === "ADMIN" || viewer.role === "PRINCIPAL") {
      // see all active
    } else if (viewer.role === "MANAGER") {
      openish = openish.filter((c) => c.departmentId === viewer.departmentId);
    } else {
      openish = openish.filter((c) => c.assigneeUserId === viewer.userId);
    }

    // Additional filters
    if (qDebounced.trim()) {
      const needle = qDebounced.trim().toLowerCase();
      openish = openish.filter((c) =>
        (c.title + " " + c.body).toLowerCase().includes(needle)
      );
    }
    if (departmentId) {
      openish = openish.filter((c) => c.departmentId === departmentId);
    }
    if (assigneeUserId) {
      openish = openish.filter((c) => c.assigneeUserId === assigneeUserId);
    }
    if (statusFilter) {
      openish = openish.filter((c) => {
        if (statusFilter === "UNASSIGNED") return !c.assigneeUserId;
        if (statusFilter === "OPEN_ONLY") return c.status === "OPEN";
        if (statusFilter === "AWAITING_REVIEW_ONLY")
          return c.status === "AWAITING_PRINCIPAL_REVIEW";
        return true;
      });
    }

    return openish;
  }, [
    viewer,
    complaints,
    qDebounced,
    departmentId,
    assigneeUserId,
    statusFilter,
  ]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ua = urgencyMeta(a.createdAt).rank;
      const ub = urgencyMeta(b.createdAt).rank;
      if (ub !== ua) return ub - ua;
      const ta = parseISOOrFallback(a.createdAt).getTime();
      const tb = parseISOOrFallback(b.createdAt).getTime();
      return tb - ta;
    });
  }, [filtered]);

  // While session is loading, keep the spinner so we don’t flash the fallback viewer
  if (loading || status === "loading") {
    return (
      <div className="p-4" dir="rtl">
        <div className="card p-6 flex items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
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
        <div className="rounded-xl border bg-red-100 p-6 text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          שגיאה בטעינת הנתונים: {err}
        </div>
      </div>
    );
  }
  if (!viewer) {
    return (
      <div className="p-4" dir="rtl">
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          לא נמצא משתמש תואם לחשבון המחובר.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 container-max" dir="rtl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">פניות פתוחות</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            מוצגות לפי דחיפות — יעד טיפול: {DEADLINE_DAYS} ימים.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        className={`mb-4 grid gap-3 sm:grid-cols-3 ${
          viewer.role === "ADMIN" || viewer.role === "PRINCIPAL"
            ? "md:grid-cols-4"
            : ""
        }`}
      >
        <input
          className="w-full rounded-md border px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900"
          placeholder="חיפוש חופשי (כותרת/תוכן)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="w-full rounded-md border px-2 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        >
          <option value="">כל המחלקות</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className="w-full rounded-md border px-2 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900"
          value={assigneeUserId}
          onChange={(e) => setAssigneeUserId(e.target.value)}
        >
          <option value="">כל המטפלים/ות</option>
          {dedupedUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {(viewer.role === "ADMIN" || viewer.role === "PRINCIPAL") && (
          <select
            className="w-full rounded-md border px-2 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">כל המצבים</option>
            <option value="UNASSIGNED">פניות ללא הקצאה</option>
            <option value="OPEN_ONLY">פניות פתוחות</option>
            <option value="AWAITING_REVIEW_ONLY">ממתינות לאישור מנהל/ת</option>
          </select>
        )}
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

            // apply an urgency class to the whole card so it gets a colored
            // blinking/pulsing background. Medium (rank===1) -> yellow,
            // urgent/late (rank>=2) -> red.
            const cardClass = `transition hover:shadow-md ${
              meta.rank >= 2
                ? "urgency-critical"
                : meta.rank === 1
                ? "urgency-warning"
                : ""
            }`;

            return (
              <Link
                key={c.id}
                href={`/complaints/${c.id}`}
                aria-label={`פתח תלונה: ${c.title}`}
              >
                <Card className={cardClass}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {c.title}
                      </h2>
                      <p className="mt-2 line-clamp-3 text-sm text-neutral-700 dark:text-neutral-300">
                        {c.body}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusPill
                        label={meta.label}
                        tone={meta.rank >= 2 ? "accent" : "neutral"}
                      />
                      <div className="text-xs text-neutral-600 dark:text-neutral-400">
                        {parseISOOrFallback(c.createdAt).toLocaleDateString(
                          "he-IL",
                          { timeZone: "Asia/Jerusalem" }
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                    <div>
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
                    <div>{assignee ? `מוקצה ל: ${assignee.name}` : "—"}</div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
