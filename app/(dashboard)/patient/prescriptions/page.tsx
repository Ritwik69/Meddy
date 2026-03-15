"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import axios from "axios";
import LogoutButton from "@/components/dashboard/LogoutButton";
import type { MedicationValues } from "@/schemas/prescription";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Prescription {
  id: string;
  diagnosis: string | null;
  medications: MedicationValues[];
  notes: string | null;
  issuedAt: string;
  validUntil: string | null;
  doctor: {
    specialization: string;
    user: { name: string | null };
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function isExpired(validUntil: string | null) {
  if (!validUntil) return false;
  return new Date() > new Date(validUntil);
}

// ── PDF generation ────────────────────────────────────────────────────────────

async function downloadPDF(rx: Prescription, patientName: string) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 22;

  // ── Header ──
  doc.setFontSize(22);
  doc.setTextColor(37, 99, 235);
  doc.setFont("helvetica", "bold");
  doc.text("meddy", margin, y);

  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.setFont("helvetica", "normal");
  doc.text("Digital Health Platform", margin, y + 6);

  doc.setFontSize(8);
  doc.text(`Rx ID: ${rx.id.slice(-10).toUpperCase()}`, W - margin, y, {
    align: "right",
  });
  doc.text(`Date: ${formatDate(rx.issuedAt)}`, W - margin, y + 6, {
    align: "right",
  });

  y += 14;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(margin, y, W - margin, y);
  y += 10;

  // ── Doctor ──
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.text(`Dr. ${rx.doctor.user.name ?? ""}`, margin, y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(rx.doctor.specialization, margin, y + 6);
  y += 16;

  // ── Patient ──
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text("Patient", margin, y);
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.text(patientName, margin, y + 6);
  doc.setFont("helvetica", "normal");
  y += 16;

  // ── Diagnosis ──
  if (rx.diagnosis) {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("Diagnosis", margin, y);
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(rx.diagnosis, margin, y + 6);
    y += 16;
  }

  // ── Medications table ──
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text("MEDICATIONS", margin, y);
  y += 5;

  const tableW = W - 2 * margin;
  const colX = [margin, margin + 50, margin + 78, margin + 110, margin + 138];
  const rowH = 9;
  const headerH = 8;

  // Header
  doc.setFillColor(239, 246, 255);
  doc.rect(margin, y, tableW, headerH, "F");
  doc.setFontSize(8);
  doc.setTextColor(37, 99, 235);
  doc.setFont("helvetica", "bold");
  ["Medicine", "Dosage", "Frequency", "Duration", "Instructions"].forEach(
    (h, i) => doc.text(h, colX[i] + 2, y + 5.5)
  );
  y += headerH;

  doc.setFont("helvetica", "normal");
  rx.medications.forEach((med, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, tableW, rowH, "F");
    }
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.text(med.name, colX[0] + 2, y + 6);
    doc.text(med.dosage, colX[1] + 2, y + 6);
    doc.text(med.frequency.join(", "), colX[2] + 2, y + 6);
    doc.text(med.duration, colX[3] + 2, y + 6);
    doc.text(med.instructions ?? "—", colX[4] + 2, y + 6);
    y += rowH;
  });
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.rect(
    margin,
    y - rx.medications.length * rowH - headerH,
    tableW,
    rx.medications.length * rowH + headerH,
    "S"
  );

  y += 10;

  // ── Notes ──
  if (rx.notes) {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("Notes", margin, y);
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    const lines = doc.splitTextToSize(rx.notes, tableW);
    doc.text(lines, margin, y + 6);
    y += 6 + lines.length * 5 + 8;
  }

  // ── Valid Until ──
  if (rx.validUntil) {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("Valid Until", margin, y);
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text(formatDate(rx.validUntil), margin, y + 6);
    y += 14;
  }

  // ── Footer ──
  const footerY = doc.internal.pageSize.getHeight() - 18;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, footerY, W - margin, footerY);
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text(
    "Digitally generated by Meddy Healthcare Platform · meddy.app",
    margin,
    footerY + 6
  );

  doc.save(`prescription-${rx.id.slice(-10).toUpperCase()}.pdf`);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PatientPrescriptionsPage() {
  const { data: session } = useSession();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchPrescriptions = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/prescriptions");
      setPrescriptions(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  async function handleDownload(rx: Prescription) {
    setDownloading(rx.id);
    try {
      await downloadPDF(rx, session?.user.name ?? "Patient");
    } finally {
      setDownloading(null);
    }
  }

  const avatarLetter = (session?.user.name ?? "P")[0].toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Navbar ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/patient/dashboard"
            className="text-xl font-bold tracking-tight text-blue-600"
          >
            meddy
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-semibold select-none">
              {avatarLetter}
            </div>
            <span className="hidden sm:block text-sm font-medium text-slate-700">
              {session?.user.name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 pb-12">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            My Prescriptions
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Prescriptions issued by your doctors
          </p>
        </div>

        {/* ── Skeleton ── */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-pulse"
              >
                <div className="h-4 bg-slate-100 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-1/4 mb-5" />
                <div className="space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : prescriptions.length === 0 ? (
          /* ── Empty state ── */
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
                  d="m10.5 20.5-7-7a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7zM8.5 8.5l7 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700">
              No prescriptions yet
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Prescriptions from your doctor will appear here
            </p>
          </div>
        ) : (
          /* ── Prescription cards ── */
          <div className="space-y-4">
            {prescriptions.map((rx) => {
              const expired = isExpired(rx.validUntil);
              return (
                <div
                  key={rx.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                >
                  {/* Card header */}
                  <div className="px-6 py-4 flex items-start justify-between gap-4 border-b border-slate-50">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800">
                          Dr. {rx.doctor.user.name ?? "Unknown"}
                        </p>
                        <span className="text-xs text-slate-400">
                          · {rx.doctor.specialization}
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            expired
                              ? "bg-red-100 text-red-600"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {expired ? "Expired" : "Active"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Issued {formatDate(rx.issuedAt)}
                        {rx.validUntil &&
                          ` · Valid until ${formatDate(rx.validUntil)}`}
                      </p>
                      {rx.diagnosis && (
                        <p className="text-sm text-slate-600 mt-1.5 font-medium">
                          {rx.diagnosis}
                        </p>
                      )}
                    </div>

                    {/* Download button */}
                    <button
                      onClick={() => handleDownload(rx)}
                      disabled={downloading === rx.id}
                      className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 disabled:opacity-50 transition-colors"
                    >
                      {downloading === rx.id ? (
                        <svg
                          className="w-3.5 h-3.5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      ) : (
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
                      )}
                      PDF
                    </button>
                  </div>

                  {/* Medicines list */}
                  <div className="px-6 py-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                      {rx.medications.length} Medicine
                      {rx.medications.length !== 1 ? "s" : ""}
                    </p>
                    <div className="space-y-3">
                      {rx.medications.map((med, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 py-2.5 px-3 bg-slate-50 rounded-xl"
                        >
                          {/* Pill icon */}
                          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                            <svg
                              className="w-3.5 h-3.5 text-blue-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m10.5 20.5-7-7a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7zM8.5 8.5l7 7"
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-800">
                                {med.name}
                              </p>
                              <span className="text-xs text-slate-500">
                                {med.dosage}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <div className="flex gap-1">
                                {med.frequency.map((f) => (
                                  <span
                                    key={f}
                                    className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium"
                                  >
                                    {f[0]}
                                  </span>
                                ))}
                              </div>
                              <span className="text-xs text-slate-400">
                                · {med.duration}
                              </span>
                              {med.instructions && (
                                <span className="text-xs text-slate-400">
                                  · {med.instructions}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    {rx.notes && (
                      <div className="mt-4 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                        <p className="text-xs font-semibold text-amber-700 mb-1">
                          Doctor&apos;s Notes
                        </p>
                        <p className="text-sm text-amber-800">{rx.notes}</p>
                      </div>
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
