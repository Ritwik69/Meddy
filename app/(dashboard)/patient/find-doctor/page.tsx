"use client";

import { useState, useDeferredValue } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { useDoctors, type DoctorResult } from "@/hooks/useDoctors";
import LogoutButton from "@/components/dashboard/LogoutButton";

// ─── Constants ────────────────────────────────────────────

const SPECIALTIES = [
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "ENT",
  "Gastroenterology",
  "General Medicine",
  "General Surgery",
  "Gynecology",
  "Nephrology",
  "Neurology",
  "Oncology",
  "Ophthalmology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Pulmonology",
  "Radiology",
  "Rheumatology",
  "Urology",
];

// ─── Helpers ──────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return "Dr";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function getNextSlot(
  schedule: Record<string, Array<{ start: string; end: string }>> | null
): string {
  if (!schedule) return "Contact clinic";
  const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date().getDay();

  for (let i = 0; i <= 6; i++) {
    const idx = (today + i) % 7;
    const slots = schedule[keys[idx]];
    if (slots && slots.length > 0) {
      if (i === 0) return `Today · ${slots[0].start}`;
      if (i === 1) return `Tomorrow · ${slots[0].start}`;
      return `${labels[idx]} · ${slots[0].start}`;
    }
  }
  return "Contact clinic";
}

function activeFilterCount(
  specialty: string,
  city: string,
  minRating: number
): number {
  return [specialty, city, minRating > 0].filter(Boolean).length;
}

// ─── Page ─────────────────────────────────────────────────

