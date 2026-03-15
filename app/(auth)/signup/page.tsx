"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios, { AxiosError } from "axios";
import { signupSchema, type SignupFormData } from "@/schemas/auth";

const ROLES = [
  {
    value: "PATIENT" as const,
    label: "I'm a Patient",
    description: "Book appointments & manage health",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12z" fill="currentColor" opacity=".2"/>
        <path d="M12 14.4c-5.28 0-8.4 2.64-8.4 3.96v1.44h16.8V18.36c0-1.32-3.12-3.96-8.4-3.96z" fill="currentColor"/>
      </svg>
    ),
  },
  {
    value: "DOCTOR" as const,
    label: "I'm a Doctor",
    description: "Manage patients & appointments",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
        <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z" fill="currentColor" opacity=".2"/>
        <path d="M12 14c-5 0-9 2.24-9 5v1h18v-1c0-2.76-4-5-9-5z" fill="currentColor" opacity=".2"/>
        <rect x="14" y="10" width="8" height="2" rx="1" fill="currentColor"/>
        <rect x="17" y="7" width="2" height="8" rx="1" fill="currentColor"/>
      </svg>
    ),
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: "PATIENT" },
  });

  const selectedRole = watch("role");

  async function onSubmit(data: SignupFormData) {
    setLoading(true);
    setServerError("");
    try {
      await axios.post("/api/auth/signup", data);
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (result?.error) {
        router.push("/login");
      } else {
        router.push(
          data.role === "DOCTOR" ? "/doctor/onboarding" : "/patient/dashboard"
        );
      }
    } catch (err) {
      const axiosErr = err as AxiosError<{ error: string }>;
      setServerError(
        axiosErr.response?.data?.error ?? "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 px-8 py-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-3xl font-bold tracking-tight text-blue-600">
              meddy
            </span>
          </Link>
          <p className="text-slate-400 text-sm mt-1">Your health, simplified</p>
        </div>

        <h1 className="text-2xl font-semibold text-slate-800 mb-1">
          Create your account
        </h1>
        <p className="text-slate-500 text-sm mb-6">
          Join thousands managing their health with Meddy
        </p>

        {serverError && (
          <div className="mb-5 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <span className="mt-0.5">⚠</span>
            <span>{serverError}</span>
          </div>
        )}

        {/* Role selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {ROLES.map(({ value, label, description, icon }) => {
            const active = selectedRole === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setValue("role", value)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                  active
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 hover:border-blue-200 hover:bg-slate-50"
                }`}
              >
                {active && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="currentColor">
                      <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
                <span className={`block mb-2 ${active ? "text-blue-600" : "text-slate-500"}`}>
                  {icon}
                </span>
                <span className={`block text-sm font-semibold ${active ? "text-blue-700" : "text-slate-700"}`}>
                  {label}
                </span>
                <span className="block text-xs text-slate-400 mt-0.5 leading-tight">
                  {description}
                </span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <input type="hidden" {...register("role")} />

          {/* Full name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
              Full name
            </label>
            <input
              {...register("name")}
              id="name"
              type="text"
              autoComplete="name"
              placeholder={selectedRole === "DOCTOR" ? "Dr. Arjun Sharma" : "Priya Mehta"}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {errors.name && (
              <p className="mt-1.5 text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Email address
            </label>
            <input
              {...register("email")}
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
              Mobile number
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3.5 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl text-slate-500 text-sm font-medium">
                +91
              </span>
              <input
                {...register("phone")}
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="9876543210"
                maxLength={10}
                className="flex-1 min-w-0 px-4 py-3 border border-slate-200 rounded-r-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            {errors.phone && (
              <p className="mt-1.5 text-xs text-red-500">{errors.phone.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <input
              {...register("password")}
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 chars with a letter and number"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-slate-400">or</span>
          </div>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full py-3 border border-slate-200 hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-sm font-medium rounded-xl flex items-center justify-center gap-3 transition-colors"
        >
          <GoogleIcon />
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </button>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <p className="mt-6 text-xs text-slate-400 text-center max-w-xs">
        By creating an account, you agree to Meddy&apos;s{" "}
        <Link href="/terms" className="underline hover:text-slate-600">Terms</Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
