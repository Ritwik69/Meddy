"use client";

import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  range: string;
  stats: {
    totalRevenue: number;
    totalPatients: number;
    totalAppointments: number;
    avgPerDay: number;
  };
  consultationFee: number;
  dailyRevenue: { date: string; revenue: number }[];
  statusBreakdown: { status: string; label: string; count: number }[];
  topPatients: { name: string; visits: number }[];
  dayOfWeek: { day: string; count: number }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGES = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  COMPLETED: "#10b981",
  CANCELLED: "#ef4444",
  NO_SHOW: "#6b7280",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function inr(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

function revenueYTick(v: number) {
  if (v === 0) return "₹0";
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}k`;
  return `₹${v}`;
}

// ── Tooltip style ─────────────────────────────────────────────────────────────

const tooltipStyle = {
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.08)",
  fontSize: "13px",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnalyticsDashboard({
  range,
  stats,
  dailyRevenue,
  statusBreakdown,
  topPatients,
  dayOfWeek,
}: Props) {
  const router = useRouter();

  const xInterval =
    range === "7d" ? 0 : range === "30d" ? 4 : 14;
  const maxBarSize =
    range === "7d" ? 40 : range === "30d" ? 14 : 5;

  const maxVisits = topPatients[0]?.visits ?? 1;

  // ── Stats config ───────────────────────────────────────────────────────────

  const statCards = [
    {
      label: "Total Revenue",
      value: inr(stats.totalRevenue),
      sub: "from completed visits",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      ),
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Total Patients",
      value: stats.totalPatients,
      sub: "unique patients seen",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      ),
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Appointments",
      value: stats.totalAppointments,
      sub: "total scheduled",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      ),
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "Avg per Day",
      value: `${stats.avgPerDay}`,
      sub: "non-cancelled / day",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      ),
      color: "text-orange-600 bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header + range selector ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            All figures in IST · Revenue based on completed appointments
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => router.push(`/doctor/analytics?range=${r.key}`)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                range === r.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {s.icon}
              </svg>
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{s.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Row: Revenue chart + Status pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-5">
            Daily Revenue
          </h2>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dailyRevenue}
                maxBarSize={maxBarSize}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  interval={xInterval}
                />
                <YAxis
                  tickFormatter={revenueYTick}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip
                  formatter={(v: unknown) => [inr(v as number), "Revenue"]}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "#f0f9ff" }}
                />
                <Bar
                  dataKey="revenue"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status pie chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-5">
            Status Breakdown
          </h2>
          {statusBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-slate-400 text-sm">
              No appointments in this period
            </div>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="42%"
                    outerRadius={80}
                    innerRadius={44}
                    paddingAngle={2}
                  >
                    {statusBreakdown.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={STATUS_COLORS[entry.status] ?? "#6b7280"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: unknown, name: unknown) => [v as number, name as string]}
                    contentStyle={tooltipStyle}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Row: Busiest days + Top patients ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day of week bar chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-5">
            Appointments by Day of Week
          </h2>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dayOfWeek}
                maxBarSize={40}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  formatter={(v: unknown) => [v as number, "Appointments"]}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "#f5f3ff" }}
                />
                <Bar
                  dataKey="count"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 patients */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-5">
            Top Patients by Visits
          </h2>

          {topPatients.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">
              No patient data for this period
            </div>
          ) : (
            <div className="space-y-4">
              {topPatients.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  {/* Rank */}
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0
                        ? "bg-amber-100 text-amber-700"
                        : i === 1
                        ? "bg-slate-200 text-slate-600"
                        : i === 2
                        ? "bg-orange-100 text-orange-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {i + 1}
                  </span>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
                    {p.name[0].toUpperCase()}
                  </div>

                  {/* Name + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {p.name}
                      </p>
                      <span className="text-xs text-slate-500 shrink-0 ml-2">
                        {p.visits} visit{p.visits !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{
                          width: `${Math.round((p.visits / maxVisits) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
