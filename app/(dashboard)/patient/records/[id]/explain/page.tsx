import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/dashboard/LogoutButton";
import ExplainClient from "@/components/dashboard/patient/ExplainClient";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

const CATEGORY_COLORS: Record<string, string> = {
  "Blood Report": "bg-red-100 text-red-700",
  Scan: "bg-blue-100 text-blue-700",
  Prescription: "bg-violet-100 text-violet-700",
  "X-Ray": "bg-orange-100 text-orange-700",
  Other: "bg-gray-100 text-gray-600",
};

export default async function ExplainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PATIENT") redirect("/login");

  const patient = await prisma.patient.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!patient) redirect("/login");

  const record = await prisma.healthRecord.findUnique({
    where: { id },
    include: {
      doctor: { include: { user: { select: { name: true } } } },
    },
  });

  if (!record || record.patientId !== patient.id) redirect("/patient/records");

  const category = (record.symptoms as string[])[0] ?? "Other";
  const fileUrl = (record.attachments as string[])[0] ?? null;
  const ext = fileUrl?.split(".").pop()?.toLowerCase();
  const fileType = ext === "pdf" ? "pdf" : "image";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Navbar ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/patient/dashboard"
              className="text-xl font-bold tracking-tight text-blue-600"
            >
              meddy
            </Link>
            <span className="text-slate-300 select-none">|</span>
            <Link
              href="/patient/records"
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Records
            </Link>
            <span className="text-slate-300 select-none">/</span>
            <span className="text-sm font-medium text-slate-700">
              AI Explainer
            </span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* ── Record details card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-start gap-4">
            {/* File icon */}
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                fileType === "pdf" ? "bg-red-50" : "bg-blue-50"
              }`}
            >
              {fileType === "pdf" ? (
                <svg
                  className="w-6 h-6 text-red-500"
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
              ) : (
                <svg
                  className="w-6 h-6 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-lg font-semibold text-slate-800">
                  {record.diagnosis ?? "Health Record"}
                </h1>
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                    CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {category}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {formatDate(record.recordedAt)}
              </p>
              {record.doctor && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Dr. {record.doctor.user.name}
                </p>
              )}
            </div>

            {/* Download link */}
            {fileUrl && (
              <a
                href={fileUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-50 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download
              </a>
            )}
          </div>
        </div>

        {/* ── AI Explainer ── */}
        <ExplainClient recordId={id} />

        {/* ── Disclaimer ── */}
        <div className="flex gap-3 px-4 py-3.5 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-sm">
          <svg
            className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <p>
            <span className="font-semibold">Disclaimer:</span> This explanation
            is AI-generated and is for informational purposes only. It is{" "}
            <strong>not medical advice</strong>. Always consult your doctor or a
            qualified healthcare professional for diagnosis and treatment.
          </p>
        </div>
      </main>
    </div>
  );
}
