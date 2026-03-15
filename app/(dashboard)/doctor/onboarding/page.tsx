"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";

import {
  step1Schema,
  step2FormSchema,
  SPECIALTIES,
  CLINIC_TYPES,
  type Step1Data,
  type Step2FormData,
  type WeekSchedule,
} from "@/schemas/doctor";

// ─── Constants ────────────────────────────────────────────

const DAYS = [
  { key: "mon" as const, label: "Monday",    short: "Mon" },
  { key: "tue" as const, label: "Tuesday",   short: "Tue" },
  { key: "wed" as const, label: "Wednesday", short: "Wed" },
  { key: "thu" as const, label: "Thursday",  short: "Thu" },
  { key: "fri" as const, label: "Friday",    short: "Fri" },
  { key: "sat" as const, label: "Saturday",  short: "Sat" },
  { key: "sun" as const, label: "Sunday",    short: "Sun" },
];

const DEFAULT_SCHEDULE: WeekSchedule = {
  mon: { enabled: true,  start: "09:00", end: "17:00" },
  tue: { enabled: true,  start: "09:00", end: "17:00" },
  wed: { enabled: true,  start: "09:00", end: "17:00" },
  thu: { enabled: true,  start: "09:00", end: "17:00" },
  fri: { enabled: true,  start: "09:00", end: "17:00" },
  sat: { enabled: false, start: "10:00", end: "14:00" },
  sun: { enabled: false, start: "10:00", end: "14:00" },
};

// ─── Page ─────────────────────────────────────────────────

