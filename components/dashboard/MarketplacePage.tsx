"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import axios from "axios";
import LogoutButton from "@/components/dashboard/LogoutButton";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Room {
  id: string;
  name: string;
  description: string | null;
  equipment: string[];
  pricePerHour: number;
  availableDays: string[];
  startTime: string;
  endTime: string;
  isActive: boolean;
  clinic: {
    id: string;
    name: string;
    city: string;
    state: string;
    address: string;
    phone: string;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function todayDow(): string {
  return DOW[new Date().getDay()];
}

function inr(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  role: "DOCTOR" | "PATIENT";
  userName: string;
  bookHref: (roomId: string) => string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarketplacePage({ role, userName, bookHref }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const [cityFilter, setCityFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const day = dateFilter
        ? DOW[new Date(dateFilter + "T12:00:00").getDay()]
        : todayDow();
      const params = new URLSearchParams();
      if (cityFilter.trim()) params.set("city", cityFilter.trim());
      if (day) params.set("day", day);
      const { data } = await axios.get<Room[]>(`/api/rooms?${params.toString()}`);
      setRooms(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [cityFilter, dateFilter]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const cities = Array.from(new Set(rooms.map((r) => r.clinic.city))).sort();

  const filtered = cityFilter
    ? rooms.filter((r) =>
        r.clinic.city.toLowerCase().includes(cityFilter.toLowerCase())
      )
    : rooms;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={role === "DOCTOR" ? "/doctor/dashboard" : "/patient/dashboard"}
              className="text-xl font-bold tracking-tight text-blue-600"
            >
              meddy
            </Link>
            <span className="text-slate-300 select-none">|</span>
            <span className="text-sm font-medium text-slate-700">
              Room Marketplace
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-slate-500">{userName}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            Room Marketplace
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Browse consultation rooms available from verified clinics
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <input
              type="text"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              placeholder="Filter by city…"
              list="city-list"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
            <datalist id="city-list">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>
        </div>

        {/* Room grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse space-y-4"
              >
                <div className="h-5 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-slate-100 rounded-full" />
                  <div className="h-5 w-20 bg-slate-100 rounded-full" />
                </div>
                <div className="h-9 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
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
                  d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700">
              No rooms available
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              {cityFilter
                ? `No rooms found in "${cityFilter}" for the selected date`
                : "No rooms available for the selected date"}
            </p>
            {cityFilter && (
              <button
                onClick={() => setCityFilter("")}
                className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Clear city filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-8">
            {filtered.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                role={role}
                bookHref={bookHref(room.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Room card ─────────────────────────────────────────────────────────────────

function RoomCard({
  room,
  role,
  bookHref,
}: {
  room: Room;
  role: "DOCTOR" | "PATIENT";
  bookHref: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-slate-800 leading-snug">{room.name}</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {room.clinic.name} · {room.clinic.city}, {room.clinic.state}
        </p>
      </div>

      {/* Description */}
      {room.description && (
        <p className="text-xs text-slate-500 line-clamp-2">{room.description}</p>
      )}

      {/* Equipment tags */}
      {room.equipment.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {room.equipment.slice(0, 4).map((e) => (
            <span
              key={e}
              className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium"
            >
              {e}
            </span>
          ))}
          {room.equipment.length > 4 && (
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
              +{room.equipment.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Availability */}
      <div className="flex flex-wrap gap-1">
        {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((d) => (
          <span
            key={d}
            className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              room.availableDays.includes(d)
                ? "bg-green-100 text-green-700"
                : "bg-slate-50 text-slate-300"
            }`}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Time + address */}
      <div className="text-xs text-slate-400 space-y-0.5">
        <p>
          {room.startTime} – {room.endTime}
        </p>
        <p className="truncate">{room.clinic.address}</p>
      </div>

      {/* Price + CTA */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
        <div>
          <span className="text-lg font-bold text-slate-900">
            {inr(room.pricePerHour)}
          </span>
          <span className="text-xs text-slate-400">/hr</span>
        </div>

        {role === "DOCTOR" ? (
          <Link
            href={bookHref}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-medium px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Book Room
          </Link>
        ) : (
          <span className="text-xs text-slate-400 italic">Doctors only</span>
        )}
      </div>
    </div>
  );
}
