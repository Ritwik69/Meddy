import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/dashboard/LogoutButton";
import type { MedicationValues } from "@/schemas/prescription";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function prescriptionStatus(validUntil: Date | null): {
  label: string;
  cls: string;
} {
  if (!validUntil) return { label: "Active", cls: "bg-green-100 text-green-700" };
  if (new Date() > validUntil)
    return { label: "Expired", cls: "bg-red-100 text-red-600" };
  return { label: "Active", cls: "bg-green-100 text-green-700" };
}

export default async function DoctorPrescriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const justCreated = sp.created === "1";

  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DOCTOR") redirect("/login");

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!doctor) redirect("/login");

  const prescriptions = await prisma.prescription.findMany({
    where: { doctorId: doctor.id },
    select: {
      id: true,
      diagnosis: true,
      medications: true,
      issuedAt: true,
      validUntil: true,
      patient: {
        select: { user: { select: { name: true, phone: true } } },
      },
    },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Navbar ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/doctor/dashboard"
              className="text-xl font-bold text-blue-600"
            >
              meddy
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-medium text-slate-700">
              Prescriptions
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/doctor/prescriptions/new"
              className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* ── Success banner ── */}
        {justCreated && (
          <div className="flex items-center gap-3 px-4 py-3.5 bg-green-50 border border-green-100 rounded-2xl text-green-800 text-sm">
            <svg
              className="w-5 h-5 text-green-500 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="font-medium">
              Prescription saved and sent to patient.
            </p>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Prescriptions
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {prescriptions.length} total
            </p>
          </div>
        </div>

        {/* ── List ── */}
        {prescriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700">
              No prescriptions yet
            </h3>
            <p className="text-sm text-slate-400 mt-1 mb-6">
              Create your first prescription for a patient
            </p>
            <Link
              href="/doctor/prescriptions/new"
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Prescription
            </Link>
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            {prescriptions.map((rx) => {
              const meds = rx.medications as MedicationValues[];
              const { label, cls } = prescriptionStatus(rx.validUntil);
              return (
                <div
                  key={rx.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4"
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                      />
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800">
                        {rx.patient.user.name ?? "Unknown Patient"}
                      </p>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}
                      >
                        {label}
                      </span>
                    </div>
                    {rx.diagnosis && (
                      <p className="text-sm text-slate-500 truncate mt-0.5">
                        {rx.diagnosis}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {meds.length} medicine{meds.length !== 1 ? "s" : ""} ·{" "}
                      {formatDate(rx.issuedAt)}
                    </p>
                  </div>

                  {/* Medicines preview */}
                  <div className="hidden sm:flex flex-col gap-1 shrink-0 max-w-[180px]">
                    {meds.slice(0, 2).map((m, i) => (
                      <span
                        key={i}
                        className="text-xs text-slate-500 truncate"
                      >
                        · {m.name} {m.dosage}
                      </span>
                    ))}
                    {meds.length > 2 && (
                      <span className="text-xs text-slate-400">
                        +{meds.length - 2} more
                      </span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="hidden lg:block text-right shrink-0">
                    <p className="text-xs text-slate-400">
                      {formatDate(rx.issuedAt)}
                    </p>
                    {rx.validUntil && (
                      <p className="text-xs text-slate-400">
                        until {formatDate(rx.validUntil)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
