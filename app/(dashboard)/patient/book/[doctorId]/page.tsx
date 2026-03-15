"use client";

import { use, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import LogoutButton from "@/components/dashboard/LogoutButton";

// ─── Types ────────────────────────────────────────────────

type Schedule = Record<string, { start: string; end: string }[]>;
type ApptType = "IN_PERSON" | "ONLINE";

interface ClinicDetail {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
}

interface DoctorClinicEntry {
  id: string;       // DoctorClinic row id
  clinicId: string; // Clinic.id (FK)
  schedule: Schedule | null;
  clinic: ClinicDetail;
}

interface DoctorDetail {
  id: string;
  specialization: string;
  consultationFee: string;
  experienceYears: number;
  isVerified: boolean;
  city: string | null;
  user: { name: string | null };
  clinics: DoctorClinicEntry[];
}

interface SlotEntry {
  time: string;   // "09:00"
  booked: boolean;
  past: boolean;
}

// ─── Constants ────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_KEYS   = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// ─── Date / time helpers ──────────────────────────────────

/** Returns "YYYY-MM-DD" in IST for any Date object. */
function toISTDateStr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Returns "HH:MM" (24-h) in IST from an ISO timestamp string. */
function toISTTimeStr(iso: string): string {
  const d = new Date(iso);
  const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  return (
    String(ist.getUTCHours()).padStart(2, "0") +
    ":" +
    String(ist.getUTCMinutes()).padStart(2, "0")
  );
}

/** Current IST time as "HH:MM". */
function nowISTStr(): string {
  return toISTTimeStr(new Date().toISOString());
}

/** "Monday, 16 March 2026" */
function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "9:00 AM" */
function formatTime12(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function getInitials(name: string | null): string {
  if (!name) return "Dr";
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ─── Slot generation ──────────────────────────────────────

function generateSlots(
  schedule: Schedule | null,
  date: Date,
  bookedTimes: Set<string>,
  duration = 30
): SlotEntry[] {
  if (!schedule) return [];

  const key = DAY_KEYS[date.getDay()];
  const blocks = schedule[key] ?? [];
  if (!blocks.length) return [];

  const todayStr = toISTDateStr(new Date());
  const dateStr  = toISTDateStr(date);
  const isToday  = dateStr === todayStr;
  const currentT = isToday ? nowISTStr() : "00:00";

  const slots: SlotEntry[] = [];

  for (const block of blocks) {
    const [sh, sm] = block.start.split(":").map(Number);
    const [eh, em] = block.end.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;

    while (cur + duration <= end) {
      const hh = String(Math.floor(cur / 60)).padStart(2, "0");
      const mm = String(cur % 60).padStart(2, "0");
      const timeStr = `${hh}:${mm}`;
      slots.push({
        time: timeStr,
        booked: bookedTimes.has(timeStr),
        past: isToday && timeStr <= currentT,
      });
      cur += duration;
    }
  }

  return slots;
}

// ─── Page ─────────────────────────────────────────────────

export default function BookPage({
  params,
}: {
  params: Promise<{ doctorId: string }>;
}) {
  const { doctorId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  // ── Step state ──
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Step 1 state ──
  const [selectedDcId, setSelectedDcId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calYear, setCalYear]   = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  // ── Step 2 state ──
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // ── Step 3 state ──
  const [apptType, setApptType]   = useState<ApptType>("IN_PERSON");
  const [reason, setReason]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookError, setBookError]   = useState("");

  // ── Fetch doctor ──
  const { data: doctor, isLoading, isError } = useQuery({
    queryKey: ["doctor", doctorId],
    queryFn: async () => {
      const { data } = await axios.get<{ doctor: DoctorDetail }>(
        `/api/doctors/${doctorId}`
      );
      return data.doctor;
    },
  });

  // Auto-select when single clinic; otherwise use user selection
  const activeDc: DoctorClinicEntry | null = doctor
    ? doctor.clinics.find((dc) => dc.id === selectedDcId) ??
      (doctor.clinics.length === 1 ? doctor.clinics[0] : null)
    : null;

  // ── Fetch booked slots when date changes ──
  const dateStr = selectedDate ? toISTDateStr(selectedDate) : null;
  const { data: bookedAppts } = useQuery({
    queryKey: ["booked-slots", doctorId, dateStr],
    queryFn: async () => {
      const { data } = await axios.get<{ appointments: { scheduledAt: string }[] }>(
        `/api/appointments?doctorId=${doctorId}&date=${dateStr}`
      );
      return data.appointments;
    },
    enabled: !!dateStr,
  });

  const bookedTimes = new Set(
    (bookedAppts ?? []).map((a) => toISTTimeStr(a.scheduledAt))
  );

  const slots =
    activeDc && selectedDate
      ? generateSlots(activeDc.schedule, selectedDate, bookedTimes)
      : [];

  // ── Auth guard ──
  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  // ── Step handlers ──
  function goToStep2() {
    setSelectedSlot(null);
    setStep(2);
  }
  function goToStep3() {
    setStep(3);
  }

  async function handleConfirm() {
    if (!activeDc || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    setBookError("");
    try {
      const dStr = toISTDateStr(selectedDate);
      const scheduledAt = `${dStr}T${selectedSlot}:00+05:30`;
      await axios.post("/api/appointments", {
        doctorId,
        clinicId: activeDc.clinicId,
        scheduledAt,
        type: apptType,
        reason: reason.trim() || undefined,
      });
      router.push("/patient/dashboard?booked=1");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? "Booking failed. Please try again.")
        : "Booking failed. Please try again.";
      setBookError(msg);
      setSubmitting(false);
    }
  }

  const userName     = session?.user?.name ?? "";
  const avatarLetter = userName[0]?.toUpperCase() ?? "P";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Navbar ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-16">
        {/* ── Back + title ── */}
        <div className="mb-6">
          <Link
            href="/patient/find-doctor"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Find a Doctor
          </Link>
          <h1 className="text-2xl font-semibold text-slate-800">
            Book Appointment
          </h1>
        </div>

        {/* ── Stepper ── */}
        <Stepper step={step} />

        {/* ── Content ── */}
        <div className="mt-6">
          {isLoading ? (
            <SkeletonLoader />
          ) : isError || !doctor ? (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center text-red-500 text-sm">
              Could not load doctor details. Please go back and try again.
            </div>
          ) : (
            <>
              {step === 1 && (
                <Step1
                  doctor={doctor}
                  activeDc={activeDc}
                  selectedDcId={selectedDcId}
                  setSelectedDcId={setSelectedDcId}
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  calYear={calYear}
                  setCalYear={setCalYear}
                  calMonth={calMonth}
                  setCalMonth={setCalMonth}
                  onNext={goToStep2}
                />
              )}
              {step === 2 && selectedDate && (
                <Step2
                  doctor={doctor}
                  activeDc={activeDc!}
                  selectedDate={selectedDate}
                  slots={slots}
                  selectedSlot={selectedSlot}
                  setSelectedSlot={setSelectedSlot}
                  onBack={() => setStep(1)}
                  onNext={goToStep3}
                />
              )}
              {step === 3 && selectedDate && selectedSlot && (
                <Step3
                  doctor={doctor}
                  activeDc={activeDc!}
                  selectedDate={selectedDate}
                  selectedSlot={selectedSlot}
                  apptType={apptType}
                  setApptType={setApptType}
                  reason={reason}
                  setReason={setReason}
                  onBack={() => setStep(2)}
                  onConfirm={handleConfirm}
                  submitting={submitting}
                  error={bookError}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Date & Clinic" },
    { n: 2, label: "Time Slot" },
    { n: 3, label: "Confirm" },
  ] as const;

  return (
    <div className="flex items-center gap-0 mb-2">
      {steps.map(({ n, label }, i) => {
        const done    = step > n;
        const active  = step === n;
        const future  = step < n;

        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  done
                    ? "bg-blue-600 text-white"
                    : active
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-white border-2 border-slate-200 text-slate-400"
                }`}
              >
                {done ? <CheckSolidIcon className="w-4 h-4" /> : n}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  active ? "text-blue-600" : future ? "text-slate-400" : "text-slate-600"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${
                  step > n ? "bg-blue-600" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Doctor info card (compact, used in every step) ───────

function DoctorCard({ doctor }: { doctor: DoctorDetail }) {
  const initials = getInitials(doctor.user.name);
  const fee = parseFloat(doctor.consultationFee);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 text-lg font-bold shrink-0 select-none">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-slate-800">
            Dr. {doctor.user.name}
          </h3>
          {doctor.isVerified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
              <CheckSolidIcon className="w-3 h-3" />
              Verified
            </span>
          )}
        </div>
        <p className="text-sm text-blue-600 font-medium">{doctor.specialization}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {doctor.experienceYears} yrs exp &middot; ₹
          {isNaN(fee) ? doctor.consultationFee : fee.toLocaleString("en-IN")} / visit
        </p>
      </div>
    </div>
  );
}

// ─── Step 1: Clinic + Date ────────────────────────────────

function Step1({
  doctor,
  activeDc,
  selectedDcId,
  setSelectedDcId,
  selectedDate,
  setSelectedDate,
  calYear,
  setCalYear,
  calMonth,
  setCalMonth,
  onNext,
}: {
  doctor: DoctorDetail;
  activeDc: DoctorClinicEntry | null;
  selectedDcId: string | null;
  setSelectedDcId: (id: string) => void;
  selectedDate: Date | null;
  setSelectedDate: (d: Date | null) => void;
  calYear: number;
  setCalYear: (y: number) => void;
  calMonth: number;
  setCalMonth: (m: number) => void;
  onNext: () => void;
}) {
  const canNext = !!activeDc && !!selectedDate;

  return (
    <div className="space-y-5">
      <DoctorCard doctor={doctor} />

      {/* Clinic selection (only if multiple) */}
      {doctor.clinics.length > 1 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
            Select Clinic
          </h2>
          <div className="space-y-2">
            {doctor.clinics.map((dc) => {
              const selected = selectedDcId === dc.id;
              return (
                <button
                  key={dc.id}
                  onClick={() => {
                    setSelectedDcId(dc.id);
                    setSelectedDate(null); // reset date when clinic changes
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selected
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                        selected
                          ? "border-blue-600 bg-blue-600"
                          : "border-slate-300"
                      }`}
                    >
                      {selected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">
                        {dc.clinic.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {dc.clinic.address}, {dc.clinic.city}, {dc.clinic.state}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {dc.clinic.phone}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Single clinic label */}
      {doctor.clinics.length === 1 && activeDc && (
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-sm text-slate-600">
          <ClinicIcon className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            {activeDc.clinic.name} &middot; {activeDc.clinic.city}
          </span>
        </div>
      )}

      {/* No clinics */}
      {doctor.clinics.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-700">
          This doctor has no clinic listed yet. Please contact support.
        </div>
      )}

      {/* Calendar */}
      {activeDc ? (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
            Select Date
          </h2>
          <Calendar
            schedule={activeDc.schedule}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            calYear={calYear}
            setCalYear={setCalYear}
            calMonth={calMonth}
            setCalMonth={setCalMonth}
          />
        </section>
      ) : (
        doctor.clinics.length > 1 && (
          <p className="text-sm text-slate-400 text-center py-4">
            Select a clinic above to choose a date.
          </p>
        )
      )}

      <button
        onClick={onNext}
        disabled={!canNext}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm rounded-xl transition-colors"
      >
        Continue to Time Slot
      </button>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────

function Calendar({
  schedule,
  selectedDate,
  setSelectedDate,
  calYear,
  setCalYear,
  calMonth,
  setCalMonth,
}: {
  schedule: Schedule | null;
  selectedDate: Date | null;
  setSelectedDate: (d: Date | null) => void;
  calYear: number;
  setCalYear: (y: number) => void;
  calMonth: number;
  setCalMonth: (m: number) => void;
}) {
  const today     = new Date();
  const todayStr  = toISTDateStr(today);
  const maxDate   = new Date(today.getFullYear(), today.getMonth() + 3, 0);
  const maxStr    = toISTDateStr(maxDate);
  const selectedStr = selectedDate ? toISTDateStr(selectedDate) : null;

  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth     = new Date(calYear, calMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const canGoBack =
    calYear > today.getFullYear() ||
    (calYear === today.getFullYear() && calMonth > today.getMonth());

  const canGoFwd =
    calYear < maxDate.getFullYear() ||
    (calYear === maxDate.getFullYear() && calMonth < maxDate.getMonth());

  function prevMonth() {
    if (!canGoBack) return;
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); }
    else setCalMonth(calMonth - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (!canGoFwd) return;
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); }
    else setCalMonth(calMonth + 1);
    setSelectedDate(null);
  }

  function isDisabled(day: number): boolean {
    const date  = new Date(calYear, calMonth, day);
    const dStr  = toISTDateStr(date);
    if (dStr < todayStr) return true;
    if (dStr > maxStr) return true;
    const key   = DAY_KEYS[date.getDay()];
    const slots = schedule?.[key];
    return !slots || slots.length === 0;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          disabled={!canGoBack}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-700">
          {MONTH_NAMES[calMonth]} {calYear}
        </span>
        <button
          onClick={nextMonth}
          disabled={!canGoFwd}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-slate-400 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const date     = new Date(calYear, calMonth, day);
          const dStr     = toISTDateStr(date);
          const disabled = isDisabled(day);
          const selected = dStr === selectedStr;
          const isToday  = dStr === todayStr;

          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() =>
                setSelectedDate(disabled ? null : new Date(calYear, calMonth, day))
              }
              className={`
                h-9 w-full rounded-lg text-sm font-medium transition-colors
                ${selected
                  ? "bg-blue-600 text-white"
                  : disabled
                  ? "text-slate-200 cursor-not-allowed"
                  : isToday
                  ? "border border-blue-400 text-blue-600 hover:bg-blue-50"
                  : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                }
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-600" /> Selected
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm border border-blue-400" /> Today
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-slate-100" /> Unavailable
        </span>
      </div>
    </div>
  );
}

// ─── Step 2: Time Slot ────────────────────────────────────

function Step2({
  doctor,
  activeDc,
  selectedDate,
  slots,
  selectedSlot,
  setSelectedSlot,
  onBack,
  onNext,
}: {
  doctor: DoctorDetail;
  activeDc: DoctorClinicEntry;
  selectedDate: Date;
  slots: SlotEntry[];
  selectedSlot: string | null;
  setSelectedSlot: (s: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const availableCount = slots.filter((s) => !s.booked && !s.past).length;

  return (
    <div className="space-y-5">
      <DoctorCard doctor={doctor} />

      {/* Summary chip */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 rounded-xl text-sm text-blue-700 font-medium">
        <CalendarIcon className="w-4 h-4 shrink-0" />
        {formatDateLong(selectedDate)} &middot; {activeDc.clinic.name}
      </div>

      {/* Time slots */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Available Times
          </h2>
          {availableCount > 0 && (
            <span className="text-xs text-slate-400">
              {availableCount} slot{availableCount !== 1 ? "s" : ""} open
            </span>
          )}
        </div>

        {slots.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-100">
            No slots scheduled for this day.
            <br />
            <button
              onClick={onBack}
              className="mt-3 text-blue-600 hover:underline text-sm"
            >
              Pick another date
            </button>
          </div>
        ) : availableCount === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-100">
            All slots for this day are booked or past.
            <br />
            <button
              onClick={onBack}
              className="mt-3 text-blue-600 hover:underline text-sm"
            >
              Pick another date
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slots.map((slot) => {
              const unavailable = slot.booked || slot.past;
              const selected    = selectedSlot === slot.time;

              return (
                <button
                  key={slot.time}
                  disabled={unavailable}
                  onClick={() =>
                    setSelectedSlot(selected ? null : slot.time)
                  }
                  className={`
                    py-2.5 rounded-xl text-sm font-medium border transition-all
                    ${selected
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : unavailable
                      ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                      : "bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
                    }
                  `}
                >
                  {formatTime12(slot.time)}
                  {slot.booked && (
                    <span className="block text-[10px] text-slate-300 leading-none mt-0.5">
                      Booked
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Nav buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!selectedSlot}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Confirm ──────────────────────────────────────

function Step3({
  doctor,
  activeDc,
  selectedDate,
  selectedSlot,
  apptType,
  setApptType,
  reason,
  setReason,
  onBack,
  onConfirm,
  submitting,
  error,
}: {
  doctor: DoctorDetail;
  activeDc: DoctorClinicEntry;
  selectedDate: Date;
  selectedSlot: string;
  apptType: ApptType;
  setApptType: (t: ApptType) => void;
  reason: string;
  setReason: (r: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  submitting: boolean;
  error: string;
}) {
  const fee = parseFloat(doctor.consultationFee);

  return (
    <div className="space-y-5">
      {/* Booking summary card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-blue-600">
          <p className="text-blue-100 text-xs font-medium uppercase tracking-wider">
            Booking Summary
          </p>
        </div>
        <div className="divide-y divide-slate-50">
          <SummaryRow
            icon={<PersonIcon className="w-4 h-4" />}
            label="Doctor"
            value={`Dr. ${doctor.user.name} · ${doctor.specialization}`}
          />
          <SummaryRow
            icon={<ClinicIcon className="w-4 h-4" />}
            label="Clinic"
            value={`${activeDc.clinic.name}, ${activeDc.clinic.city}`}
          />
          <SummaryRow
            icon={<CalendarIcon className="w-4 h-4" />}
            label="Date"
            value={formatDateLong(selectedDate)}
          />
          <SummaryRow
            icon={<ClockIcon className="w-4 h-4" />}
            label="Time"
            value={formatTime12(selectedSlot)}
          />
          <SummaryRow
            icon={<RupeeIcon className="w-4 h-4" />}
            label="Fee"
            value={`₹${isNaN(fee) ? doctor.consultationFee : fee.toLocaleString("en-IN")}`}
          />
        </div>
      </div>

      {/* Appointment type */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide text-xs">
          Appointment Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(["IN_PERSON", "ONLINE"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setApptType(t)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                apptType === t
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
              }`}
            >
              {t === "IN_PERSON" ? (
                <ClinicIcon className="w-4 h-4 shrink-0" />
              ) : (
                <VideoIcon className="w-4 h-4 shrink-0" />
              )}
              {t === "IN_PERSON" ? "In Person" : "Online"}
            </button>
          ))}
        </div>
      </div>

      {/* Reason */}
      <div>
        <label
          htmlFor="reason"
          className="block text-sm font-semibold text-slate-700 mb-2"
        >
          Reason for visit{" "}
          <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe your symptoms or reason for the visit…"
          rows={3}
          maxLength={500}
          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-slate-400 mt-1 text-right">
          {reason.length}/500
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          <span className="mt-0.5">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Nav */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex-1 py-3 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={submitting}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              Booking…
            </>
          ) : (
            "Confirm Booking"
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Summary row ──────────────────────────────────────────

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <div className="text-slate-400 mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-sm text-slate-800 font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-200 rounded w-1/3" />
          <div className="h-3 bg-slate-200 rounded w-1/4" />
        </div>
      </div>
      <div className="h-64 bg-white rounded-2xl border border-slate-100 shadow-sm" />
      <div className="h-12 bg-slate-200 rounded-xl" />
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckSolidIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  );
}

function ClinicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" />
      <path d="M9 22V12h6v10" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function RupeeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M6 3h12M6 8h12M15 21 6 12h3a4 4 0 0 0 0-4H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="7" width="15" height="10" rx="2" />
      <path d="m22 8-5 4 5 4V8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
