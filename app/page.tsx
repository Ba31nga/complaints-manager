import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-gradient-to-br from-zinc-50 to-zinc-200 px-6 py-20 text-center font-sans text-zinc-800 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-50 transition-colors duration-500">
      {/* Header */}
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent tracking-tight">
          Tailwind v3 Test Page
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-md">
          Confirm that Tailwind CSS, dark mode, and responsive utilities all
          work properly in your Next.js project.
        </p>
      </div>

      {/* Color + Shadow Showcase */}
      <div className="flex flex-wrap justify-center gap-6">
        {["red", "orange", "yellow", "green", "blue", "purple", "pink"].map(
          (color) => (
            <div
              key={color}
              className={`h-20 w-20 rounded-2xl shadow-lg shadow-${color}-500/30 bg-${color}-500 hover:scale-110 transition-transform`}
            ></div>
          )
        )}
      </div>

      {/* Button Showcase */}
      <div className="flex flex-wrap justify-center gap-4">
        <button className="rounded-xl bg-blue-600 px-6 py-3 text-white font-medium transition-all hover:scale-105 hover:bg-blue-700 active:scale-95">
          Primary Button
        </button>
        <button className="rounded-xl border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition-all hover:scale-105 hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
          Secondary Button
        </button>
      </div>

      {/* Typography Showcase */}
      <div className="max-w-xl space-y-4 text-left sm:text-center">
        <h2 className="text-2xl font-semibold">Typography Test</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          This is <span className="font-semibold text-blue-600">Tailwind</span>{" "}
          in action. Resize the window to see responsive behavior, hover over
          elements to check transitions, and toggle your system theme to test
          dark mode.
        </p>
      </div>

      {/* Logo */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <Image
          src="/next.svg"
          alt="Next.js Logo"
          width={120}
          height={24}
          className="dark:invert"
        />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Next.js + Tailwind CSS v3
        </p>
      </div>
    </main>
  );
}
