"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setStoredAuth } from "@/lib/api";
import { Lock, Mail, Loader2, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";

type RoleOption = "admin" | "hod" | "faculty" | "student";

const ROLE_CONFIG: Record<
  RoleOption,
  { label: string; defaultEmail: string; placeholder: string; redirectRole: string }
> = {
  admin: {
    label: "Admin",
    defaultEmail: "admin@acadtrack.test",
    placeholder: "e.g. admin@acadtrack.test or ID",
    redirectRole: "college_admin",
  },
  hod: {
    label: "HOD",
    defaultEmail: "hod.co@acadtrack.test",
    placeholder: "e.g. hod.co@acadtrack.test or ID",
    redirectRole: "dept_admin",
  },
  faculty: {
    label: "Faculty",
    defaultEmail: "faculty1@acadtrack.test",
    placeholder: "e.g. faculty1@acadtrack.test or ID",
    redirectRole: "faculty",
  },
  student: {
    label: "Student",
    defaultEmail: "sahil@acadtrack.test",
    placeholder: "e.g. sahil@acadtrack.test or Roll No",
    redirectRole: "student",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleOption>("admin");
  const [email, setEmail] = useState("admin@acadtrack.test");
  const [password, setPassword] = useState("Password@123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRoleSelect(role: RoleOption) {
    setSelectedRole(role);
    setEmail(ROLE_CONFIG[role].defaultEmail);
    setPassword("Password@123");
    setError(null);
  }

  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid credentials or unauthorized access");
      }

      setStoredAuth(data.token, data.user);

      // Role-based redirects
      const roleRedirects: Record<string, string> = {
        college_admin: "/college-admin",
        dept_admin: "/dept-admin",
        faculty: "/faculty",
        student: "/student",
      };

      router.push(roleRedirects[data.user.role] || "/");
    } catch (err: any) {
      setError(err.message || "Login failed. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-[#FFF9F7]">
      {/* ================= LEFT HERO PANEL (~58% on desktop) ================= */}
      <section className="relative w-full lg:w-[58%] min-h-[440px] lg:min-h-screen flex flex-col justify-between p-8 sm:p-12 lg:p-14 overflow-hidden select-none">
        {/* Background Image Container with Multi-stop Gradient Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            alt="Warm contemporary university campus architecture with academic pavilions and lush courtyard"
            className="w-full h-full object-cover object-center transform scale-105 duration-1000 ease-out"
            src="/campus-hero.jpg"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1d152b]/95 via-[#29232f]/60 to-[#29232f]/40 backdrop-blur-[0.5px]"></div>
        </div>

        {/* Top Header / Monogram Branding inside Hero */}
        <header className="relative z-10 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#FFFDFB]/95 backdrop-blur-md shadow-md border border-white/20 flex items-center justify-center shrink-0">
            <span className="font-bold text-lg tracking-tight text-[#55368F]">AT</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white leading-tight flex items-center gap-2">
              AcadTrack
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-white/20 text-[#FFFDFB] px-2 py-0.5 rounded-full border border-white/10 backdrop-blur-sm">
                v2.4
              </span>
            </span>
            <span className="text-xs text-[#F3DDD0] font-medium tracking-wide">
              Attendance &amp; Marks Management System
            </span>
          </div>
        </header>

        {/* Center-Lower Editorial Copy Area */}
        <div className="relative z-10 my-auto py-12 lg:py-0 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9ee8b7] animate-pulse"></span>
            Institutional Academic Workspace
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-white tracking-tight leading-[1.18]">
            Your academic journey, <span className="font-serif italic font-normal text-[#F3DDD0]">organised.</span>
          </h1>
          <p className="text-slate-200/95 text-base sm:text-lg font-normal leading-relaxed mt-4 max-w-lg">
            One unified place to stay connected with your classes, attendance compliance, internal assessment marks, and institutional academic progress.
          </p>
        </div>

        {/* Bottom Institutional Footer Tagline */}
        <footer className="relative z-10 pt-4">
          <p className="text-slate-300/80 text-xs tracking-wider uppercase font-medium flex items-center gap-2">
            <span>© AcadTrack University Portal</span>
            <span className="text-white/40">•</span>
            <span>Designed for modern academic communities</span>
          </p>
        </footer>
      </section>

      {/* ================= RIGHT AUTHENTICATION PANEL (~42% on desktop) ================= */}
      <section className="w-full lg:w-[42%] bg-[#FFF9F7] flex items-center justify-center p-6 sm:p-10 lg:p-12 relative">
        <div className="max-w-[440px] w-full mx-auto">
          {/* Welcome Greeting Block */}
          <header className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#29232F] tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-[#777080] mt-1.5 font-normal">
              Sign in to continue to your AcadTrack workspace.
            </p>
          </header>

          {/* Role Selector Component */}
          <div className="mb-6">
            <label className="block text-xs uppercase font-bold tracking-wider text-[#777080] mb-2">
              Select Account Role
            </label>
            <div
              aria-label="Account Role Selector"
              className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-white rounded-2xl border border-[#EAE2EA] shadow-xs"
              role="radiogroup"
            >
              {(["admin", "hod", "faculty", "student"] as RoleOption[]).map((r) => {
                const isSelected = selectedRole === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRoleSelect(r)}
                    className={`relative flex items-center justify-center py-2 px-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 select-none ${isSelected
                      ? "bg-[#7150B5] text-white shadow-sm"
                      : "text-[#777080] hover:text-[#29232F] hover:bg-[#F0E5F7]/50"
                      }`}
                  >
                    <span className="truncate">{ROLE_CONFIG[r].label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800 flex items-start gap-2">
              <span className="font-bold text-red-600">!</span>
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4.5">
            {/* Field 1: Institutional ID or Email */}
            <div>
              <label className="block text-xs font-semibold text-[#29232F] mb-1.5" htmlFor="identifier">
                Institutional ID / Email Address
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#777080]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="identifier"
                  name="identifier"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={ROLE_CONFIG[selectedRole].placeholder}
                  className="block w-full rounded-xl border border-[#EAE2EA] bg-white pl-10 pr-4 py-2.5 text-sm text-[#29232F] placeholder:text-[#777080]/60 focus:border-[#7150B5] focus:ring-2 focus:ring-[#7150B5]/20 transition-all outline-none"
                />
              </div>
            </div>

            {/* Field 2: Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#29232F]" htmlFor="password">
                  Confidential Password
                </label>
                <span className="text-[11px] font-medium text-[#7150B5] select-none">
                  Default: Password@123
                </span>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#777080]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="block w-full rounded-xl border border-[#EAE2EA] bg-white pl-10 pr-10 py-2.5 text-sm text-[#29232F] placeholder:text-[#777080]/60 focus:border-[#7150B5] focus:ring-2 focus:ring-[#7150B5]/20 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#777080] hover:text-[#29232F] focus:outline-none transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center pt-0.5">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-[#EAE2EA] text-[#7150B5] focus:ring-[#7150B5]/30 cursor-pointer"
              />
              <label
                htmlFor="remember-me"
                className="ml-2.5 block text-xs font-medium text-[#29232F] select-none cursor-pointer"
              >
                Remember my workstation session
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#7150B5] hover:bg-[#55368F] active:scale-[0.99] disabled:opacity-60 text-white font-semibold text-sm py-3 px-5 rounded-xl shadow-sm hover:shadow transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#7150B5] focus:ring-offset-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in to AcadTrack</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Security Assurance Note */}
            <div className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-[#777080] text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7150B5]" />
              <span>Protected by institutional encryption &amp; role-based access control</span>
            </div>
          </form>

          {/* Quick Demo Fill Helper */}
          <div className="mt-7 pt-5 border-t border-[#EAE2EA] text-center">
            <p className="text-xs text-[#777080] font-medium mb-2.5">
              Quick Test Accounts for Verification:
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <button
                type="button"
                onClick={() => handleRoleSelect("admin")}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white border border-[#EAE2EA] text-[#777080] hover:text-[#55368F] hover:border-[#7150B5]/30 transition"
              >
                Admin (admin@acadtrack.test)
              </button>
              <button
                type="button"
                onClick={() => handleRoleSelect("hod")}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white border border-[#EAE2EA] text-[#777080] hover:text-[#55368F] hover:border-[#7150B5]/30 transition"
              >
                HOD (hod.co@acadtrack.test)
              </button>
              <button
                type="button"
                onClick={() => handleRoleSelect("faculty")}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white border border-[#EAE2EA] text-[#777080] hover:text-[#55368F] hover:border-[#7150B5]/30 transition"
              >
                Faculty (faculty1@acadtrack.test)
              </button>
              <button
                type="button"
                onClick={() => handleRoleSelect("student")}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white border border-[#EAE2EA] text-[#777080] hover:text-[#55368F] hover:border-[#7150B5]/30 transition"
              >
                Student (sahil@acadtrack.test)
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
