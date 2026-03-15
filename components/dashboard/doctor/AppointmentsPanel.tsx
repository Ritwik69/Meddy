"use client";

import { useState } from "react";
import axios from "axios";

type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

export interface TodayAppointment {
  id: string;
  scheduledAt: string; // ISO string
  status: AppointmentStatus;
  type: "IN_PERSON" | "ONLINE";
  reason: string | null;
  patient: { user: { name: string | null } };
  clinic: { name: string } | null;
}

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-700",
  COMPLETED: "bg-green-100 text-green-800",
  NO_SHOW: "bg-gray-100 text-gray-600",
};

function formatIST(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export default function AppointmentsPanel({
  appointments: initial,
}: {
  appointments: TodayAppointment[];
}) {
  const [appointments, setAppointments] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(id: string, status: "CONFIRMED" | "CANCELLED") {
    setLoading(id + status);
    try {
      await axios.patch(`/api/appointments/${id}`, { status });
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    } catch {
      alert("Failed to update. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <svg
          className="w-12 h-12 mx-auto mb-3 text-gray-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="font-medium text-gray-500">No appointments today</p>
        <p className="text-sm mt-1">Enjoy your free day!</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {appointments.map((appt) => (
        <div
          key={appt.id}
          className="flex items-center gap-3 sm:gap-4 py-4 first:pt-0 last:pb-0"
        >
          {/* Time */}
          <div className="w-16 text-center shrink-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              {formatIST(appt.scheduledAt)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {appt.type === "ONLINE" ? "Online" : "In-person"}
            </p>
          </div>

          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm shrink-0">
            {(appt.patient.user.name ?? "?")[0].toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {appt.patient.user.name ?? "Unknown Patient"}
            </p>
            {appt.reason && (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {appt.reason}
              </p>
            )}
          </div>

          {/* Status badge */}
          <span
            className={`hidden sm:inline-flex text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[appt.status]}`}
          >
            {appt.status.charAt(0) + appt.status.slice(1).toLowerCase()}
          </span>

          {/* Actions */}
          {appt.status === "PENDING" ? (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => updateStatus(appt.id, "CONFIRMED")}
                disabled={!!loading}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading === appt.id + "CONFIRMED" ? "..." : "Confirm"}
              </button>
              <button
                onClick={() => updateStatus(appt.id, "CANCELLED")}
                disabled={!!loading}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {loading === appt.id + "CANCELLED" ? "..." : "Cancel"}
              </button>
            </div>
          ) : (
            <span
              className={`sm:hidden text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[appt.status]}`}
            >
              {appt.status.charAt(0) + appt.status.slice(1).toLowerCase()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