export default function FindDoctorPage() {
  const { data: session, status } = useSession();

  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Defer search/city so typing doesn't fire a request on every keystroke
  const deferredSearch = useDeferredValue(search);
  const deferredCity = useDeferredValue(city);

  const { data: doctors, isLoading, isError } = useDoctors({
    search: deferredSearch,
    specialization: specialty,
    city: deferredCity,
  });

  // Client-side rating filter (no rating data yet; minRating > 0 yields empty)
  const filtered = (doctors ?? []).filter(() => minRating === 0);

  if (status === "loading") return <FullPageLoader />;
  if (status === "unauthenticated") {
    redirect("/login");
  }

  const userName = session?.user?.name ?? "";
  const avatarLetter = userName[0]?.toUpperCase() ?? "P";
  const filterCount = activeFilterCount(specialty, city, minRating);

  function clearFilters() {
    setSpecialty("");
    setCity("");
    setMinRating(0);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Navbar ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-blue-600"
          >
            meddy
          </Link>
          <div className="flex items-center gap-3">
            {session?.user?.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={session.user.image}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-semibold select-none">
                {avatarLetter}
              </div>
            )}
            <span className="hidden sm:block text-sm font-medium text-slate-700">
              {userName}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-12">
        {/* ── Page heading ── */}
        <div className="mb-6">
          <Link
            href="/patient/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3 transition-colors"
          >
            <ChevronLeftIcon />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-slate-800">
            Find a Doctor
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Browse verified doctors across India.
          </p>
        </div>

        {/* ── Search bar ── */}
        <div className="relative mb-5">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by doctor name or specialty…"
            className="w-full pl-11 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Mobile filter toggle ── */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <FilterIcon className="w-4 h-4 text-slate-500" />
            Filters
            {filterCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full leading-none">
                {filterCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Layout: sidebar + cards ── */}
        <div className="flex gap-6 items-start">
          {/* ── Filter sidebar ── */}
          <aside
            className={`${
              filtersOpen ? "block" : "hidden"
            } lg:block w-full lg:w-60 shrink-0`}
          >
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">
                  Filters
                </h3>
                {filterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Specialty */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Specialty
                </label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All specialties</option>
                  {SPECIALTIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* City */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Mumbai"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Min Rating */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Min Rating
                </label>
                <div className="flex gap-1.5">
                  {[0, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setMinRating(r)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        minRating === r
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      {r === 0 ? "All" : `${r}+★`}
                    </button>
                  ))}
                </div>
                {minRating > 0 && (
                  <p className="text-xs text-slate-400 mt-2 leading-snug">
                    Ratings feature coming soon
                  </p>
                )}
              </div>
            </div>
          </aside>

          {/* ── Doctor cards ── */}
          <div className="flex-1 min-w-0">
            {/* Result count */}
            {!isLoading && !isError && (
              <p className="text-sm text-slate-500 mb-4">
                {filtered.length === 0
                  ? "No doctors found"
                  : `${filtered.length} doctor${filtered.length === 1 ? "" : "s"} found`}
              </p>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : isError ? (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center text-red-500 text-sm">
                Failed to load doctors. Please try again.
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState onClear={filterCount > 0 ? clearFilters : undefined} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((doctor) => (
                  <DoctorCard key={doctor.id} doctor={doctor} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Doctor card ──────────────────────────────────────────

function DoctorCard({ doctor }: { doctor: DoctorResult }) {
  const initials = getInitials(doctor.user.name);
  const firstClinic = doctor.clinics[0];
  const nextSlot = getNextSlot(firstClinic?.schedule ?? null);
  const fee = parseFloat(doctor.consultationFee);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-bold shrink-0 select-none">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-800 truncate">
              Dr. {doctor.user.name}
            </h3>
            {doctor.isVerified && (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
                <CheckIcon className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>
          <p className="text-sm text-blue-600 font-medium mt-0.5">
            {doctor.specialization}
          </p>
          {firstClinic && (
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {firstClinic.clinic.name} &middot;{" "}
              {firstClinic.clinic.city || doctor.city}
            </p>
          )}
          {!firstClinic && doctor.city && (
            <p className="text-xs text-slate-400 mt-0.5">{doctor.city}</p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
        {/* Experience */}
        <span className="flex items-center gap-1.5">
          <BriefcaseIcon className="w-4 h-4 text-slate-400" />
          {doctor.experienceYears} yr{doctor.experienceYears !== 1 ? "s" : ""} exp
        </span>

        {/* Rating */}
        <StarRating />

        {/* Fee */}
        <span className="flex items-center gap-0.5 font-medium">
          <span className="text-slate-400 text-xs">₹</span>
          {isNaN(fee)
            ? doctor.consultationFee
            : fee.toLocaleString("en-IN")}
          <span className="text-slate-400 text-xs font-normal ml-0.5">
            / visit
          </span>
        </span>
      </div>

      {/* Next available slot */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 rounded-xl text-xs">
        <ClockIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="text-emerald-700 font-medium">
          Next available: {nextSlot}
        </span>
      </div>

      {/* CTA */}
      <Link
        href={`/patient/book/${doctor.id}`}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl text-center transition-colors"
      >
        Book Appointment
      </Link>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────

function EmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">
        <svg
          className="w-10 h-10 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.4}
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path
            d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className="text-slate-700 font-semibold text-base mb-1">
        No doctors found
      </h3>
      <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
        Try adjusting your search or filters to find the right doctor for you.
      </p>
      {onClear && (
        <button
          onClick={onClear}
          className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-2xl bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-slate-200 rounded-lg w-3/4" />
          <div className="h-3 bg-slate-200 rounded-lg w-1/2" />
          <div className="h-3 bg-slate-200 rounded-lg w-2/5" />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="h-3 bg-slate-200 rounded-lg w-20" />
        <div className="h-3 bg-slate-200 rounded-lg w-16" />
        <div className="h-3 bg-slate-200 rounded-lg w-16" />
      </div>
      <div className="h-9 bg-slate-200 rounded-xl" />
      <div className="h-10 bg-slate-200 rounded-xl" />
    </div>
  );
}

// ─── Star rating ──────────────────────────────────────────

function StarRating() {
  // No ratings yet — display greyed stars with label
  return (
    <span className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className="w-3.5 h-3.5 text-slate-200"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-xs text-slate-400 ml-0.5">No reviews</span>
    </span>
  );
}

// ─── Full page loader ─────────────────────────────────────

function FullPageLoader() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Loading…</div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M3 6h18M7 12h10M11 18h2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path
        d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  );
}
