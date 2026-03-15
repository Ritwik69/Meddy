"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import axios from "axios";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/dashboard/LogoutButton";

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = "Blood Report" | "Scan" | "Prescription" | "X-Ray" | "Other";

interface HealthRecord {
  id: string;
  diagnosis: string;     // used as title
  symptoms: string[];    // [0] = category
  attachments: string[]; // [0] = fileUrl
  recordedAt: string;
  doctor: { user: { name: string | null } } | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  "Blood Report",
  "Scan",
  "Prescription",
  "X-Ray",
  "Other",
];
const ALL_TABS = ["All", ...CATEGORIES];

const CATEGORY_COLORS: Record<string, string> = {
  "Blood Report": "bg-red-100 text-red-700",
  Scan: "bg-blue-100 text-blue-700",
  Prescription: "bg-violet-100 text-violet-700",
  "X-Ray": "bg-orange-100 text-orange-700",
  Other: "bg-gray-100 text-gray-600",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function getFileType(url: string): "pdf" | "image" {
  return url.split(".").pop()?.toLowerCase() === "pdf" ? "pdf" : "image";
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RecordsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<Category>("Blood Report");
  const [uploadDate, setUploadDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const { data } = await axios.get("/api/patient/records");
      setRecords(data);
    } catch {
      // silent
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ── Filtered records ───────────────────────────────────────────────────────

  const filtered =
    activeCategory === "All"
      ? records
      : records.filter((r) => r.symptoms[0] === activeCategory);

  // ── File select ────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFileError("");
    if (!file) {
      setUploadFile(null);
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) {
      setFileError("Only PDF, JPG, PNG files are allowed.");
      setUploadFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError("File must be under 10 MB.");
      setUploadFile(null);
      return;
    }
    setUploadFile(file);
  }

  // ── Upload submit ──────────────────────────────────────────────────────────

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) {
      setFileError("Please select a file.");
      return;
    }
    setUploading(true);
    setUploadError("");

    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("title", uploadTitle.trim());
    fd.append("category", uploadCategory);
    fd.append("recordedAt", uploadDate);

    try {
      const { data } = await axios.post("/api/patient/records", fd);
      setRecords((prev) => [data, ...prev]);
      resetModal();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err)
          ? err.response?.data?.error
          : undefined;
      setUploadError(msg ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function resetModal() {
    setShowModal(false);
    setUploadTitle("");
    setUploadCategory("Blood Report");
    setUploadDate(new Date().toISOString().slice(0, 10));
    setUploadFile(null);
    setFileError("");
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await axios.delete(`/api/patient/records/${id}`);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert("Failed to delete. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Health Records
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Upload and manage your medical files
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="shrink-0 flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
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
            Upload Record
          </button>
        </div>

        {/* ── Category tabs ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {ALL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeCategory === tab
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Records ── */}
        {loadingRecords ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 mb-4" />
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-6" />
                <div className="h-8 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState category={activeCategory} onUpload={() => setShowModal(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
            {filtered.map((record) => {
              const fileUrl = record.attachments[0];
              const fileType = getFileType(fileUrl ?? "");
              const category = (record.symptoms[0] ?? "Other") as Category;
              return (
                <RecordCard
                  key={record.id}
                  title={record.diagnosis}
                  category={category}
                  fileUrl={fileUrl}
                  fileType={fileType}
                  recordedAt={record.recordedAt}
                  doctorName={record.doctor?.user.name ?? null}
                  deleting={deletingId === record.id}
                  onDelete={() => handleDelete(record.id)}
                  onExplain={() =>
                    router.push(`/patient/records/${record.id}/explain`)
                  }
                />
              );
            })}
          </div>
        )}
      </main>

      {/* ── Upload modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                Upload Health Record
              </h2>
              <button
                onClick={resetModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
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

            {/* Form */}
            <form onSubmit={handleUpload} className="px-6 py-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Blood test results"
                  required
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) =>
                    setUploadCategory(e.target.value as Category)
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Date of Record <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={uploadDate}
                  onChange={(e) => setUploadDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  required
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* File drop zone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  File <span className="text-red-500">*</span>
                </label>
                <label
                  htmlFor="record-file"
                  className={`flex flex-col items-center gap-2 p-5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                    uploadFile
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                  }`}
                >
                  {uploadFile ? (
                    <>
                      <FileTypeIcon
                        type={getFileType(uploadFile.name)}
                        size="lg"
                      />
                      <p className="text-sm font-medium text-blue-700 truncate max-w-full px-2">
                        {uploadFile.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {(uploadFile.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                        <span className="text-blue-500">Change file</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-9 h-9 text-slate-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.687 10.743"
                        />
                      </svg>
                      <p className="text-sm text-slate-500 text-center">
                        <span className="text-blue-600 font-medium">
                          Click to upload
                        </span>{" "}
                        or drag and drop
                      </p>
                      <p className="text-xs text-slate-400">
                        PDF, JPG, PNG · max 10 MB
                      </p>
                    </>
                  )}
                  <input
                    id="record-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="sr-only"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                </label>
                {fileError && (
                  <p className="text-xs text-red-500 mt-1.5">{fileError}</p>
                )}
              </div>

              {uploadError && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">
                  {uploadError}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={resetModal}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RecordCard({
  title,
  category,
  fileUrl,
  fileType,
  recordedAt,
  doctorName,
  deleting,
  onDelete,
  onExplain,
}: {
  title: string;
  category: Category;
  fileUrl: string | undefined;
  fileType: "pdf" | "image";
  recordedAt: string;
  doctorName: string | null;
  deleting: boolean;
  onDelete: () => void;
  onExplain: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
      {/* Icon + badge row */}
      <div className="flex items-start justify-between">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            fileType === "pdf" ? "bg-red-50" : "bg-blue-50"
          }`}
        >
          <FileTypeIcon type={fileType} />
        </div>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {category}
        </span>
      </div>

      {/* Title + meta */}
      <div className="flex-1">
        <p className="font-medium text-slate-800 leading-snug line-clamp-2">
          {title}
        </p>
        <p className="text-xs text-slate-500 mt-1">{formatDate(recordedAt)}</p>
        {doctorName && (
          <p className="text-xs text-slate-400 mt-0.5">Dr. {doctorName}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        {/* Explain button */}
        <button
          onClick={onExplain}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors"
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
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          Explain with AI
        </button>

        <div className="flex gap-2">
          {fileUrl ? (
            <a
              href={fileUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
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
          ) : (
            <div className="flex-1" />
          )}
          <button
            onClick={onDelete}
            disabled={deleting}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 border border-red-100 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
            aria-label="Delete record"
          >
          {deleting ? (
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          )}
          Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  category,
  onUpload,
}: {
  category: string;
  onUpload: () => void;
}) {
  return (
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
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-700">
        {category === "All" ? "No records yet" : `No ${category} records`}
      </h3>
      <p className="text-sm text-slate-400 mt-1 mb-6 max-w-xs">
        {category === "All"
          ? "Upload your first medical document to keep everything in one place."
          : `You haven't uploaded any ${category.toLowerCase()} records yet.`}
      </p>
      <button
        onClick={onUpload}
        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Upload Record
      </button>
    </div>
  );
}

function FileTypeIcon({
  type,
  size = "sm",
}: {
  type: "pdf" | "image";
  size?: "sm" | "lg";
}) {
  const cls = size === "lg" ? "w-8 h-8" : "w-6 h-6";
  if (type === "pdf") {
    return (
      <svg
        className={`${cls} text-red-500`}
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
    );
  }
  return (
    <svg
      className={`${cls} text-blue-500`}
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
  );
}
