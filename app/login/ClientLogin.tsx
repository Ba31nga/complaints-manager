"use client";

import { signIn } from "next-auth/react"; // ← import NextAuth client helper
import Card from "@/app/components/Card";
import UIButton from "@/app/components/UIButton";

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
    <main className="flex min-h-screen items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-900">
      <div className="w-full max-w-md space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">ברוך/ה הבא/ה</h1>
          <button
            onClick={toggleTheme}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            aria-label="החלפת מצב תאורה"
          >
            מצב
          </button>
        </header>

        <Card>
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            התחבר/י בעזרת חשבון Google
          </p>

          <UIButton
            onClick={handleGoogle}
            type="button"
            className="w-full flex items-center justify-center gap-3"
            variant="primary"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M21.35 11.1H12v2.8h5.35c-.23 1.45-1.38 3.36-4.10 4.41-2.34.95-5.35.84-7.5-.3-3.02-1.98-3.45-6.11-.98-8.58 2.45-2.48 6.71-2.19 8.47-.84l1.76-1.76C16.66 3.16 14.01 2 11 2 6.03 2 2 6.03 2 11s4.03 9 9 9c4.86 0 8.83-3.43 9-8.7.01-.23.01-.47.0-.52z"
                fill="rgb(var(--primary))"
              />
            </svg>
            <span>התחברות עם Google</span>
          </UIButton>

          <p className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
            בלחיצה על הכפתור את/ה מאשר/ת את תנאי השימוש ומדיניות הפרטיות.
          </p>
        </Card>

        <footer className="text-center text-xs text-neutral-500 dark:text-neutral-500">
          © {new Date().getFullYear()} תפעול הדרכה
        </footer>
      </div>
    </main>
  );
}
