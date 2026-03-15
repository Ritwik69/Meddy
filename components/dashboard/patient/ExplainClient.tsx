"use client";

import { useState } from "react";
import axios from "axios";

interface ExplainResult {
  summary: string;
  whatThisMeans: string;
  watchOutFor: string;
}

// ── Bullet renderer ────────────────────────────────────────────────────────────

function BulletList({ text }: { text: string }) {
  if (!text.trim()) return null;
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <ul className="space-y-2">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
          <span>{line.replace(/^[•\-]\s*/, "")}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${accent}`}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-white/60 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ExplainClient({ recordId }: { recordId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleExplain() {
    setState("loading");
    setErrorMsg("");
    try {
      const { data } = await axios.post<ExplainResult>(
        `/api/patient/records/${recordId}/explain`
      );
      setResult(data);
      setState("done");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error
        : undefined;
      setErrorMsg(msg ?? "Failed to generate explanation. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            AI Report Explainer
          </h2>
          <p className="text-xs text-slate-500">
            Powered by Claude · Plain-English explanation of your report
          </p>
        </div>
      </div>

      {/* ── Idle ── */}
      {state === "idle" && (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">
              Get a plain-English explanation
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Claude will analyse your report and explain what it means
            </p>
          </div>
          <button
            onClick={handleExplain}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all"
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
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Explain with AI
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {state === "loading" && (
        <div className="flex flex-col items-center py-10 gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">
              Analysing your report…
            </p>
            <p className="text-xs text-slate-400 mt-1">
              This usually takes 5–10 seconds
            </p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {state === "error" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border border-red-100 rounded-xl">
            <svg
              className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
          <button
            onClick={handleExplain}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Try again →
          </button>
        </div>
      )}

      {/* ── Result: 3 sections ── */}
      {state === "done" && result && (
        <div className="space-y-4">
          {/* Summary */}
          <Section
            title="Summary"
            accent="bg-blue-50 border-blue-100"
            icon={
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
          >
            <p className="text-sm text-slate-700 leading-relaxed">
              {result.summary}
            </p>
          </Section>

          {/* What this means */}
          <Section
            title="What This Means"
            accent="bg-green-50 border-green-100"
            icon={
              <svg
                className="w-4 h-4 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          >
            <BulletList text={result.whatThisMeans} />
          </Section>

          {/* Watch out for */}
          <Section
            title="What to Watch Out For"
            accent="bg-amber-50 border-amber-100"
            icon={
              <svg
                className="w-4 h-4 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            }
          >
            <BulletList text={result.watchOutFor} />
          </Section>

          {/* Regenerate */}
          <button
            onClick={handleExplain}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors pt-1"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Regenerate explanation
          </button>
        </div>
      )}
    </div>
  );
}
