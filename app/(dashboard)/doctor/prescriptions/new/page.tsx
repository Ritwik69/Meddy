"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import LogoutButton from "@/components/dashboard/LogoutButton";
import {
  prescriptionFormSchema,
  PrescriptionFormValues,
  FREQUENCIES,
} from "@/schemas/prescription";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PatientResult {
  id: string;
  user: { name: string | null; phone: string | null; email: string | null };
}

// ── Shared input class ─────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NewPrescriptionPage() {
  const router = useRouter();

  // Patient search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] =
    useState<PatientResult | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Form
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionFormSchema),
    defaultValues: {
      patientId: "",
      diagnosis: "",
      medications: [
        { name: "", dosage: "", frequency: [], duration: "", instructions: "" },
      ],
      notes: "",
      validUntil: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "medications",
  });

  // ── Patient search debounce ────────────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await axios.get(
          `/api/patients/search?q=${encodeURIComponent(searchQuery)}`
        );
        setSearchResults(data);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function selectPatient(p: PatientResult) {
    setSelectedPatient(p);
    setValue("patientId", p.id, { shouldValidate: true });
    setSearchQuery("");
    setShowDropdown(false);
    setSearchResults([]);
  }

  function clearPatient() {
    setSelectedPatient(null);
    setValue("patientId", "");
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function onSubmit(data: PrescriptionFormValues) {
    setSubmitting(true);
    setSubmitError("");
    try {
      await axios.post("/api/prescriptions", data);
      router.push("/doctor/prescriptions?created=1");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error
        : undefined;
      setSubmitError(msg ?? "Failed to save prescription. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Navbar ── */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/doctor/dashboard"
              className="text-xl font-bold text-blue-600"
            >
              meddy
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-medium text-slate-700">
              New Prescription
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/doctor/prescriptions"
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              My Prescriptions
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Section: Patient ── */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-800">
              Patient
            </h2>

            {selectedPatient ? (
              <div className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-blue-200 flex items-center justify-center text-blue-800 font-semibold text-sm shrink-0">
                  {(selectedPatient.user.name ?? "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedPatient.user.name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedPatient.user.phone ?? selectedPatient.user.email ?? "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearPatient}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  aria-label="Remove patient"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <svg
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m21 21-4.35-4.35"
                    />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search patient by name, phone, or email…"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchLoading && (
                    <svg
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin"
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
                  )}
                </div>

                {showDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">
                        No patients found
                      </p>
                    ) : (
                      searchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectPatient(p)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm shrink-0">
                            {(p.user.name ?? "?")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {p.user.name ?? "Unknown"}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {p.user.phone ?? p.user.email ?? "—"}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {errors.patientId && (
              <p className="text-xs text-red-500">{errors.patientId.message}</p>
            )}
            {/* Hidden input to register patientId with RHF */}
            <input type="hidden" {...register("patientId")} />
          </section>

          {/* ── Section: Diagnosis ── */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-800">
              Diagnosis
            </h2>
            <div>
              <input
                {...register("diagnosis")}
                placeholder="e.g. Upper respiratory tract infection, Type 2 Diabetes"
                className={inputCls}
              />
              {errors.diagnosis && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.diagnosis.message}
                </p>
              )}
            </div>
          </section>

          {/* ── Section: Medications ── */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">
                Medications
              </h2>
              <button
                type="button"
                onClick={() =>
                  append({
                    name: "",
                    dosage: "",
                    frequency: [],
                    duration: "",
                    instructions: "",
                  })
                }
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
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
                Add Medicine
              </button>
            </div>

            {errors.medications?.root && (
              <p className="text-xs text-red-500">
                {errors.medications.root.message}
              </p>
            )}

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Medicine {index + 1}
                    </span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        aria-label="Remove medicine"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Name + Dosage */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Medicine Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        {...register(`medications.${index}.name`)}
                        placeholder="e.g. Amoxicillin"
                        className={inputCls}
                      />
                      {errors.medications?.[index]?.name && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.medications[index].name?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Dosage <span className="text-red-500">*</span>
                      </label>
                      <input
                        {...register(`medications.${index}.dosage`)}
                        placeholder="e.g. 500mg, 1 tablet"
                        className={inputCls}
                      />
                      {errors.medications?.[index]?.dosage && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.medications[index].dosage?.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Frequency */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      Frequency <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      control={control}
                      name={`medications.${index}.frequency`}
                      render={({ field: ff }) => (
                        <div className="flex gap-2">
                          {FREQUENCIES.map((freq) => {
                            const checked = ff.value.includes(freq);
                            return (
                              <button
                                key={freq}
                                type="button"
                                onClick={() =>
                                  ff.onChange(
                                    checked
                                      ? ff.value.filter((f) => f !== freq)
                                      : [...ff.value, freq]
                                  )
                                }
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                                  checked
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                                }`}
                              >
                                {freq}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    />
                    {errors.medications?.[index]?.frequency && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.medications[index].frequency?.message}
                      </p>
                    )}
                  </div>

                  {/* Duration + Instructions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Duration <span className="text-red-500">*</span>
                      </label>
                      <input
                        {...register(`medications.${index}.duration`)}
                        placeholder="e.g. 7 days, 2 weeks"
                        className={inputCls}
                      />
                      {errors.medications?.[index]?.duration && (
                        <p className="text-xs text-red-500 mt-1">
                          {errors.medications[index].duration?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Instructions{" "}
                        <span className="text-slate-400 font-normal">
                          (optional)
                        </span>
                      </label>
                      <input
                        {...register(`medications.${index}.instructions`)}
                        placeholder="e.g. After meals, avoid alcohol"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                append({
                  name: "",
                  dosage: "",
                  frequency: [],
                  duration: "",
                  instructions: "",
                })
              }
              className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              + Add Another Medicine
            </button>
          </section>

          {/* ── Section: Additional Info ── */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-800">
              Additional Information
            </h2>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Notes{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                {...register("notes")}
                rows={3}
                placeholder="Additional instructions, dietary advice, follow-up notes…"
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* Valid Until */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Valid Until{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                {...register("validUntil")}
                min={new Date().toISOString().slice(0, 10)}
                className={inputCls}
              />
            </div>
          </section>

          {/* ── Error + Submit ── */}
          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
              {submitError}
            </p>
          )}

          <div className="flex gap-3 pb-8">
            <Link
              href="/doctor/prescriptions"
              className="flex-1 text-center px-4 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? "Saving…" : "Save Prescription"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
