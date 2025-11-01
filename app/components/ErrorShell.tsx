"use client";
import React, { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

type Props = {
  title: string;
  message: string;
  showRetry?: boolean;
  onRetry?: () => void;
  reportSubject?: string;
};

export default function ErrorShell({
  title,
  message,
  showRetry = false,
  onRetry,
  reportSubject = "דווח%20שגיאה",
}: Props) {
  const easterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = easterRef.current;
    if (!el) return;

    const seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
    let pos = 0;

    function triggerEaster() {
      if (!el) return;
      el.innerHTML = "";
      const wrapper = document.createElement("div");
      wrapper.className = "confetti";
      el.appendChild(wrapper);
      const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];
      for (let i = 0; i < 60; i++) {
        const d = document.createElement("div");
        d.className = "dot";
        d.style.left = Math.random() * 100 + "%";
        d.style.top = Math.random() * 10 + "%";
        d.style.background = colors[Math.floor(Math.random() * colors.length)];
        d.style.animationDelay = Math.random() * 400 + "ms";
        d.style.transform = "translateY(-20vh)";
        wrapper.appendChild(d);
      }
      setTimeout(() => {
        if (el) el.innerHTML = "";
      }, 2200);
    }

    function onKey(e: KeyboardEvent) {
      if (e.keyCode === seq[pos]) {
        pos++;
        if (pos === seq.length) {
          pos = 0;
          triggerEaster();
        }
      } else pos = 0;
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 overflow-hidden bg-white dark:bg-[#000000] flex items-center justify-center"
    >
      <main className="relative w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Decorative background blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <svg
            className="absolute right-0 top-0 transform translate-x-16 -translate-y-16 opacity-30"
            width="420"
            height="420"
            viewBox="0 0 420 420"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="g1" x1="0" x2="1">
                <stop offset="0%" stopColor="#0ea5a4" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.06" />
              </linearGradient>
            </defs>
            <circle cx="210" cy="210" r="180" fill="url(#g1)" />
          </svg>
        </div>

        <section className="flex flex-col md:flex-row items-center gap-8 bg-transparent w-full py-12 md:py-20">
          <div className="flex-shrink-0 flex items-center justify-center">
            <div className="rounded-2xl bg-white/90 dark:bg-white/5 p-3 shadow-md">
              <Image
                src="/dep_logo.gif"
                alt="לוגו"
                width={120}
                height={120}
                className="rounded-lg w-24 h-24 md:w-32 md:h-32"
              />
            </div>
          </div>

          <div className="flex-1 text-right">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white">
              {title}
            </h1>
            <p className="mt-3 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl">
              {message}
            </p>

            <div className="mt-6 flex flex-wrap gap-3 items-center">
              {showRetry && (
                <button
                  onClick={() => onRetry && onRetry()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800"
                >
                  נסה שוב
                </button>
              )}

              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-500"
              >
                חזור לדף הבית
              </Link>

              <a
                href={`mailto:rishumbistbash@gmail.com?subject=${reportSubject}`}
                className="inline-flex items-center px-4 py-2 rounded-md border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-slate-200"
              >
                דווח על הבעיה
              </a>
            </div>

            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              אם הגעת לכאן מתוך קישור שקיבלת במייל, בדוק/י שאינו פג תוקף או צור
              קשר עם התמיכה.
            </p>
          </div>
        </section>

        <div
          id="easter"
          aria-hidden="true"
          ref={easterRef}
          className="absolute inset-0 pointer-events-none"
        ></div>

        <style>{`
          #easter .confetti{position:absolute;pointer-events:none;left:0;right:0;top:0;bottom:0}
          #easter .dot{position:absolute;width:10px;height:10px;border-radius:999px;opacity:0.95;animation:fall 1500ms linear forwards}
          @keyframes fall{0%{transform:translateY(-20vh) scale(1)}100%{transform:translateY(110vh) scale(0.8);opacity:0}}
        `}</style>
      </main>
    </div>
  );
}
