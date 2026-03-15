import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/dashboard/LogoutButton";
import AnalyticsDashboard from "@/components/dashboard/doctor/AnalyticsDashboard";

// ── IST helpers ───────────────────────────────────────────────────────────────

const IST_MS = 5.5 * 60 * 60 * 1000;

/** Returns "YYYY-MM-DD" in IST for a given Date */
function toISTDateStr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Day-of-week index (0=Sun … 6=Sat) in IST */
function istDow(date: Date): number {
  return new Date(date.getTime() + IST_MS).getUTCDay();
}

function getDateRange(rangeKey: string) {
  const days = rangeKey === "7d" ? 7 : rangeKey === "30d" ? 30 : 90;
  const todayIST = toISTDateStr(new Date());

  const end = new Date(`${todayIST}T23:59:59+05:30`);

  const startTemp = new Date(`${todayIST}T00:00:00+05:30`);
  startTemp.setDate(startTemp.getDate() - (days - 1));
  const start = new Date(`${toISTDateStr(startTemp)}T00:00:00+05:30`);

  return { start, end, days };
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

const DOW_ORDERED = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const range = ["7d", "30d", "3m"].includes(sp.range ?? "") ? sp.range : "30d";

  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DOCTOR") redirect("/login");

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true, consultationFee: true },
  });
  if (!doctor) redirect("/login");

  const { start, end, days } = getDateRange(range);
  const fee = Number(doctor.consultationFee);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const [appointments, patientVisitRows] = await Promise.all([
    prisma.appointment.findMany({
      where: { doctorId: doctor.id, scheduledAt: { gte: start, lte: end } },
      select: { patientId: true, scheduledAt: true, status: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.appointment.groupBy({
      by: ["patientId"],
      where: {
        doctorId: doctor.id,
        scheduledAt: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
      _count: { patientId: true },
      orderBy: { _count: { patientId: "desc" } },
      take: 5,
    }),
  ]);

  const topPatientIds = patientVisitRows.map((r) => r.patientId);
  const patientRecords = await prisma.patient.findMany({
    where: { id: { in: topPatientIds } },
    select: { id: true, user: { select: { name: true } } },
  });
  const nameMap = new Map(patientRecords.map((p) => [p.id, p.user.name ?? "Unknown"]));

  // ── Derived stats ─────────────────────────────────────────────────────────

  const nonCancelled = appointments.filter((a) => a.status !== "CANCELLED");
  const completed = appointments.filter((a) => a.status === "COMPLETED");

  const totalRevenue = completed.length * fee;
  const totalPatients = new Set(nonCancelled.map((a) => a.patientId)).size;
  const totalAppointments = appointments.length;
  const avgPerDay = days > 0 ? Math.round((nonCancelled.length / days) * 10) / 10 : 0;

  // ── Daily revenue ─────────────────────────────────────────────────────────

  const revenueMap = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    revenueMap.set(toISTDateStr(d), 0);
  }
  for (const a of completed) {
    const key = toISTDateStr(a.scheduledAt);
    revenueMap.set(key, (revenueMap.get(key) ?? 0) + fee);
  }
  const dailyRevenue = Array.from(revenueMap.entries()).map(([dateStr, revenue]) => ({
    date: new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(`${dateStr}T12:00:00+05:30`)),
    revenue,
  }));

  // ── Status breakdown ──────────────────────────────────────────────────────

  const statusMap = new Map<string, number>();
  for (const a of appointments) {
    statusMap.set(a.status, (statusMap.get(a.status) ?? 0) + 1);
  }
  const statusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    label: STATUS_LABELS[status] ?? status,
    count,
  }));

  // ── Day of week ───────────────────────────────────────────────────────────

  const dowMap = new Map<string, number>(DOW_ORDERED.map((d) => [d, 0]));
  for (const a of nonCancelled) {
    const day = DOW_NAMES[istDow(a.scheduledAt)];
    dowMap.set(day, (dowMap.get(day) ?? 0) + 1);
  }
  const dayOfWeek = DOW_ORDERED.map((d) => ({ day: d, count: dowMap.get(d) ?? 0 }));

  // ── Top patients ──────────────────────────────────────────────────────────

  const topPatients = patientVisitRows.map((r) => ({
    name: nameMap.get(r.patientId) ?? "Unknown",
    visits: r._count.patientId,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/doctor/dashboard" className="text-xl font-bold text-blue-600">
              meddy
            </Link>
            <span className="text-slate-300 select-none">|</span>
            <span className="text-sm font-medium text-slate-700">Analytics</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-slate-500">
              {session.user.name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AnalyticsDashboard
          range={range}
          stats={{ totalRevenue, totalPatients, totalAppointments, avgPerDay }}
          consultationFee={fee}
          dailyRevenue={dailyRevenue}
          statusBreakdown={statusBreakdown}
          topPatients={topPatients}
          dayOfWeek={dayOfWeek}
        />
      </main>
    </div>
  );
}
