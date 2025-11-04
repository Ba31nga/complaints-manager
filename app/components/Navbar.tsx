"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [sheetName, setSheetName] = useState<string | null>(null);

  // Prefer NextAuth session role; fallback to localStorage for mock/dev
  useEffect(() => {
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;
    if (
      sessionRole &&
      ["EMPLOYEE", "MANAGER", "ADMIN", "PRINCIPAL"].includes(sessionRole)
    ) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setRole(sessionRole as Role);
      return;
    }
    const stored = (localStorage.getItem("role") as Role | null) ?? "EMPLOYEE";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(stored);
  }, [session?.user]);

  // Resolve display name from Users sheet by email
  useEffect(() => {
    const email = session?.user?.email || "";
    if (!email) {
      setSheetName(null);
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/users/by-email?email=${encodeURIComponent(email)}`,
          { cache: "no-store", signal: ctrl.signal }
        );
        if (!res.ok) return;
        const { data } = (await res.json()) as {
          data: { name?: string } | null;
        };
        setSheetName((data?.name || "").trim() || null);
      } catch {}
    })();
    return () => ctrl.abort();
  }, [session?.user?.email]);

  // Role-based nav config
  const allLinks = [
    {
      href: "/",
      label: "תלונות פתוחות",
      roles: ["EMPLOYEE", "MANAGER", "ADMIN", "PRINCIPAL"] as Role[],
    },
    {
      href: "/closed",
      label: "תלונות סגורות",
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

  return (
    <header
      className="sticky top-0 z-40 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      dir="rtl"
    >
      <nav className="w-full">
        <div className="container-max flex h-14 items-center justify-between">
          {/* Brand */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 text-base font-semibold text-neutral-900 dark:text-neutral-100"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
              פ
            </span>
            פניות לקוח
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "px-3 py-2 text-sm transition",
                  "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900",
                  "dark:text-neutral-200 dark:hover:bg-neutral-800 dark:hover:text-white",
                  isActive(l.href) &&
                    "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right controls (desktop) */}
          <div className="hidden md:flex items-center gap-2 px-3 relative">
            <ThemeToggle />
            {/* User details dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((s) => !s)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                פרטי משתמש
              </button>
              {userMenuOpen && (
                <div
                  className="absolute left-0 mt-2 w-64 rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
                  role="menu"
                >
                  <div className="mb-2 text-[11px] text-neutral-500">חשבון</div>
                  <div className="space-y-1 text-neutral-800 dark:text-neutral-200">
                    <div>
                      <span className="text-neutral-500">שם: </span>
                      {sheetName || "—"}
                    </div>
                    <div>
                      <span className="text-neutral-500">אימייל: </span>
                      {session?.user?.email || "—"}
                    </div>
                    <div>
                      <span className="text-neutral-500">תפקיד: </span>
                      {(session?.user as { role?: string } | undefined)?.role ||
                        "—"}
                    </div>
                    <div>
                      <span className="text-neutral-500">מחלקה: </span>
                      {(session?.user as { department?: string } | undefined)
                        ?.department || "—"}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* ✅ Logout button */}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              התנתקות
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen((s) => !s)}
            aria-label="פתיחת תפריט"
            className="md:hidden inline-flex items-center justify-center rounded-md border px-2.5 py-1.5
                       border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50
                       dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-col gap-1 py-2">
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
              <div className="px-3 pt-1 flex items-center justify-between">
                <ThemeToggle />
                <button
                  onClick={() => {
                    /* no-op in mobile for now */
                  }}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                  disabled
                  title="זמין בתצוגת מחשב"
                >
                  פרטי משתמש
                </button>
                {/* ✅ Logout button (mobile) */}
                <button
                  onClick={() => {
                    setOpen(false);
                    signOut({ callbackUrl: "/login" });
                  }}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
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