export default function DoctorOnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);
  const [scheduleError, setScheduleError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Step 1 form ──
  const form1 = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      specialization:  "",
      registrationNo:  "",
      experienceYears: 0,
      consultationFee: 500,
      bio:             "",
    },
  });

  // ── Step 2 form ──
  const form2 = useForm<Step2FormData>({
    resolver: zodResolver(step2FormSchema),
    defaultValues: {
      clinicName:  "",
      address:     "",
      city:        "",
      state:       "",
      pincode:     "",
      phone:       "",
      clinicType:  "clinic",
    },
  });

  if (status === "loading") return <FullPageLoader />;
  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const doctorName = session?.user?.name ?? "Doctor";
  const avatarLetter = doctorName[0]?.toUpperCase() ?? "D";

  // ── Handlers ──

  function handleStep1Valid(data: Step1Data) {
    setStep1Data(data);
    setStep(2);
  }

  function toggleDay(key: keyof WeekSchedule) {
    setSchedule((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
    setScheduleError("");
  }

  function updateDayTime(
    key: keyof WeekSchedule,
    field: "start" | "end",
    value: string
  ) {
    setSchedule((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  async function handleStep2Valid(formData: Step2FormData) {
    // Validate schedule
    const anyEnabled = Object.values(schedule).some((d) => d.enabled);
    if (!anyEnabled) {
      setScheduleError("Select at least one working day");
      return;
    }
    // Time range validation
    for (const { key, label } of DAYS) {
      const day = schedule[key];
      if (day.enabled && day.start >= day.end) {
        setScheduleError(`${label}: end time must be after start time`);
        return;
      }
    }
    setScheduleError("");

    // Submit
    setSubmitting(true);
    setSubmitError("");
    try {
      await axios.post("/api/doctor/onboarding", {
        ...step1Data!,
        ...formData,
        schedule,
      });
      setStep(3);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? "Something went wrong. Please try again.")
        : "Something went wrong. Please try again.";
      setSubmitError(typeof msg === "string" ? msg : "Validation failed. Check your inputs.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Minimal navbar ── */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-blue-600">
            meddy
          </span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-semibold select-none">
              {avatarLetter}
            </div>
            <span className="hidden sm:block text-sm text-slate-600">
              {doctorName}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-16">
        {/* ── Header ── */}
        {step < 3 && (
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-slate-800">
              Set up your doctor profile
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              This takes about 3 minutes. You can update these details later.
            </p>
          </div>
        )}

        {/* ── Stepper ── */}
        {step < 3 && <Stepper step={step} />}

        {/* ── Step content ── */}
        <div className="mt-8">
          {step === 1 && (
            <Step1Form
              form={form1}
              onValid={handleStep1Valid}
            />
          )}

          {step === 2 && (
            <Step2Form
              form={form2}
              schedule={schedule}
              scheduleError={scheduleError}
              submitError={submitError}
              submitting={submitting}
              onToggleDay={toggleDay}
              onUpdateTime={updateDayTime}
              onBack={() => setStep(1)}
              onValid={handleStep2Valid}
            />
          )}

          {step === 3 && (
            <DoneScreen
              doctorName={doctorName}
              onGo={() => router.push("/doctor/dashboard")}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────

function Stepper({ step }: { step: 1 | 2 }) {
  const steps = [
    { n: 1, label: "Basic Info" },
    { n: 2, label: "Your Clinic" },
  ] as const;

  return (
    <div className="flex items-center">
      {steps.map(({ n, label }, i) => {
        const done   = step > n;
        const active = step === n;

        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  done
                    ? "bg-blue-600 text-white"
                    : active
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-white border-2 border-slate-200 text-slate-400"
                }`}
              >
                {done ? <CheckIcon className="w-4 h-4" /> : n}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  active ? "text-blue-600" : done ? "text-slate-600" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-3 mb-5 transition-colors ${
                  done ? "bg-blue-600" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 – Basic Info ──────────────────────────────────

function Step1Form({
  form,
  onValid,
}: {
  form: ReturnType<typeof useForm<Step1Data>>;
  onValid: (data: Step1Data) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = form;

  const bio = watch("bio") ?? "";

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-6">
      <Card>
        <SectionHeading>Medical Details</SectionHeading>

        {/* Specialty */}
        <Field label="Specialty" error={errors.specialization?.message}>
          <select
            {...register("specialization")}
            className={inputCls(!!errors.specialization)}
          >
            <option value="">Select specialty…</option>
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        {/* Registration number */}
        <Field
          label="Medical Registration Number"
          hint="As issued by your state medical council"
          error={errors.registrationNo?.message}
        >
          <input
            {...register("registrationNo")}
            type="text"
            placeholder="e.g. MH-12345"
            className={inputCls(!!errors.registrationNo)}
          />
        </Field>

        {/* Experience + Fee (two columns) */}
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Years of Experience"
            error={errors.experienceYears?.message}
          >
            <input
              {...register("experienceYears")}
              type="number"
              min={0}
              max={70}
              placeholder="e.g. 5"
              className={inputCls(!!errors.experienceYears)}
            />
          </Field>

          <Field
            label="Consultation Fee (₹)"
            error={errors.consultationFee?.message}
          >
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                ₹
              </span>
              <input
                {...register("consultationFee")}
                type="number"
                min={0}
                placeholder="500"
                className={`${inputCls(!!errors.consultationFee)} pl-8`}
              />
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeading>About You</SectionHeading>

        {/* Bio */}
        <Field
          label={
            <span>
              Short Bio{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </span>
          }
          error={errors.bio?.message}
        >
          <textarea
            {...register("bio")}
            rows={4}
            maxLength={500}
            placeholder="Briefly describe your expertise, approach to patient care, and any special interests…"
            className={`${inputCls(!!errors.bio)} resize-none`}
          />
          <p className="text-xs text-slate-400 text-right mt-1">
            {bio.length}/500
          </p>
        </Field>
      </Card>

      <button
        type="submit"
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Continue to Clinic Details →
      </button>
    </form>
  );
}

// ─── Step 2 – Clinic Info + Schedule ─────────────────────

function Step2Form({
  form,
  schedule,
  scheduleError,
  submitError,
  submitting,
  onToggleDay,
  onUpdateTime,
  onBack,
  onValid,
}: {
  form: ReturnType<typeof useForm<Step2FormData>>;
  schedule: WeekSchedule;
  scheduleError: string;
  submitError: string;
  submitting: boolean;
  onToggleDay: (key: keyof WeekSchedule) => void;
  onUpdateTime: (key: keyof WeekSchedule, field: "start" | "end", value: string) => void;
  onBack: () => void;
  onValid: (data: Step2FormData) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-6">
      <Card>
        <SectionHeading>Clinic Details</SectionHeading>

        {/* Clinic name + type */}
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Clinic Name"
            error={errors.clinicName?.message}
            className="col-span-2 sm:col-span-1"
          >
            <input
              {...register("clinicName")}
              type="text"
              placeholder="e.g. Apollo Clinic"
              className={inputCls(!!errors.clinicName)}
            />
          </Field>

          <Field
            label="Clinic Type"
            error={errors.clinicType?.message}
            className="col-span-2 sm:col-span-1"
          >
            <select
              {...register("clinicType")}
              className={inputCls(!!errors.clinicType)}
            >
              {CLINIC_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Address */}
        <Field label="Address" error={errors.address?.message}>
          <textarea
            {...register("address")}
            rows={2}
            placeholder="Building, street, landmark…"
            className={`${inputCls(!!errors.address)} resize-none`}
          />
        </Field>

        {/* City + State */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="City" error={errors.city?.message}>
            <input
              {...register("city")}
              type="text"
              placeholder="e.g. Mumbai"
              className={inputCls(!!errors.city)}
            />
          </Field>
          <Field label="State" error={errors.state?.message}>
            <input
              {...register("state")}
              type="text"
              placeholder="e.g. Maharashtra"
              className={inputCls(!!errors.state)}
            />
          </Field>
        </div>

        {/* Pincode + Phone */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Pincode" error={errors.pincode?.message}>
            <input
              {...register("pincode")}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="400001"
              className={inputCls(!!errors.pincode)}
            />
          </Field>
          <Field label="Clinic Phone" error={errors.phone?.message}>
            <input
              {...register("phone")}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              className={inputCls(!!errors.phone)}
            />
          </Field>
        </div>
      </Card>

      {/* ── Working Days & Hours ── */}
      <Card>
        <SectionHeading>Working Days & Hours</SectionHeading>
        <p className="text-sm text-slate-500 -mt-2 mb-4">
          Toggle each day and set your working hours. Patients will see these
          slots when booking.
        </p>

        <div className="space-y-2">
          {DAYS.map(({ key, label, short }) => {
            const day = schedule[key];
            return (
              <div
                key={key}
                className={`rounded-xl border transition-colors ${
                  day.enabled
                    ? "border-blue-200 bg-blue-50"
                    : "border-slate-100 bg-white"
                }`}
              >
                {/* Day toggle row */}
                <button
                  type="button"
                  onClick={() => onToggleDay(key)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  {/* Toggle pill */}
                  <div
                    className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                      day.enabled ? "bg-blue-600" : "bg-slate-200"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        day.enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      day.enabled ? "text-blue-700" : "text-slate-500"
                    }`}
                  >
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{short}</span>
                  </span>
                  {!day.enabled && (
                    <span className="ml-auto text-xs text-slate-400">
                      Off
                    </span>
                  )}
                </button>

                {/* Time pickers (shown when enabled) */}
                {day.enabled && (
                  <div className="px-4 pb-3 flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-xs text-slate-500 shrink-0 w-8">
                        From
                      </label>
                      <input
                        type="time"
                        value={day.start}
                        onChange={(e) => onUpdateTime(key, "start", e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-xs text-slate-500 shrink-0 w-8">
                        To
                      </label>
                      <input
                        type="time"
                        value={day.end}
                        onChange={(e) => onUpdateTime(key, "end", e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {scheduleError && (
          <p className="mt-3 text-sm text-red-500">{scheduleError}</p>
        )}
      </Card>

      {/* Submit error */}
      {submitError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          <span className="mt-0.5">⚠</span>
          <span>{submitError}</span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="flex-1 py-3 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Complete Setup →"
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Step 3 – Done ────────────────────────────────────────

function DoneScreen({
  doctorName,
  onGo,
}: {
  doctorName: string;
  onGo: () => void;
}) {
  const firstName = doctorName.split(" ")[0];

  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      {/* Success icon */}
      <div className="w-24 h-24 rounded-3xl bg-blue-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
        <svg
          className="w-12 h-12 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            d="M5 13l4 4L19 7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h2 className="text-2xl font-semibold text-slate-800 mb-2">
        You&apos;re all set, Dr. {firstName}!
      </h2>
      <p className="text-slate-500 text-sm max-w-sm leading-relaxed mb-2">
        Your profile has been created. Our team will review and verify your
        registration details shortly.
      </p>
      <p className="text-slate-400 text-xs mb-8 max-w-xs leading-relaxed">
        In the meantime, patients can already discover your profile and request
        appointments.
      </p>

      {/* Info chips */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        {[
          "Profile created",
          "Clinic linked",
          "Slots ready",
        ].map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-100 text-green-700 text-xs font-medium rounded-full"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                d="M5 13l4 4L19 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {item}
          </span>
        ))}
      </div>

      <button
        onClick={onGo}
        className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Go to Dashboard →
      </button>

      <Link
        href="/login"
        className="mt-4 text-xs text-slate-400 hover:text-slate-600 underline"
      >
        Sign out instead
      </Link>
    </div>
  );
}

// ─── Shared UI helpers ────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 space-y-5">
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
      {children}
    </h3>
  );
}

function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
      {children}
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return [
    "w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-sm text-slate-800",
    "placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500",
    "focus:border-transparent focus:bg-white transition",
    hasError ? "border-red-300" : "border-slate-200",
  ].join(" ");
}

function FullPageLoader() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Loading…</div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        d="M5 13l4 4L19 7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth={4}
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
