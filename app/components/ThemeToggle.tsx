"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  // null = unknown until mounted; true = dark; false = light
  const [isDark, setIsDark] = useState<boolean | null>(null);

  // On mount, read the current theme from <html> (set by your layout script)
  useEffect(() => {
    const dark = document.documentElement.classList.contains("dark");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(dark); // single state update → no cascading-render warning
  }, []);

  const toggle = () => {
    const next = !(isDark ?? false);
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  // While we don't know yet, render a neutral button to avoid mismatches
  if (isDark === null) {
    return (
      <button
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm
                   border-neutral-300 bg-white text-neutral-700
                   dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
        aria-label="טוען מצב ערכת נושא"
        disabled
      >
        …
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm
                 border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50
                 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
      aria-label="החלפת ערכת נושא"
    >
      {isDark ? (
        <>
          {/* Sun icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79zm10.48 0l1.8-1.79l1.79 1.79l-1.79 1.79zM12 4V1h0v3zm0 19v-3h0v3zM4 12H1h3zm22 0h-3h3zM6.76 19.16l-1.8 1.79l-1.79-1.79l1.79-1.79zm10.48 0l1.8 1.79l1.79-1.79l-1.79-1.79zM12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8z"
            />
          </svg>
          מצב בהיר
        </>
      ) : (
        <>
          {/* Moon icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M20 15.31A8 8 0 0 1 9.69 5c.23-.78-.61-1.42-1.33-1.02A10 10 0 1 0 22.02 15.64c.4-.72-.24-1.56-1.02-1.33Z"
            />
          </svg>
          מצב כהה
        </>
      )}
    </button>
  );
}
