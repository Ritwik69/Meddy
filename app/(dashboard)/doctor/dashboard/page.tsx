import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/dashboard/LogoutButton";
import AppointmentsPanel, {
  TodayAppointment,
} from "@/components/dashboard/doctor/AppointmentsPanel";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getISTDateRange() {
  const todayIST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // "YYYY-MM-DD"

  return {
    start: new Date(`${todayIST}T00:00:00+05:30`),
    end: new Date(`${todayIST}T23:59:59+05:30`),
  };
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/** Remove a leading "Dr." / "Dr " prefix from a stored name. */
function stripDr(name: string | null | undefined) {
  return (name ?? "").replace(/^Dr\.?\s+/i, "").trim();
}

function getGreeting() {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(new Date())
  );
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DoctorDashboard() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DOCTOR") redirect("/login");

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      specialization: true,
      consultationFee: true,
      isVerified: true,
    },
  });

  if (!doctor) redirect("/login");

  const { start: todayStart, end: todayEnd } = getISTDateRange();

  const [
    todayAppointments,
    totalPatientRows,
    pendingCount,
    completedTodayCount,
    recentApptRows,
  ] = await Promise.all([
    // Today's appointments with patient + clinic info
    prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        scheduledAt: { gte: todayStart, lte: todayEnd },
      },
      include: {
        patient: { include: { user: { select: { name: true } } } },
        clinic: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),

    // All distinct patients ever seen
    prisma.appointment.findMany({
      where: { doctorId: doctor.id },
      select: { patientId: true },
      distinct: ["patientId"],
    }),

    // Pending appointment count
    prisma.appointment.count({
      where: { doctorId: doctor.id, status: "PENDING" },
    }),

    // Completed appointments today (for revenue)
    prisma.appointment.count({
      where: {
        doctorId: doctor.id,
        scheduledAt: { gte: todayStart, lte: todayEnd },
        status: "COMPLETED",
      },
    }),

    // Last ~100 non-cancelled appointments for recent patients
    prisma.appointment.findMany({
      where: { doctorId: doctor.id, status: { not: "CANCELLED" } },
      include: {
        patient: { include: { user: { select: { name: true } } } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 100,
    }),
  ]);

  // ── derived stats ──────────────────────────────────────────────────────────
  const todayPatientCount = todayAppointments.filter(
    (a) => a.status !== "CANCELLED"
  ).length;
  const totalPatients = totalPatientRows.length;
  const revenueToday = completedTodayCount * Number(doctor.consultationFee);

  // ── recent patients (last 5 unique) ───────────────────────────────────────
  const seen = new Set<string>();
  const recentPatients: { patientId: string; name: string; lastVisit: Date }[] =
    [];
  for (const appt of recentApptRows) {
    if (!seen.has(appt.patientId) && recentPatients.length < 5) {
      seen.add(appt.patientId);
      recentPatients.push({
        patientId: appt.patientId,
        name: appt.patient.user.name ?? "Unknown",
        lastVisit: appt.scheduledAt,
      });
    }
  }

  const visitCounts = await Promise.all(
    recentPatients.map((p) =>
      prisma.appointment.count({
        where: {
          doctorId: doctor.id,
          patientId: p.patientId,
          status: { not: "CANCELLED" },
        },
      })
    )
  );

  // ── serialise for client component ────────────────────────────────────────
  const serializedAppointments: TodayAppointment[] = todayAppointments.map(
    (a) => ({
      id: a.id,
      scheduledAt: a.scheduledAt.toISOString(),
      status: a.status,
      type: a.type,
      reason: a.reason,
      patient: { user: { name: a.patient.user.name } },
      clinic: a.clinic ? { name: a.clinic.name } : null,
    })
  );

  // ── stats config ──────────────────────────────────────────────────────────
  const stats = [
    {
      label: "Today's Patients",
      value: todayPatientCount,
      color: "blue",
      iconPath:
        "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    },
    {
      label: "Total Patients",
      value: totalPatients,
      color: "indigo",
      iconPath:
        "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    },
    {
      label: "Pending",
      value: pendingCount,
      color: "yellow",
      iconPath:
        "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      label: "Revenue Today",
      value: `₹${revenueToday.toLocaleString("en-IN")}`,
      color: "green",
      iconPath:
        "M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  ] as const;

  const statColors: Record<string, { icon: string; card: string }> = {
    blue:   { icon: "bg-blue-50 text-blue-600",   card: "" },
    indigo: { icon: "bg-indigo-50 text-indigo-600", card: "" },
    yellow: { icon: "bg-yellow-50 text-yellow-600", card: "" },
    green:  { icon: "bg-green-50 text-green-600",  card: "" },
  };

  const quickActions = [
    {
      label: "New Prescription",
      emoji: "📋",
      href: "/doctor/prescriptions/new",
      cls: "bg-blue-50 text-blue-700 hover:bg-blue-100",
    },
    {
      label: "Add Patient",
      emoji: "➕",
      href: "/doctor/patients/add",
      cls: "bg-green-50 text-green-700 hover:bg-green-100",
    },
    {
      label: "View Analytics",
      emoji: "📊",
      href: "/doctor/analytics",
      cls: "bg-purple-50 text-purple-700 hover:bg-purple-100",
    },
    {
      label: "Manage Clinic",
      emoji: "🏥",
      href: "/doctor/clinic",
      cls: "bg-orange-50 text-orange-700 hover:bg-orange-100",
    },
  ];

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Navbar ── */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-blue-600">meddy</span>
            <span className="hidden sm:block text-gray-300 select-none">|</span>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-gray-900 leading-none">
                Dr. {stripDr(session.user.name)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {doctor.specialization}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {doctor.isVerified && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full font-medium">
                <svg
                  className="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Verified
              </span>
            )}
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Greeting ── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {getGreeting()}, Dr.{" "}
            {stripDr(session.user.name).split(" ")[0] || "Doctor"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Intl.DateTimeFormat("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Asia/Kolkata",
            }).format(new Date())}
          </p>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${statColors[stat.color].icon}`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d={stat.iconPath}
                  />
                </svg>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── Main grid: appointments + quick actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's appointments */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Today's Appointments
              </h2>
              <span className="text-sm text-gray-400">
                {todayAppointments.length} scheduled
              </span>
            </div>
            <AppointmentsPanel appointments={serializedAppointments} />
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl p-4 text-center transition-colors ${action.cls}`}
                >
                  <span className="text-2xl" aria-hidden>
                    {action.emoji}
                  </span>
                  <span className="text-xs font-medium leading-tight">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent patients ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Recent Patients
          </h2>

          {recentPatients.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <svg
                className="w-10 h-10 mx-auto mb-3 text-gray-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <p className="text-sm text-gray-500">No patients yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentPatients.map((patient, idx) => (
                <div
                  key={patient.patientId}
                  className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold shrink-0">
                    {patient.name[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {patient.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Last visit: {formatDate(patient.lastVisit)}
                    </p>
                  </div>

                  {/* Visit count */}
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-gray-900">
                      {visitCounts[idx]}
                    </p>
                    <p className="text-xs text-gray-400">
                      {visitCounts[idx] === 1 ? "visit" : "visits"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
