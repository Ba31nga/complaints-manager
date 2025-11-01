"use client";
import React from "react";
import ErrorShell from "@/app/components/ErrorShell";

type Props = {
  error: Error;
  reset: () => void;
};

export default function ErrorPage({ error, reset }: Props) {
  return (
    <ErrorShell
      title="שגיאה פנימית בשרת"
      message={
        error?.message ||
        "המערכת נתקלה בשגיאה. ניתן לנסות לרענן את הדף או לחזור לדף הראשי."
      }
      showRetry
      onRetry={() => reset()}
      reportSubject={"דווח%20שגיאה%20-500"}
    />
  );
}
