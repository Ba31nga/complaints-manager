"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import ThemeToggle from "@/app/components/ThemeToggle";
import { signOut } from "next-auth/react"; // ✅ add this

type Role = "EMPLOYEE" | "MANAGER" | "ADMIN" | "PRINCIPAL";

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  // Get role from session
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const role =
    sessionRole &&
    ["EMPLOYEE", "MANAGER", "ADMIN", "PRINCIPAL"].includes(sessionRole)
      ? (sessionRole as Role)
      : "EMPLOYEE";

  const [sheetName, setSheetName] = useState<string | null>(null);

  // Resolve display name from Users sheet by email
  useEffect(() => {
    const email = session?.user?.email;
    if (!email) return;

    const ctrl = new AbortController();
    fetch(`/api/users/by-email?email=${encodeURIComponent(email)}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) return;
        const { data } = (await res.json()) as {
          data: { name?: string } | null;
        };
        setSheetName((data?.name || "").trim() || null);
      })
      .catch(() => {});

    return () => ctrl.abort();
  }, [session?.user?.email]);

  // Role-based nav config
  const allLinks = [
    {
      href: "/",
      label: "פניות פתוחות",
      roles: ["ADMIN", "PRINCIPAL"] as Role[],
    },
    {
      href: "/closed",
      label: "פניות סגורות",
      roles: ["ADMIN", "PRINCIPAL"] as Role[],
    },
    {
      href: "/stats",
      label: "סטטיסטיקה",
      roles: ["MANAGER", "ADMIN"] as Role[],
    },
    { href: "/admin", label: "דף ניהול", roles: ["ADMIN"] as Role[] },
  ];

  const links = allLinks.filter((l) => l.roles.includes(role));
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  useEffect(() => {
    setOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header
      className="sticky top-0 z-40 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      dir="rtl"
    >
      <nav className="w-full">
        <div className="container-max flex flex-wrap items-center justify-between gap-4 py-3">
          <div className="flex w-full items-center justify-between gap-3 md:w-auto md:flex-none">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-neutral-100"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-lg">
                פ
              </span>
              פניות לקוח
            </Link>
            <button
              onClick={() => setOpen((s) => !s)}
              aria-label={open ? "סגירת תפריט" : "פתיחת תפריט"}
              aria-expanded={open}
              aria-controls="mobile-nav"
              className="md:hidden inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
            >
              <span>{open ? "סגור" : "תפריט"}</span>
              <span aria-hidden="true">{open ? "✕" : "☰"}</span>
            </button>
          </div>

          {/* Desktop nav */}
          <div className="hidden flex-1 items-center justify-center md:flex">
            <div className="flex flex-wrap items-center gap-1 rounded-full border border-transparent px-2 py-1">
              {links.length === 0 ? (
                <span className="text-xs text-neutral-500">
                  אין פריטים זמינים עבורך
                </span>
              ) : (
                links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "px-3 py-2 text-sm transition",
                      "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
                      "dark:text-neutral-200 dark:hover:bg-neutral-800 dark:hover:text-white",
                      isActive(l.href) &&
                        "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white rounded-md"
                    )}
                  >
                    {l.label}
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Right controls (desktop) */}
          <div className="relative hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((s) => !s)}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                  {(sheetName || session?.user?.name || "א")[0]}
                </span>
                <span>פרטי משתמש</span>
              </button>
              {userMenuOpen && (
                <div
                  className="absolute left-0 mt-2 w-72 rounded-lg border border-neutral-200 bg-white p-4 text-sm shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
                  role="menu"
                >
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-400">
                    חשבון
                  </div>
                  <dl className="space-y-2 text-neutral-800 dark:text-neutral-200">
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">שם</dt>
                      <dd className="font-medium">{sheetName || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">אימייל</dt>
                      <dd className="truncate text-left">{session?.user?.email || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">תפקיד</dt>
                      <dd className="font-medium">
                        {(session?.user as { role?: string } | undefined)?.role ||
                          "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">מחלקה</dt>
                      <dd className="font-medium">
                        {(session?.user as { department?: string } | undefined)
                          ?.department || "—"}
                      </dd>
                    </div>
                  </dl>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="mt-4 w-full rounded-md border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  >
                    התנתקות
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div
            id="mobile-nav"
            className="md:hidden border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="container-max flex flex-col gap-4 py-4">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "px-3 py-2 text-sm",
                    "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
                    "dark:text-neutral-200 dark:hover:bg-neutral-800 dark:hover:text-white",
                    isActive(l.href) &&
                      "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                  )}
                >
                  {l.label}
                </Link>
              ))}
              <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                <div className="mb-2 text-xs text-neutral-500">מצב תצוגה</div>
                <ThemeToggle />
              </div>
              <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                <div className="mb-2 text-xs text-neutral-500">פרטי משתמש</div>
                <div className="space-y-1 text-neutral-800 dark:text-neutral-200">
                  <div>{sheetName || "—"}</div>
                  <div className="text-xs text-neutral-500">
                    {session?.user?.email || "—"}
                  </div>
                  <div className="text-xs">
                    {(session?.user as { role?: string } | undefined)?.role || "—"}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setOpen(false);
                    setUserMenuOpen(false);
                    signOut({ callbackUrl: "/login" });
                  }}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                >
                  התנתקות
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
