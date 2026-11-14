"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, clearStoredAuth, User } from "@/lib/api";
import { LogOut, GraduationCap, ShieldCheck, UserCheck, BookOpen } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    clearStoredAuth();
    router.push("/login");
  }

  const roleLabels: Record<string, { label: string; color: string; icon: any }> = {
    college_admin: { label: "College Admin", color: "bg-purple-100 text-purple-800 border-purple-200", icon: ShieldCheck },
    dept_admin: { label: "Dept Admin", color: "bg-blue-100 text-blue-800 border-blue-200", icon: BookOpen },
    faculty: { label: "Faculty", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: UserCheck },
    student: { label: "Student", color: "bg-amber-100 text-amber-800 border-amber-200", icon: GraduationCap },
  };

  const roleInfo = user ? roleLabels[user.role] : null;
  const RoleIcon = roleInfo?.icon;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-xs">
            AT
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight leading-tight">AcadTrack</h1>
            <p className="text-xs text-gray-500 font-medium">Attendance & Marks System</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-gray-800">{user.email}</span>
              {roleInfo && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${roleInfo.color}`}>
                  {RoleIcon && <RoleIcon className="w-3 h-3" />}
                  {roleInfo.label}
                </span>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 border border-gray-200 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
