"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "@/app/components/ThemeToggle";
import { signOut } from "next-auth/react"; // ✅ add this

type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("EMPLOYEE");

  // Read mock role from localStorage (UI-only)
  useEffect(() => {
    const stored = (localStorage.getItem("role") as Role | null) ?? "EMPLOYEE";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(stored);
  }, []);

  // Role-based nav config
  const allLinks = [
    {
      href: "/",
      label: "תלונות פתוחות",
      roles: ["EMPLOYEE", "MANAGER", "ADMIN"] as Role[],
    },
    {
      href: "/my-closed",
      label: "תלונות שסגרתי",
      roles: ["EMPLOYEE", "MANAGER", "ADMIN"] as Role[],
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
        <div className="flex h-14 items-center justify-between">
          {/* Brand */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 text-base font-semibold text-neutral-900 dark:text-neutral-100"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
              ת
            </span>
            תלונות
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
          <div className="hidden md:flex items-center gap-2 px-3">
            <ThemeToggle />
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
