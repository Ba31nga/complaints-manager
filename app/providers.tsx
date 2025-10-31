"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";

function initTheme() {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") return "dark";
    if (stored === "light") return "light";
    // fallback to system preference
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const t = initTheme();
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
