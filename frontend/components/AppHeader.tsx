"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, clearStoredAuth, subscribeToAuthChange, User } from "@/lib/api";
import { LogOut, ShieldCheck, UserCheck, GraduationCap, BookOpen } from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface AppHeaderProps {
  navItems?: NavItem[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  termText?: string;
  statusBadge?: string;
}

export default function AppHeader({
  navItems = [],
  activeTab,
  onTabChange,
  termText = "AY 2026-27 • Active Term",
  statusBadge,
}: AppHeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
    const unsubscribe = subscribeToAuthChange((newUser) => {
      setUser(newUser);
    });
    return unsubscribe;
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    clearStoredAuth();
    router.push("/login");
  }

  const roleLabels: Record<string, { label: string; icon: any }> = {
    college_admin: { label: "College Administrator", icon: ShieldCheck },
    dept_admin: { label: "Department Admin (HOD)", icon: BookOpen },
    faculty: { label: "Faculty Workspace", icon: UserCheck },
    student: { label: "Student", icon: GraduationCap },
  };

  const roleInfo = user ? roleLabels[user.role] || { label: user.role, icon: ShieldCheck } : null;

  // Derive initials from email
  const userInitials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "AT";

  return (
    <header className="sticky top-0 left-0 w-full z-40 bg-white border-b border-[#EAE2EA] shadow-[0_1px_8px_rgba(41,35,47,0.04)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-between">
        {/* Row 1: Brand & User Identity */}
        <div className="h-16 flex items-center justify-between border-b border-[#EAE2EA]/60">
          {/* Left: Branding & Academic Term */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* AT Monogram Badge */}
            <div className="w-10 h-10 rounded-xl bg-[#7150B5] flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-[#7150B5]/20 shrink-0 select-none">
              AT
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg text-[#29232F] leading-tight tracking-tight">
                  AcadTrack
                </span>
                <span className="hidden md:inline-flex text-[10px] font-semibold uppercase tracking-wider bg-[#F0E5F7] text-[#55368F] px-2 py-0.5 rounded-full border border-[#7150B5]/15">
                  v2.4
                </span>
              </div>
              <span className="text-[11px] sm:text-xs text-[#777080] font-medium leading-none mt-0.5">
                Attendance &amp; Marks System
              </span>
            </div>

            <div className="h-5 w-px bg-[#EAE2EA] hidden sm:block mx-1"></div>

            {/* Academic Session Pill */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3DDD0] text-[#29232F] border border-[#F3DDD0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7150B5] animate-pulse"></span>
              <span className="text-[11px] font-semibold tracking-wide">
                {termText}
              </span>
            </div>
          </div>

          {/* Right: User identity, Role, Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user && (
              <div className="flex items-center gap-2.5">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-semibold text-[#29232F] leading-tight">
                    {user.email}
                  </span>
                  <div className="flex justify-end mt-0.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F0E5F7] text-[#55368F] border border-[#7150B5]/15">
                      {roleInfo?.label}
                    </span>
                  </div>
                </div>

                {/* Avatar Badge */}
                <div className="w-8 h-8 rounded-full bg-[#F0E5F7] text-[#55368F] border border-[#7150B5]/20 flex items-center justify-center font-bold text-xs select-none">
                  {userInitials}
                </div>
              </div>
            )}

            <div className="h-6 w-px bg-[#EAE2EA] mx-0.5 hidden sm:block"></div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#777080] hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
              title="Sign out of system"
              type="button"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Row 2: Horizontal Navigation Bar (MANDATORY: NO SIDEBAR) */}
        {navItems.length > 0 && (
          <div className="h-12 flex items-center justify-between overflow-x-auto no-scrollbar">
            <nav className="flex items-center gap-1 sm:gap-2 h-full py-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onTabChange && onTabChange(item.key)}
                    className={`h-full inline-flex items-center gap-2 px-3 sm:px-4 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer select-none ${
                      isActive
                        ? "text-[#7150B5] bg-[#F0E5F7] shadow-xs border border-[#7150B5]/20"
                        : "text-[#777080] hover:text-[#29232F] hover:bg-[#FFF9F7]"
                    }`}
                  >
                    {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#7150B5]" : "text-[#777080]"}`} />}
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive ? "bg-[#7150B5] text-white" : "bg-[#F3DDD0] text-[#29232F]"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {statusBadge && (
              <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-medium text-[#777080] shrink-0 pl-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{statusBadge}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

