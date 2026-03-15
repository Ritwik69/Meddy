"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoomInfo {
  id: string;
  name: string;
  pricePerHour: number;
  availableDays: string[];
  startTime: string;
  endTime: string;
  clinic: { name: string; city: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function addHour(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function generateSlots(startTime: string, endTime: string): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  let cur = startTime;
  while (toMinutes(addHour(cur)) <= toMinutes(endTime)) {
    slots.push({ start: cur, end: addHour(cur) });
    cur = addHour(cur);
  }
  return slots;
}

function isDayAvailable(dateStr: string, availableDays: string[]): boolean {
  const d = new Date(dateStr + "T12:00:00");
  return availableDays.includes(DOW_SHORT[d.getDay()]);
}

function inr(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoomBookingClient({ room }: { room: RoomInfo }) {
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  const slots = useMemo(() => generateSlots(room.startTime, room.endTime), [room]);
  const dayAvailable = isDayAvailable(date, room.availableDays);

  const totalCost = selectedSlot ? room.pricePerHour : 0;

  async function handleConfirm() {
    if (!selectedSlot) return;
    setError("");
    setBooking(true);
    try {
      await axios.post(`/api/rooms/${room.id}/book`, {
        date,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
      });
      router.push(`/doctor/rooms/bookings?booked=1`);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
      setError(msg ?? "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6 pb-8">
      <h2 className="text-base font-semibold text-slate-800">Select Date & Time</h2>

      {/* Date picker */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => {
            setDate(e.target.value);
            setSelectedSlot(null);
          }}
          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {date && !dayAvailable && (
          <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Room not available on{" "}
            {DOW_SHORT[new Date(date + "T12:00:00").getDay()]}s — choose another date
          </p>
        )}
      </div>

      {/* Time slots */}
      {dayAvailable && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Time Slot <span className="text-red-500">*</span>
          </label>
          {slots.length === 0 ? (
            <p className="text-sm text-slate-400">No hourly slots available for this room.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => {
                const active = selectedSlot?.start === slot.start;
                return (
                  <button
                    key={slot.start}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-colors ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                    }`}
                  >
                    {slot.start}–{slot.end}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Summary + confirm */}
      {selectedSlot && dayAvailable && (
        <div className="space-y-4">
          {/* Booking summary */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Booking Summary</h3>
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="text-slate-500">Room</span>
              <span className="font-medium text-slate-800 text-right">{room.name}</span>

              <span className="text-slate-500">Clinic</span>
              <span className="font-medium text-slate-800 text-right">
                {room.clinic.name}, {room.clinic.city}
              </span>

              <span className="text-slate-500">Date</span>
              <span className="font-medium text-slate-800 text-right">
                {new Intl.DateTimeFormat("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(date + "T12:00:00"))}
              </span>

              <span className="text-slate-500">Time</span>
              <span className="font-medium text-slate-800 text-right">
                {selectedSlot.start} – {selectedSlot.end}
              </span>

              <span className="text-slate-500 pt-2 border-t border-slate-200">Total</span>
              <span className="font-bold text-slate-900 text-right pt-2 border-t border-slate-200">
                {inr(totalCost)}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
              {error}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={booking}
            className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {booking ? "Confirming…" : `Confirm Booking · ${inr(totalCost)}`}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Booking is immediately confirmed. Contact the clinic to cancel.
          </p>
        </div>
      )}
    </div>
  );
}
