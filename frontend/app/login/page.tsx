"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setStoredAuth } from "@/lib/api";
import { Lock, Mail, Loader2, ShieldCheck, UserCheck, GraduationCap, BookOpen } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Password@123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoAccounts = [
    { label: "College Admin", email: "admin@acadtrack.test", role: "college_admin", icon: ShieldCheck, color: "hover:border-purple-400 hover:bg-purple-50 text-purple-700" },
    { label: "Dept Admin (HOD)", email: "hod.co@acadtrack.test", role: "dept_admin", icon: BookOpen, color: "hover:border-blue-400 hover:bg-blue-50 text-blue-700" },
    { label: "Faculty (DBMS)", email: "faculty1@acadtrack.test", role: "faculty", icon: UserCheck, color: "hover:border-emerald-400 hover:bg-emerald-50 text-emerald-700" },
    { label: "Faculty (OS)", email: "faculty2@acadtrack.test", role: "faculty", icon: UserCheck, color: "hover:border-emerald-400 hover:bg-emerald-50 text-emerald-700" },
    { label: "Student (Sahil)", email: "sahil@acadtrack.test", role: "student", icon: GraduationCap, color: "hover:border-amber-400 hover:bg-amber-50 text-amber-700" },
  ];

  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Login failed");
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
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("Password@123");
    setError(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-2xl shadow-lg shadow-indigo-200 mb-3">
            AT
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">AcadTrack</h1>
          <p className="text-sm text-gray-600 mt-1">Lecture Attendance & Internal Marks System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@acadtrack.test"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password@123"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Quick 1-Click Demo Accounts (Password@123)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {demoAccounts.map((d) => {
                const Icon = d.icon;
                return (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => fillDemo(d.email)}
                    className={`flex items-center gap-2 p-2 rounded-lg border border-gray-200 text-left text-xs font-medium bg-gray-50/50 transition ${d.color}`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          AcadTrack University Project &bull; Express 5 &bull; Next.js 16 &bull; PostgreSQL
        </p>
      </div>
    </div>
  );
}
