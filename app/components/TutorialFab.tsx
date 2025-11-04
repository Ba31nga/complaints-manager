"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { Role } from "@/app/lib/types";

type Props = {
  position?: "bottom-left" | "bottom-right";
};

type Step = {
  title: string;
  body: string;
  image?: string; // optional screenshot path under /public
};

export default function TutorialFab({ position = "bottom-left" }: Props) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const { data: session, status } = useSession();

  const posClass =
    position === "bottom-left" ? "left-4 bottom-4" : "right-4 bottom-4";

  // Resolve the user's role from their email when opening the tutorial
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const email = session?.user?.email?.toLowerCase();
        if (!email) return;
        const res = await fetch(
          `/api/users/by-email?email=${encodeURIComponent(email)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const r: Role | null = json?.data?.role ?? null;
        if (r) setRole(r);
      } catch (_) {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, session?.user?.email]);

  const stepsByRole: Record<"GENERIC" | Role, Step[]> = useMemo(
    () => ({
      GENERIC: [
        {
          title: "סקירה כללית",
          body: "ניהול תלונות: צפייה, סינון וטיפול. נווטו בין פתוחות, בטיפול וסגורות דרך הסרגל העליון.",
          image: "/tutorial/generic-1.png",
        },
        {
          title: "כרטיס תלונה",
          body: "פתחו תלונה כדי לראות פרטים מלאים, תקשורת עם הפונה, סטטוס והיסטוריה.",
          image: "/tutorial/generic-2.png",
        },
        {
          title: "סיום",
          body: "לאחר פתרון, סגרו את התלונה וייצאו PDF לסיכום ודיווח לפי צורך.",
          image: "/tutorial/generic-3.png",
        },
      ],
      ADMIN: [
        {
          title: "ניהול מערכת",
          body: "כמנהל מערכת, הגדירו משתמשים, מחלקות והרשאות. וודאו שהניווט תואם למדיניות.",
          image: "/tutorial/admin-1.png",
        },
        {
          title: "בקרה ודוחות",
          body: "עקבו אחרי עומסים ועמידה ביעדים. ייצאו דוחות וסכמי PDF לפי צורך.",
          image: "/tutorial/admin-2.png",
        },
      ],
      MANAGER: [
        {
          title: "ניהול מחלקה",
          body: "שייכו תלונות לאנשי צוות, הגדירו תיעדוף ותאריכי יעד למחלקה שלכם.",
          image: "/tutorial/manager-1.png",
        },
        {
          title: "מעקב התקדמות",
          body: "בדקו סטטוסים ובקשות עזרה. החזירו משימות לשיפור והבטיחו SLA.",
          image: "/tutorial/manager-2.png",
        },
      ],
      EMPLOYEE: [
        {
          title: "קבלת משימות",
          body: "טפלו בתלונות שהוקצו לכם, תקשרו עם הפונה ושמרו תיעוד מלא.",
          image: "/tutorial/employee-1.png",
        },
        {
          title: "עדכון סטטוס",
          body: "עדכנו פתוחה → בטיפול → נסגרה ושיתפו את המנהל במידת הצורך.",
          image: "/tutorial/employee-2.png",
        },
      ],
      PRINCIPAL: [
        {
          title: "סקירת מנהל/ת",
          body: "בצעו ביקורת וקבלו החלטה בנושאים המצריכים אישור מנהל/ת.",
          image: "/tutorial/principal-1.png",
        },
        {
          title: "חתימה וסיכום",
          body: "חתמו על הסיכום, הגדירו האם מוצדק והוסיפו תובנות ברמת המוסד.",
          image: "/tutorial/principal-2.png",
        },
      ],
    }),
    []
  );

  const steps: Step[] = role ? stepsByRole[role] : stepsByRole.GENERIC;
  const total = steps.length;
  const current = steps[stepIdx] ?? steps[0];

  const close = () => {
    setOpen(false);
    setStepIdx(0);
  };

  return (
    <>
      <button
        type="button"
        aria-label="פתח הדרכה"
        onClick={() => setOpen(true)}
        className={[
          "fixed z-40",
          posClass,
          "h-12 w-12 rounded-full shadow-lg",
          "bg-blue-600 text-white hover:bg-blue-500",
          "flex items-center justify-center",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
        ].join(" ")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-6 w-6"
          aria-hidden
        >
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm.75 15.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12 6.75a3.25 3.25 0 00-3.25 3.25.75.75 0 001.5 0 1.75 1.75 0 113.5 0c0 .693-.329 1.061-1.187 1.676-.805.579-1.813 1.303-1.813 2.574V15a.75.75 0 001.5 0v-.75c0-.692.329-1.06 1.187-1.675.805-.579 1.813-1.303 1.813-2.575A3.25 3.25 0 0012 6.75z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-xl bg-white text-neutral-900 shadow-xl dark:bg-neutral-900 dark:text-neutral-100">
              <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">הדרכה — מנהל תלונות</h2>
                  <span className="text-xs opacity-70">
                    {role
                      ? `לתפקיד: ${role}`
                      : status === "loading"
                      ? "טוען תפקיד…"
                      : "כללי"}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="סגור"
                  onClick={close}
                  className="rounded p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                    aria-hidden
                  >
                    <path d="M6.225 4.811a1 1 0 00-1.414 1.414L10.586 12l-5.775 5.775a1 1 0 101.414 1.414L12 13.414l5.775 5.775a1 1 0 001.414-1.414L13.414 12l5.775-5.775a1 1 0 10-1.414-1.414L12 10.586 6.225 4.811z" />
                  </svg>
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4 leading-relaxed">
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <h3 className="font-medium">{current.title}</h3>
                    <p className="mt-1 text-sm opacity-90">{current.body}</p>
                  </div>
                  {current.image && (
                    <img
                      src={current.image}
                      alt=""
                      className="block h-28 w-40 rounded border border-neutral-200 object-cover dark:border-neutral-800"
                      onError={(e) => {
                        // hide the image if not found (lets you add screenshots later under /public/tutorial)
                        (e.currentTarget.style as any).display = "none";
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-neutral-200 p-3 text-sm dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="opacity-70">
                    שלב {stepIdx + 1} מתוך {total}
                  </span>
                  <div className="flex items-center gap-1">
                    {steps.map((_, i) => (
                      <span
                        key={i}
                        className={[
                          "inline-block h-1.5 w-1.5 rounded-full",
                          i === stepIdx ? "bg-blue-600" : "bg-neutral-400/60",
                        ].join(" ")}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                    disabled={stepIdx === 0}
                  >
                    הקודם
                  </button>
                  {stepIdx < total - 1 ? (
                    <button
                      type="button"
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-500"
                      onClick={() =>
                        setStepIdx((i) => Math.min(total - 1, i + 1))
                      }
                    >
                      הבא
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-md bg-neutral-200 px-3 py-1.5 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                      onClick={close}
                    >
                      סיום
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
