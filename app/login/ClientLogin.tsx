"use client";

export default function ClientLogin() {
  const handleGoogle = () => {
    // e.g. NextAuth: signIn('google', { callbackUrl: '/' })
    console.log("Google sign-in clicked");
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
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path
                fill="#FFC107"
                d="M43.611 20.083H42V20H24v8h11.303C33.731 32.91 29.267 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.153 7.957 3.043l5.657-5.657C34.943 6.053 29.741 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"
              />
              <path
                fill="#FF3D00"
                d="M6.306 14.691l6.571 4.817C14.421 15.633 18.839 12 24 12c3.059 0 5.842 1.153 7.957 3.043l5.657-5.657C34.943 6.053 29.741 4 24 4 16.318 4 9.816 8.337 6.306 14.691z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.192 0 9.94-1.99 13.509-5.229l-6.222-5.262C29.122 35.475 26.671 36 24 36c-5.239 0-9.676-3.108-11.57-7.573l-6.56 5.053C9.352 39.556 16.11 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.611 20.083H42V20H24v8h11.303c-1.058 3.005-3.31 5.368-6.016 6.875l.001-.001 6.222 5.262C34.907 40.234 44 34 44 24c0-1.341-.138-2.651-.389-3.917z"
              />
            </svg>
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
