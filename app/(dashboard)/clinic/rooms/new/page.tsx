"use client";

import { useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = (typeof DAYS)[number];

const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 22; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 22) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewRoomPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [selectedDays, setSelectedDays] = useState<Day[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Tag input ────────────────────────────────────────────────────────────────

  function addTag(raw: string) {
    const tag = raw.trim();
    if (tag && !equipment.includes(tag)) {
      setEquipment((prev) => [...prev, tag]);
    }
    setTagInput("");
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && tagInput === "" && equipment.length > 0) {
      setEquipment((prev) => prev.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    setEquipment((prev) => prev.filter((t) => t !== tag));
  }

  // ── Day toggle ───────────────────────────────────────────────────────────────

  function toggleDay(day: Day) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("Room name is required.");
    if (!price || isNaN(Number(price)) || Number(price) <= 0)
      return setError("Enter a valid price per hour.");
    if (selectedDays.length === 0) return setError("Select at least one available day.");
    if (startTime >= endTime) return setError("End time must be after start time.");

    setSaving(true);
    try {
      await axios.post("/api/clinic/rooms", {
        name: name.trim(),
        description: description.trim(),
        equipment,
        pricePerHour: Number(price),
        availableDays: selectedDays,
        startTime,
        endTime,
      });
      router.push("/clinic/rooms?created=1");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
      setError(msg ?? "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/clinic/rooms" className="text-xl font-bold text-blue-600">
              meddy
            </Link>
            <span className="text-slate-300">|</span>
            <Link
              href="/clinic/rooms"
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Rooms
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-700">New Room</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-800">List a New Room</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Make your consultation room available for doctors to rent
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Room name */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Basic Info
            </h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Room Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Consultation Room A"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the room — size, features, what it's best for…"
                rows={3}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Equipment tags */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Equipment / Facilities
              </label>
              <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-xl min-h-[44px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white">
                {equipment.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-blue-400 hover:text-blue-700 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => tagInput && addTag(tagInput)}
                  placeholder={equipment.length === 0 ? "Type and press Enter — ECG, Ultrasound…" : ""}
                  className="flex-1 min-w-[140px] text-sm text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Press Enter or comma to add a tag</p>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Pricing
            </h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Price per Hour (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="500"
                  min={1}
                  className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Availability */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Availability
            </h2>

            {/* Days */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Available Days <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      selectedDays.includes(day)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Opens at <span className="text-red-500">*</span>
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Closes at <span className="text-red-500">*</span>
                </label>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Error + submit */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
              {error}
            </p>
          )}

          <div className="flex gap-3 pb-8">
            <Link
              href="/clinic/rooms"
              className="flex-1 text-center px-4 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving…" : "List Room"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
