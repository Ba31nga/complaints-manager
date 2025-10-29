/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { complaints, users } from "@/app/lib/mock";
import type { Complaint, Role } from "@/app/lib/types";

const DEADLINE_DAYS = 7;

/* -------------------- Helpers -------------------- */
function diffDays(from: Date, to = new Date()) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
function daysLeft(createdAt: string) {
  const age = diffDays(new Date(createdAt));
  return DEADLINE_DAYS - age;
}
function urgencyMeta(createdAt: string) {
  const age = diffDays(new Date(createdAt));
  if (age > 7)
    return {
      label: "באיחור",
      rank: 3,
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-400",
    };
  if (age > 5)
    return {
      label: "דחוף",
      rank: 2,
      bg: "bg-orange-100 dark:bg-orange-900/30",
      text: "text-orange-700 dark:text-orange-400",
    };
  if (age > 3)
    return {
      label: "בינוני",
      rank: 1,
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      text: "text-yellow-700 dark:text-yellow-400",
    };
  return {
    label: "נמוך",
    rank: 0,
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
  };
}

type Viewer = { role: Role; userId: string; departmentId?: string };

function readViewerFallback(): Viewer {
  const role = (localStorage.getItem("role") as Role | null) ?? "EMPLOYEE";
  const userId = localStorage.getItem("userId") ?? "u2";
  let departmentId = localStorage.getItem("departmentId") ?? "";

  try {
    const u = users.find((x) => x.id === userId);
    if (u && !departmentId) departmentId = u.departmentId;
  } catch {
    /* noop */
  }

  return { role, userId, departmentId };
}

/* -------------------- Component -------------------- */
export default function OpenComplaintsPage() {
  const [viewer, setViewer] = useState<Viewer | null>(null);

  useEffect(() => {
    setViewer(readViewerFallback());
    const onStorage = (e: StorageEvent) => {
      if (["role", "userId", "departmentId"].includes(e.key ?? "")) {
        setViewer(readViewerFallback());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const filtered = useMemo(() => {
    if (!viewer) return [];

    // Only active/ongoing complaints (not closed)
    const activeStatuses: Complaint["status"][] = [
      "OPEN",
      "ASSIGNED",
      "IN_PROGRESS",
      "AWAITING_PRINCIPAL_REVIEW",
    ];

    const openish = complaints.filter((c) => activeStatuses.includes(c.status));

    if (viewer.role === "ADMIN" || viewer.role === "PRINCIPAL") return openish;

    if (viewer.role === "MANAGER") {
      return openish.filter((c) => c.departmentId === viewer.departmentId);
    }

    // EMPLOYEE: only assigned to them
    return openish.filter((c) => c.assigneeUserId === viewer.userId);
  }, [viewer]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ua = urgencyMeta(a.createdAt).rank;
      const ub = urgencyMeta(b.createdAt).rank;
      if (ub !== ua) return ub - ua;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [filtered]);

  if (!viewer) return null;

  /* -------------------- UI -------------------- */
  return (
    <div className="p-4" dir="rtl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">פניות פתוחות</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            מוצגות לפי דחיפות — יעד טיפול: {DEADLINE_DAYS} ימים.
          </p>
        </div>

        <div className="text-xs text-neutral-600 dark:text-neutral-400">
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
              ? users.find((u) => u.id === c.assigneeUserId) ?? null
              : null;

            return (
              <Link
                key={c.id}
                href={`/complaints/${c.id}`}
                className={`rounded-lg border p-4 shadow-sm transition hover:shadow-md
                            bg-white dark:bg-neutral-900 dark:border-neutral-800 ${meta.bg}`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {c.title}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                </div>

                <p className="mt-2 line-clamp-3 text-sm text-neutral-700 dark:text-neutral-300">
                  {c.body}
                </p>

                {/* Reporter info (optional for admin/managers) */}
                {viewer.role !== "EMPLOYEE" && c.reporter && (
                  <div className="mt-3 text-xs text-neutral-700 dark:text-neutral-300">
                    מאת:{" "}
                    <span className="font-medium">{c.reporter.fullName}</span> (
                    {c.reporter.email})
                  </div>
                )}

                <div className="mt-3 grid gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                  <div>
                    נוצרה: {new Date(c.createdAt).toLocaleDateString("he-IL")}
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
