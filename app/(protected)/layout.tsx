// /app/(protected)/layout.tsx
import Navbar from "@/app/components/Navbar";
import TutorialFab from "@/app/components/TutorialFab";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Top navigation bar */}
      <Navbar />

      {/* Page content fills the rest of the window */}
      <main className="flex-1">{children}</main>

      {/* Floating tutorial button */}
      <TutorialFab position="bottom-left" />
    </div>
  );
}
