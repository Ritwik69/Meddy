import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/dashboard/LogoutButton";

// ─── Helpers ──────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  ).getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  COMPLETED: "bg-slate-100 text-slate-600",
  NO_SHOW: "bg-orange-100 text-orange-700",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  NO_SHOW: "No Show",
};

// ─── Page ─────────────────────────────────────────────────

export default async function PatientDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const justBooked = sp.booked === "1";

  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "PATIENT") {
    redirect("/login");
  }

  const now = new Date();

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
  });

  if (!patient) redirect("/login");

  const [
    upcomingCount,
    totalRecords,
    activePrescriptions,
    upcomingAppointments,
    recentRecords,
  ] = await Promise.all([
    prisma.appointment.count({
      where: {
        patientId: patient.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        scheduledAt: { gt: now },
      },
    }),
    prisma.healthRecord.count({
      where: { patientId: patient.id },
    }),
    prisma.prescription.count({
      where: {
        patientId: patient.id,
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
    }),
    prisma.appointment.findMany({
      where: {
        patientId: patient.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        scheduledAt: { gt: now },
      },
      orderBy: { scheduledAt: "asc" },
      take: 2,
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        clinic: { select: { name: true } },
      },
    }),
    prisma.healthRecord.findMany({
      where: { patientId: patient.id },
      orderBy: { recordedAt: "desc" },
      take: 3,
      include: {
        doctor: { include: { user: { select: { name: true } } } },
      },
    }),
  ]);

  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const avatarLetter = (session.user.name ?? "P")[0].toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Navbar ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-blue-600"
          >
            meddy
          </Link>

          <div className="flex items-center gap-3">
            {session.user.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={session.user.image}
                alt={session.user.name ?? ""}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-semibold select-none">
                {avatarLetter}
              </div>
            )}
            <span className="hidden sm:block text-sm font-medium text-slate-700">
              {session.user.name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Booking success banner ── */}
        {justBooked && (
          <div className="flex items-start gap-3 px-4 py-3.5 bg-green-50 border border-green-100 rounded-2xl text-green-800 text-sm">
            <svg
              className="w-5 h-5 text-green-500 mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <p className="font-semibold">Appointment booked!</p>
              <p className="text-green-700 text-xs mt-0.5">
                Your appointment is confirmed. Check your upcoming appointments below.
              </p>
            </div>
          </div>
        )}

        {/* ── Welcome ── */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            Good {getGreeting()}, {firstName} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Here&apos;s a summary of your health activity.
          </p>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            label="Upcoming"
            sublabel="Appointments"
            value={upcomingCount}
            icon={<CalendarIcon />}
            color="blue"
          />
          <StatCard
            label="Health"
            sublabel="Records"
            value={totalRecords}
            icon={<RecordIcon />}
            color="teal"
          />
          <StatCard
            label="Active"
            sublabel="Prescriptions"
            value={activePrescriptions}
            icon={<PillIcon />}
            color="violet"
          />
        </div>

        {/* ── Upcoming Appointments ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              Upcoming Appointments
            </h2>
            <Link
              href="/patient/appointments"
              className="text-sm text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>

          {upcomingAppointments.length === 0 ? (
            <EmptyState message="No upcoming appointments. Book one below!" />
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4"
                >
                  {/* Date badge */}
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex flex-col items-center justify-center text-blue-600 shrink-0">
                    <span className="text-[10px] font-semibold leading-none uppercase">
                      {new Intl.DateTimeFormat("en-IN", {
                        month: "short",
                        timeZone: "Asia/Kolkata",
                      }).format(appt.scheduledAt)}
                    </span>
                    <span className="text-xl font-bold leading-tight">
                      {new Intl.DateTimeFormat("en-IN", {
                        day: "numeric",
                        timeZone: "Asia/Kolkata",
                      }).format(appt.scheduledAt)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">
                      Dr. {appt.doctor.user.name}
                    </p>
                    <p className="text-sm text-slate-500 truncate">
                      {appt.doctor.specialization}
                      {appt.clinic ? ` · ${appt.clinic.name}` : ""}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDateTime(appt.scheduledAt)}
                      {appt.type === "ONLINE" ? " · Online" : ""}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
                      STATUS_STYLES[appt.status] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {STATUS_LABELS[appt.status] ?? appt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Quick Actions ── */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction
              href="/patient/appointments/book"
              icon={<BookIcon />}
              label="Book Appointment"
              color="blue"
            />
            <QuickAction
              href="/patient/records"
              icon={<UploadIcon />}
              label="Upload Record"
              color="teal"
            />
            <QuickAction
              href="/patient/find-doctor"
              icon={<SearchIcon />}
              label="Find Doctor"
              color="violet"
            />
            <QuickAction
              href="/patient/family"
              icon={<FamilyIcon />}
              label="My Family"
              color="rose"
            />
          </div>
        </section>

        {/* ── Recent Health Records ── */}
        <section className="pb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              Recent Health Records
            </h2>
            <Link
              href="/patient/records"
              className="text-sm text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>

          {recentRecords.length === 0 ? (
            <EmptyState message="No health records yet." />
          ) : (
            <div className="space-y-3">
              {recentRecords.map((record) => (
                <div
                  key={record.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                    <FileIcon hasAttachments={record.attachments.length > 0} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">
                      {record.diagnosis}
                    </p>
                    <p className="text-sm text-slate-500 truncate">
                      {record.doctor
                        ? `Dr. ${record.doctor.user.name}`
                        : "Self-uploaded"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDate(record.recordedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────

function StatCard({
  label,
  sublabel,
  value,
  icon,
  color,
}: {
  label: string;
  sublabel: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "teal" | "violet";
}) {
  const bg = {
    blue: "bg-blue-50",
    teal: "bg-teal-50",
    violet: "bg-violet-50",
  }[color];
  const iconColor = {
    blue: "text-blue-600",
    teal: "text-teal-600",
    violet: "text-violet-600",
  }[color];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
      <div
        className={`w-9 h-9 rounded-xl ${bg} ${iconColor} flex items-center justify-center`}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500 leading-tight">
          {label}
          <br />
          {sublabel}
        </p>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  color: "blue" | "teal" | "violet" | "rose";
}) {
  const bg = {
    blue: "bg-blue-50 hover:bg-blue-100",
    teal: "bg-teal-50 hover:bg-teal-100",
    violet: "bg-violet-50 hover:bg-violet-100",
    rose: "bg-rose-50 hover:bg-rose-100",
  }[color];
  const iconColor = {
    blue: "text-blue-600",
    teal: "text-teal-600",
    violet: "text-violet-600",
    rose: "text-rose-600",
  }[color];

  return (
    <Link
      href={href}
      className={`${bg} rounded-2xl p-4 flex flex-col items-center gap-2 text-center transition-colors`}
    >
      <div className={`w-10 h-10 flex items-center justify-center ${iconColor}`}>
        {icon}
      </div>
      <span className="text-xs font-medium text-slate-700 leading-tight">
        {label}
      </span>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 text-sm">
      {message}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function RecordIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        d="M9 12h6M9 16h4M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PillIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="m10.5 20.5-7-7a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z" />
      <path d="m8.5 8.5 7 7" strokeLinecap="round" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path
        d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
        strokeLinecap="round"
      />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function FamilyIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path
        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FileIcon({ hasAttachments }: { hasAttachments: boolean }) {
  if (hasAttachments) {
    return (
      <svg
        className="w-5 h-5 text-teal-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" strokeLinecap="round" />
        <line x1="9" y1="15" x2="15" y2="15" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg
      className="w-5 h-5 text-teal-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" />
      <line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" />
    </svg>
  );
}
