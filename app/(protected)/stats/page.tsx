"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Card from "@/app/components/Card";
import type {
  Complaint,
  ComplaintStatus,
  Department,
  User,
} from "@/app/lib/types";

type AppData = {
  users: User[];
  departments: Department[];
  complaints: Complaint[];
};

const ACTIVE_STATUSES: ComplaintStatus[] = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "AWAITING_PRINCIPAL_REVIEW",
];

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
};

const HEBREW_LOCALE = "he-IL";
const TZ = "Asia/Jerusalem";

function parseISOOrFallback(value: string): Date {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? new Date(ts) : new Date(0);
}

function diffDays(from: string | Date, to?: string | Date): number {
  const start = typeof from === "string" ? parseISOOrFallback(from) : from;
  const end =
    typeof to === "string"
      ? parseISOOrFallback(to)
      : to ?? new Date(Date.now());
  const delta = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(delta / (1000 * 60 * 60 * 24)));
}

function daysLeft(createdAt: string, deadlineDays = 7): number {
  return deadlineDays - diffDays(createdAt);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(HEBREW_LOCALE).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

type ChartRow = { label: string; count: number; share: number };
type ChartDisplay =
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "scatter"
  | "table"
  | "cards";
type ChartGraphDisplay = Exclude<ChartDisplay, "table" | "cards">;

const CHART_COLORS = [
  "#6366F1",
  "#22C55E",
  "#F97316",
  "#14B8A6",
  "#EC4899",
  "#8B5CF6",
  "#FACC15",
  "#0EA5E9",
];

function colorForIndex(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function buildLinePoints(rows: ChartRow[], width: number, height: number) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  const padding = 12;
  const band = rows.length <= 1 ? 0 : (width - padding * 2) / (rows.length - 1);
  return rows.map((row, idx) => {
    const x = rows.length <= 1 ? width / 2 : padding + band * idx;
    const y =
      height - padding - (row.count / max) * (height - padding * 2) || height - padding;
    return { x, y };
  });
}

function BarsChart({ rows }: { rows: ChartRow[] }) {
  const height = 140;
  const minWidth = 200;
  const band = 28;
  const width = Math.max(rows.length * band + 16, minWidth);
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-48 w-full"
      role="img"
      aria-label="Bar chart"
    >
      {rows.map((row, idx) => {
        const barHeight = (row.count / max) * (height - 30);
        const x = 12 + idx * band;
        const y = height - barHeight - 12;
        return (
          <rect
            key={`${row.label}-bar`}
            x={x}
            y={y}
            width={band - 8}
            height={barHeight}
            rx={4}
            fill={colorForIndex(idx)}
          >
            <title>
              {row.label}: {formatNumber(row.count)} ({formatPercent(row.share)})
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

function LineChart({
  rows,
  area = false,
}: {
  rows: ChartRow[];
  area?: boolean;
}) {
  const height = 140;
  const width = 260;
  const points = buildLinePoints(rows, width, height);
  const pathD = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const baseline = height - 12;
  const areaPath =
    pathD +
    ` L${points[points.length - 1]?.x ?? width},${baseline} L${
      points[0]?.x ?? 0
    },${baseline} Z`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-48 w-full"
      role="img"
      aria-label={area ? "Area chart" : "Line chart"}
    >
      {area && points.length >= 2 && (
        <path
          d={areaPath}
          fill="url(#areaGradient)"
          className="fill-indigo-200/60 dark:fill-indigo-500/20"
        />
      )}
      <path
        d={pathD || `M0,${baseline} L${width},${baseline}`}
        fill="none"
        stroke="#6366F1"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {points.map((p, idx) => (
        <circle
          key={`${rows[idx]?.label}-point`}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="#6366F1"
        >
          <title>
            {rows[idx]?.label}: {formatNumber(rows[idx]?.count ?? 0)} (
            {formatPercent(rows[idx]?.share ?? 0)})
          </title>
        </circle>
      ))}
    </svg>
  );
}

function ScatterChart({ rows }: { rows: ChartRow[] }) {
  const height = 140;
  const width = 260;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-48 w-full"
      role="img"
      aria-label="Scatter plot"
    >
      {rows.map((row, idx) => {
        const x =
          rows.length <= 1
            ? width / 2
            : (idx / (rows.length - 1)) * (width - 24) + 12;
        const y = height - 16 - (row.count / max) * (height - 40);
        return (
          <circle
            key={`${row.label}-scatter`}
            cx={x}
            cy={y}
            r={6 + row.share * 10}
            fill={colorForIndex(idx)}
            fillOpacity={0.8}
          >
            <title>
              {row.label}: {formatNumber(row.count)} ({formatPercent(row.share)})
            </title>
          </circle>
        );
      })}
    </svg>
  );
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function PieChart({
  rows,
  donut = false,
}: {
  rows: ChartRow[];
  donut?: boolean;
}) {
  const size = 200;
  const center = size / 2;
  const radius = center - 8;
  const total = Math.max(
    rows.reduce((acc, row) => acc + row.count, 0),
    1
  );
  let cumulative = 0;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-48 w-full"
      role="img"
      aria-label={donut ? "Donut chart" : "Pie chart"}
    >
      {rows.map((row, idx) => {
        const startAngle = (cumulative / total) * 360;
        cumulative += row.count;
        const endAngle = (cumulative / total) * 360;
        const d = describeArc(center, center, radius, startAngle, endAngle);
        return (
          <path
            key={`${row.label}-slice`}
            d={d}
            fill={colorForIndex(idx)}
            stroke="#0f172a0d"
            strokeWidth={1}
          >
            <title>
              {row.label}: {formatNumber(row.count)} ({formatPercent(row.share)})
            </title>
          </path>
        );
      })}
      {donut && (
        <circle
          cx={center}
          cy={center}
          r={radius * 0.5}
          className="fill-white dark:fill-neutral-900"
        />
      )}
    </svg>
  );
}

function ChartLegend({ rows }: { rows: ChartRow[] }) {
  return (
    <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
      {rows.map((row, idx) => (
        <div
          key={`${row.label}-legend`}
          className="flex items-center justify-between gap-2 rounded-md border border-neutral-100 px-2 py-1 dark:border-neutral-800"
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: colorForIndex(idx) }}
            />
            <span className="font-medium">{row.label}</span>
          </div>
          <span className="text-neutral-500">
            {formatNumber(row.count)} · {formatPercent(row.share)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartVisualization({
  rows,
  mode,
}: {
  rows: ChartRow[];
  mode: ChartGraphDisplay;
}) {
  if (mode === "bar") return <BarsChart rows={rows} />;
  if (mode === "line") return <LineChart rows={rows} />;
  if (mode === "area") return <LineChart rows={rows} area />;
  if (mode === "pie") return <PieChart rows={rows} />;
  if (mode === "donut") return <PieChart rows={rows} donut />;
  return <ScatterChart rows={rows} />;
}

export default function StatsPage() {
  const { status: authStatus } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"dashboard" | "charts">(
    "dashboard"
  );
  const [chartMetric, setChartMetric] = useState<
    "status" | "subjects" | "reporters"
  >("status");
  const [chartDisplay, setChartDisplay] = useState<ChartDisplay>("bar");

  useEffect(() => {
    const ctrl = new AbortController();
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch("/api/app-data", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(await res.text());
        const { data }: { data: AppData } = await res.json();
        if (!alive) return;
        setUsers(data.users);
        setDepartments(data.departments);
        setComplaints(data.complaints);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const msg = e instanceof Error ? e.message : "שגיאה בטעינת הנתונים";
        if (alive) setErr(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, []);

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const departmentById = useMemo(() => {
    const map = new Map<string, Department>();
    departments.forEach((d) => map.set(d.id, d));
    return map;
  }, [departments]);

  const summary = useMemo(() => {
    const total = complaints.length;
    const open = complaints.filter((c) =>
      ACTIVE_STATUSES.includes(c.status)
    ).length;
    const closed = complaints.filter((c) => c.status === "CLOSED").length;
    const overdue = complaints.filter(
      (c) =>
        ACTIVE_STATUSES.includes(c.status) && daysLeft(c.createdAt) < 0
    ).length;
    const awaitingPrincipal = complaints.filter(
      (c) => c.status === "AWAITING_PRINCIPAL_REVIEW"
    ).length;
    const unassigned = complaints.filter(
      (c) => ACTIVE_STATUSES.includes(c.status) && !c.assigneeUserId
    ).length;
    return {
      total,
      open,
      closed,
      overdue,
      awaitingPrincipal,
      unassigned,
    };
  }, [complaints]);

  const statusBreakdown = useMemo(() => {
    const total = complaints.length || 1;
    const closed = complaints.filter((c) => c.status === "CLOSED").length;
    const open = complaints.filter((c) => c.status !== "CLOSED").length;
    const assigned = complaints.filter(
      (c) => c.status !== "CLOSED" && c.assigneeUserId
    ).length;
    return [
      { key: "CLOSED", label: "סגור", count: closed, share: closed / total },
      { key: "OPEN", label: "פתוח", count: open, share: open / total },
      {
        key: "ASSIGNED",
        label: "הוקצה",
        count: assigned,
        share: assigned / total,
      },
    ];
  }, [complaints]);

  const departmentStats = useMemo(() => {
    const map = new Map<
      string,
      { dept: Department | undefined; total: number; open: number; overdue: number }
    >();
    for (const c of complaints) {
      const key = c.departmentId || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          dept: departmentById.get(key),
          total: 0,
          open: 0,
          overdue: 0,
        });
      }
      const entry = map.get(key)!;
      entry.total += 1;
      if (ACTIVE_STATUSES.includes(c.status)) {
        entry.open += 1;
        if (daysLeft(c.createdAt) < 0) entry.overdue += 1;
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [complaints, departmentById]);

  const assigneeStats = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        user: User | undefined;
        open: number;
        closed: number;
        total: number;
      }
    >();
    for (const c of complaints) {
      if (!c.assigneeUserId) continue;
      const key = c.assigneeUserId;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          user: userById.get(key),
          open: 0,
          closed: 0,
          total: 0,
        });
      }
      const entry = map.get(key)!;
      entry.total += 1;
      if (ACTIVE_STATUSES.includes(c.status)) entry.open += 1;
      if (c.status === "CLOSED") entry.closed += 1;
    }
    return [...map.values()]
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.closed - a.closed)
      .slice(0, 6);
  }, [complaints, userById]);

  const reporterStats = useMemo(() => {
    const byType = {
      STAFF: { label: "צוות בית הספר", count: 0, share: 0 },
      PARENT_STUDENT: { label: "הורים/תלמידים", count: 0, share: 0 },
    };
    const origins = new Map<
      string,
      { label: string; count: number; type: "STAFF" | "PARENT_STUDENT" }
    >();
    for (const complaint of complaints) {
      const reporter = complaint.reporter;
      if (!reporter) continue;
      const typeKey =
        reporter.type === "STAFF" ? "STAFF" : "PARENT_STUDENT";
      byType[typeKey].count += 1;

      let label = "";
      if (reporter.type === "STAFF") {
        label =
          departmentById.get(reporter.departmentId)?.name ||
          reporter.jobTitle ||
          "צוות אחר";
      } else {
        const grade = reporter.grade ? `כיתה ${reporter.grade}` : "";
        const klass = reporter.classNumber ? `-${reporter.classNumber}` : "";
        const combined = `${grade}${klass}`.replace(/^-/, "").trim();
        label = combined || "קהילת הורים/תלמידים";
      }
      const key = `${reporter.type}:${label}`;
      if (origins.has(key)) {
        origins.get(key)!.count += 1;
      } else {
        origins.set(key, { label, count: 1, type: typeKey });
      }
    }

    const total = complaints.length || 1;
    byType.STAFF.share = byType.STAFF.count / total;
    byType.PARENT_STUDENT.share = byType.PARENT_STUDENT.count / total;

    const topOrigins = [...origins.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((entry) => ({
        label: entry.label,
        count: entry.count,
        type: entry.type,
        share: complaints.length ? entry.count / complaints.length : 0,
      }));

    return {
      byType: [byType.STAFF, byType.PARENT_STUDENT],
      topOrigins,
    };
  }, [complaints, departmentById]);

  const subjectStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const complaint of complaints) {
      const subject = (complaint.subject || "").trim() || "ללא נושא";
      counts.set(subject, (counts.get(subject) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([subject, count]) => ({
        subject,
        count,
        share: complaints.length ? count / complaints.length : 0,
      }));
  }, [complaints]);

  const slaMetrics = useMemo(() => {
    const closedDurations = complaints
      .filter((c) => c.status === "CLOSED")
      .map((c) => diffDays(c.createdAt, c.updatedAt));
    const openDurations = complaints
      .filter((c) => ACTIVE_STATUSES.includes(c.status))
      .map((c) => diffDays(c.createdAt));

    const avgClosed =
      closedDurations.length === 0
        ? null
        : closedDurations.reduce((sum, days) => sum + days, 0) /
          closedDurations.length;

    const medianClosed =
      closedDurations.length === 0
        ? null
        : [...closedDurations].sort((a, b) => a - b)[
            Math.floor(closedDurations.length / 2)
          ];

    const slaWithin7 =
      closedDurations.length === 0
        ? null
        : closedDurations.filter((days) => days <= 7).length /
          closedDurations.length;

    const medianOpen =
      openDurations.length === 0
        ? null
        : [...openDurations].sort((a, b) => a - b)[
            Math.floor(openDurations.length / 2)
          ];

    return { avgClosed, medianClosed, slaWithin7, medianOpen };
  }, [complaints]);

  const monthlyTrend = useMemo(() => {
    const byMonth = new Map<
      string,
      { label: string; total: number; closed: number; open: number }
    >();
    for (const c of complaints) {
      const date = parseISOOrFallback(c.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      if (!byMonth.has(key)) {
        byMonth.set(key, {
          label: date.toLocaleDateString(HEBREW_LOCALE, {
            ...DATE_OPTIONS,
            timeZone: TZ,
          }),
          total: 0,
          closed: 0,
          open: 0,
        });
      }
      const entry = byMonth.get(key)!;
      entry.total += 1;
      if (c.status === "CLOSED") entry.closed += 1;
      if (ACTIVE_STATUSES.includes(c.status)) entry.open += 1;
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, value]) => value);
  }, [complaints]);

  const monthlyChartRows = useMemo<ChartRow[]>(() => {
    const total = monthlyTrend.reduce((sum, row) => sum + row.total, 0) || 1;
    return monthlyTrend.map((row) => ({
      label: row.label,
      count: row.total,
      share: row.total / total,
    }));
  }, [monthlyTrend]);

  const chartConfig = useMemo<
    Record<
      "status" | "subjects" | "reporters",
      {
        title: string;
        subtitle: string;
        rows: { label: string; count: number; share: number }[];
      }
    >
  >(() => {
    return {
      status: {
        title: "חלוקת סטטוס",
        subtitle: "אחוז מכלל הפניות",
        rows: statusBreakdown.map((row) => ({
          label: row.label,
          count: row.count,
          share: row.share,
        })),
      },
      subjects: {
        title: "נושאים מובילים",
        subtitle: "6 הנושאים המדוברים ביותר",
        rows: subjectStats.map((row) => ({
          label: row.subject,
          count: row.count,
          share: row.share,
        })),
      },
      reporters: {
        title: "מקורות פנייה",
        subtitle: "Top 5 לפי נפח",
        rows: reporterStats.topOrigins.map((row) => ({
          label: row.label,
          count: row.count,
          share: row.share,
        })),
      },
    };
  }, [statusBreakdown, subjectStats, reporterStats]);

  const activeChart = chartConfig[chartMetric];
  const viewOptions: Array<{ key: "dashboard" | "charts"; label: string }> = [
    { key: "dashboard", label: "תצוגת נתונים" },
    { key: "charts", label: "תצוגת גרפים" },
  ];
  const chartOptions: Array<{
    key: "status" | "subjects" | "reporters";
    label: string;
  }> = [
    { key: "status", label: "סטטוסים" },
    { key: "subjects", label: "נושאים" },
    { key: "reporters", label: "מגישים" },
  ];
  const chartDisplayOptions: Array<{ key: ChartDisplay; label: string }> = [
    { key: "bar", label: "עמודות" },
    { key: "line", label: "קו" },
    { key: "area", label: "שטח" },
    { key: "pie", label: "עוגה" },
    { key: "donut", label: "דונאט" },
    { key: "scatter", label: "פיזור" },
    { key: "table", label: "טבלה" },
    { key: "cards", label: "כרטיסים" },
  ];
  if (loading || authStatus === "loading") {
    return (
      <div className="p-4" dir="rtl">
        <div className="card p-6 flex items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
          <svg
            className="h-5 w-5 animate-spin text-neutral-500"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              className="opacity-25"
            />
            <path
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              className="opacity-75"
            />
          </svg>
          <span>טוען נתונים…</span>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-4" dir="rtl">
        <div className="rounded-xl border bg-red-100 p-6 text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          שגיאה בטעינת הנתונים: {err}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 container-max" dir="rtl">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">סטטיסטיקות פניות</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            תמונת מצב חיה של נפח פניות, עומסים, מקורות ודפוסי טיפול.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 text-sm dark:border-neutral-800 dark:bg-neutral-900/40">
          {viewOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => setViewMode(option.key)}
              className={`rounded-md px-3 py-1.5 transition ${
                viewMode === option.key
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                  : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "dashboard" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <div className="text-sm text-neutral-500">סה״כ פניות</div>
              <div className="mt-1 text-3xl font-semibold">
                {formatNumber(summary.total)}
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {formatNumber(summary.closed)} נסגרו,{" "}
                {formatNumber(summary.open)} פעילות.
              </p>
            </Card>
            <Card>
              <div className="text-sm text-neutral-500">פניות באיחור</div>
              <div className="mt-1 text-3xl font-semibold text-red-600 dark:text-red-400">
                {formatNumber(summary.overdue)}
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {summary.open
                  ? formatPercent(summary.overdue / summary.open)
                  : "0%"}{" "}
                מהפניות הפעילות עברו את יעד 7 הימים.
              </p>
            </Card>
            <Card>
              <div className="text-sm text-neutral-500">ממתינות למנהל/ת</div>
              <div className="mt-1 text-3xl font-semibold">
                {formatNumber(summary.awaitingPrincipal)}
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {formatNumber(summary.unassigned)} פניות פעילות ללא הקצאה.
              </p>
            </Card>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-3">
                <h2 className="text-lg font-semibold">מי מגיש פניות</h2>
                <p className="text-xs text-neutral-500">
                  חלוקה לפי סוג מדווח ומקורות מובילים.
                </p>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {reporterStats.byType.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-800"
                  >
                    <div className="text-xs text-neutral-500">{row.label}</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {formatNumber(row.count)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {formatPercent(row.share)} מכלל הפניות
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="mb-2 text-xs text-neutral-500">
                  מקורות מובילים
                </div>
                {reporterStats.topOrigins.length === 0 ? (
                  <p className="text-sm text-neutral-500">אין נתוני מקור.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {reporterStats.topOrigins.map((row) => (
                      <li
                        key={row.label}
                        className="flex flex-wrap items-center justify-between gap-1"
                      >
                        <span>{row.label}</span>
                        <span className="text-xs text-neutral-500">
                          {formatNumber(row.count)} · {formatPercent(row.share)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
            <Card>
              <div className="mb-3">
                <h2 className="text-lg font-semibold">נושאי פנייה מובילים</h2>
                <p className="text-xs text-neutral-500">
                  6 הנושאים המדוברים ביותר.
                </p>
              </div>
              {subjectStats.length === 0 ? (
                <p className="text-sm text-neutral-500">אין נתוני נושא.</p>
              ) : (
                <>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-neutral-500">
                        <tr>
                          <th className="text-right pb-2 font-medium">נושא</th>
                          <th className="text-right pb-2 font-medium">כמות</th>
                          <th className="text-right pb-2 font-medium">אחוז</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {subjectStats.map((row) => (
                          <tr key={row.subject}>
                            <td className="py-2">{row.subject}</td>
                            <td>{formatNumber(row.count)}</td>
                            <td>{formatPercent(row.share)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-2 sm:hidden">
                    {subjectStats.map((row) => (
                      <div
                        key={`${row.subject}-mobile`}
                        className="rounded-lg border border-neutral-100 p-3 text-sm dark:border-neutral-800"
                      >
                        <div className="font-medium">{row.subject}</div>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                          <span>כמות: {formatNumber(row.count)}</span>
                          <span>אחוז: {formatPercent(row.share)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">סטטוס פניות</h2>
                <span className="text-xs text-neutral-500">
                  אחוז מכלל הפניות
                </span>
              </div>
              <ul className="space-y-3 text-sm">
                {statusBreakdown.map((row) => (
                  <li
                    key={row.key}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{row.label}</span>
                      <span className="text-xs text-neutral-500">
                        {formatNumber(row.count)} פניות
                      </span>
                    </div>
                    <div className="text-sm font-semibold">
                      {formatPercent(row.share)}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">ביצועי SLA (מדדי איכות)</h2>
                <span className="text-xs text-neutral-500">ימים</span>
              </div>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt>משך טיפול ממוצע (פניות סגורות)</dt>
                  <dd className="font-semibold">
                    {slaMetrics.avgClosed === null
                      ? "—"
                      : `${slaMetrics.avgClosed.toFixed(1)} ימים`}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>חציון משך טיפול</dt>
                  <dd className="font-semibold">
                    {slaMetrics.medianClosed === null
                      ? "—"
                      : `${slaMetrics.medianClosed} ימים`}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>נסגרו תוך 7 ימים</dt>
                  <dd className="font-semibold">
                    {slaMetrics.slaWithin7 === null
                      ? "—"
                      : formatPercent(slaMetrics.slaWithin7)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>חציון גיל פניות פתוחות</dt>
                  <dd className="font-semibold">
                    {slaMetrics.medianOpen === null
                      ? "—"
                      : `${slaMetrics.medianOpen} ימים`}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">עומסים לפי מחלקה</h2>
                <span className="text-xs text-neutral-500">6 הגבוהות</span>
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-sm">
                  <thead className="text-xs text-neutral-500">
                    <tr>
                      <th className="text-right pb-2 font-medium">מחלקה</th>
                      <th className="text-right pb-2 font-medium">סה״כ</th>
                      <th className="text-right pb-2 font-medium">פתוחות</th>
                      <th className="text-right pb-2 font-medium">באיחור</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {departmentStats.slice(0, 6).map((row) => (
                      <tr key={row.dept?.id || "unknown"}>
                        <td className="py-2">
                          {row.dept?.name || "ללא שיוך"}
                        </td>
                        <td>{formatNumber(row.total)}</td>
                        <td>{formatNumber(row.open)}</td>
                        <td
                          className={
                            row.overdue > 0
                              ? "text-red-600 dark:text-red-400"
                              : undefined
                          }
                        >
                          {formatNumber(row.overdue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 text-sm sm:hidden">
                {departmentStats.slice(0, 6).map((row) => (
                  <div
                    key={`${row.dept?.id || "unknown"}-mobile`}
                    className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-800"
                  >
                    <div className="font-medium">
                      {row.dept?.name || "ללא שיוך"}
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-neutral-500">
                      <span>סה״כ: {formatNumber(row.total)}</span>
                      <span>פתוחות: {formatNumber(row.open)}</span>
                      <span className="col-span-2">
                        באיחור:{" "}
                        <span
                          className={
                            row.overdue > 0
                              ? "text-red-600 dark:text-red-400"
                              : undefined
                          }
                        >
                          {formatNumber(row.overdue)}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">מובילי טיפול</h2>
                <span className="text-xs text-neutral-500">Top 6</span>
              </div>
              {assigneeStats.length === 0 ? (
                <p className="text-sm text-neutral-500">אין נתוני הקצאה.</p>
              ) : (
                <>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-neutral-500">
                        <tr>
                          <th className="text-right pb-2 font-medium">שם</th>
                          <th className="text-right pb-2 font-medium">נסגרו</th>
                          <th className="text-right pb-2 font-medium">פתוחות</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {assigneeStats.map((row) => (
                          <tr key={row.id}>
                            <td className="py-2">{row.user?.name || "—"}</td>
                            <td>{formatNumber(row.closed)}</td>
                            <td>{formatNumber(row.open)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-2 text-sm sm:hidden">
                    {assigneeStats.map((row) => (
                      <div
                        key={`${row.id}-mobile`}
                        className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-800"
                      >
                        <div className="font-medium">{row.user?.name || "—"}</div>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                          <span>נסגרו: {formatNumber(row.closed)}</span>
                          <span>פתוחות: {formatNumber(row.open)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="mt-6">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">מגמת פניות חודשית</h2>
                <span className="text-xs text-neutral-500">
                  6 החודשים האחרונים
                </span>
              </div>
              {monthlyTrend.length === 0 ? (
                <p className="text-sm text-neutral-500">אין נתונים להצגה.</p>
              ) : (
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {monthlyTrend.map((row) => (
                    <div
                      key={row.label}
                      className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-800"
                    >
                      <div className="text-xs text-neutral-500">{row.label}</div>
                      <div className="mt-1 text-2xl font-semibold">
                        {formatNumber(row.total)}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                        <span>סגורות: {formatNumber(row.closed)}</span>
                        <span>פתוחות: {formatNumber(row.open)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      ) : (
        <div className="grid gap-4">
          <Card>
            <div className="mb-4 flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{activeChart.title}</h2>
                  <p className="text-xs text-neutral-500">
                    {activeChart.subtitle}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 text-sm dark:border-neutral-800 dark:bg-neutral-900/40">
                  {chartOptions.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setChartMetric(option.key)}
                      className={`rounded-md px-3 py-1.5 transition ${
                        chartMetric === option.key
                          ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                          : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      }`}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-0.5 text-sm dark:border-neutral-800 dark:bg-neutral-900/40">
                {chartDisplayOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setChartDisplay(option.key)}
                    className={`rounded-md px-3 py-1.5 transition ${
                      chartDisplay === option.key
                        ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                        : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                    }`}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {activeChart.rows.length === 0 ? (
              <p className="text-sm text-neutral-500">אין נתונים להצגה.</p>
            ) : chartDisplay === "table" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-neutral-500">
                    <tr>
                      <th className="text-right pb-2 font-medium">קטגוריה</th>
                      <th className="text-right pb-2 font-medium">כמות</th>
                      <th className="text-right pb-2 font-medium">אחוז</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {activeChart.rows.map((row) => (
                      <tr key={`${chartMetric}-${row.label}-table`}>
                        <td className="py-2">{row.label}</td>
                        <td>{formatNumber(row.count)}</td>
                        <td>{formatPercent(row.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : chartDisplay === "cards" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {activeChart.rows.map((row) => (
                  <div
                    key={`${chartMetric}-${row.label}-tile`}
                    className="rounded-lg border border-neutral-100 p-3 text-sm dark:border-neutral-800"
                  >
                    <div className="font-medium">{row.label}</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {formatNumber(row.count)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {formatPercent(row.share)} מהפניות
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <ChartVisualization
                  rows={activeChart.rows}
                  mode={chartDisplay as ChartGraphDisplay}
                />
                <ChartLegend rows={activeChart.rows} />
              </>
            )}
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">מגמת פניות חודשית</h2>
              <span className="text-xs text-neutral-500">
                6 החודשים האחרונים
              </span>
            </div>
            {monthlyTrend.length === 0 ? (
              <p className="text-sm text-neutral-500">אין נתונים להצגה.</p>
            ) : chartDisplay === "table" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-neutral-500">
                    <tr>
                      <th className="text-right pb-2 font-medium">חודש</th>
                      <th className="text-right pb-2 font-medium">סה״כ</th>
                      <th className="text-right pb-2 font-medium">סגורות</th>
                      <th className="text-right pb-2 font-medium">פתוחות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {monthlyTrend.map((row) => (
                      <tr key={`trend-${row.label}-table`}>
                        <td className="py-2">{row.label}</td>
                        <td>{formatNumber(row.total)}</td>
                        <td>{formatNumber(row.closed)}</td>
                        <td>{formatNumber(row.open)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : chartDisplay === "cards" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {monthlyTrend.map((row) => (
                  <div
                    key={`trend-${row.label}-tile`}
                    className="rounded-lg border border-neutral-100 p-3 text-sm dark:border-neutral-800"
                  >
                    <div className="text-xs text-neutral-500">{row.label}</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {formatNumber(row.total)}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                      <span>סגורות: {formatNumber(row.closed)}</span>
                      <span>פתוחות: {formatNumber(row.open)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <ChartVisualization
                  rows={monthlyChartRows}
                  mode={chartDisplay as ChartGraphDisplay}
                />
                <ChartLegend rows={monthlyChartRows} />
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}


