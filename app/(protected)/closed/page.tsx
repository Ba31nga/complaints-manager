"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Complaint, Department, Role, User } from "@/app/lib/types";
import Card from "@/app/components/Card";

type Viewer = { role: Role | null; userId?: string | null };

type ComplaintsResp = {
  data: { items: Complaint[]; nextCursor: string | null };
};

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

export default function ClosedComplaintsPage() {
  const { data: session, status } = useSession();
  const [viewer, setViewer] = useState<Viewer>({ role: null });

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [assigneeUserId, setAssigneeUserId] = useState<string>("");

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

  const canSee = useMemo(() => {
    return viewer.role === "ADMIN" || viewer.role === "PRINCIPAL";
  }, [viewer.role]);

  useEffect(() => {
    setViewer({
      role: ((session?.user as { role?: string } | undefined)?.role ||
        null) as Role | null,
      userId: (session?.user as { id?: string } | undefined)?.id ?? null,
    });
  }, [session?.user]);

  // Load users + departments once for filter dropdowns
  useEffect(() => {
    const ctrl = new AbortController();
    let alive = true;
    (async () => {
      try {
        setErr(null);
        const [u, d] = await Promise.all([
          api<{ data: User[] }>("/api/users", { signal: ctrl.signal }),
          api<{ data: Department[] }>("/api/departments", {
            signal: ctrl.signal,
          }),
        ]);
        if (!alive) return;
        setUsers(u.data);
        setDepartments(d.data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, []);

  // Debounce q for smoother search
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Fetch complaints whenever filters change
  useEffect(() => {
    const ctrl = new AbortController();
    let alive = true;
    (async () => {
      if (!canSee || status === "loading") return;
      try {
        setLoading(true);
        setErr(null);
        const params = new URLSearchParams();
        params.set("status", "CLOSED");
        if (qDebounced.trim()) params.set("q", qDebounced.trim());
        if (departmentId) params.set("departmentId", departmentId);
        if (assigneeUserId) params.set("assigneeUserId", assigneeUserId);
        params.set("limit", "100");
        const { data } = await api<ComplaintsResp>(
          `/api/complaints?${params.toString()}`,
          { signal: ctrl.signal }
        );
        if (!alive) return;
        setComplaints(data.items);
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
  }, [qDebounced, departmentId, assigneeUserId, canSee, status]);

  if (status === "loading" || (loading && complaints.length === 0)) {
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

  if (!canSee) {
    return (
      <div className="p-4" dir="rtl">
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          אין לך הרשאה לצפות בפניות סגורות.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 container-max" dir="rtl">
      <div className="mb-6">
        <div>
          <h1 className="text-2xl font-semibold">פניות סגורות</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            חיפוש וסינון לפי מחלקה/מטפל/ת.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
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
      </div>

      {err && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
          שגיאה בטעינת הנתונים: {err}
        </div>
      )}

      {complaints.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          לא נמצאו פניות סגורות תואמות.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {complaints.map((c) => (
            <Link
              key={c.id}
              href={`/complaints/closed/${c.id}`}
              aria-label={`פתח פנייה: ${c.title}`}
            >
              <Card className="transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {c.title}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm text-neutral-700 dark:text-neutral-300">
                      {c.body}
                    </p>
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    {new Date(c.createdAt).toLocaleDateString("he-IL", {
                      timeZone: "Asia/Jerusalem",
                    })}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                  <div>סטטוס: סגור</div>
                  <div>
                    {c.assigneeUserId
                      ? userById.get(c.assigneeUserId)?.name ?? "—"
                      : "—"}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
