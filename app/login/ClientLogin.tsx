"use client";

import { signIn } from "next-auth/react"; // ← import NextAuth client helper

export default function ClientLogin() {
  const handleGoogle = () => {
    // Trigger NextAuth's Google OAuth flow
    signIn("google", { callbackUrl: "/" });
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    const nextDark = !html.classList.contains("dark");
    html.classList.toggle("dark", nextDark);
    try {
      localStorage.setItem("theme", nextDark ? "dark" : "light");
    } catch {}
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">ברוך/ה הבא/ה</h1>
          <button
            onClick={toggleTheme}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            aria-label="החלפת מצב תאורה"
          >
            מצב תאורה
          </button>
        </header>

        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            התחבר/י בעזרת חשבון Google
          </p>

          <button
            onClick={handleGoogle}
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium shadow-sm hover:bg-neutral-50 active:scale-[0.99] dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            {/* (keep your SVG icon here) */}
            <span>התחברות עם Google</span>
          </button>

          <p className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
            בלחיצה על הכפתור את/ה מאשר/ת את תנאי השימוש ומדיניות הפרטיות.
          </p>
        </section>

        <footer className="text-center text-xs text-neutral-500 dark:text-neutral-500">
          © {new Date().getFullYear()} תפעול הדרכה
        </footer>
      </div>
    </main>
  );
}
