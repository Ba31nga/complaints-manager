"use client";

import React from "react";

// Minimal two-tone pill: neutral or accent (primary). Keep markup simple and rely on
// CSS variables for the primary color so we don't introduce extra color tokens.
type Tone = "neutral" | "accent";
type Props = { label: string; tone?: Tone };

export default function StatusPill({ label, tone = "neutral" }: Props) {
  if (tone === "accent") {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px] font-medium"
        style={{
          backgroundColor: "rgb(var(--primary) / 0.10)",
          color: "rgb(var(--primary))",
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px] font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
      {label}
    </span>
  );
}
