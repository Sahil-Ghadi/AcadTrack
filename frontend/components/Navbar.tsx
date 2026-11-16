"use client";

import AppHeader, { NavItem } from "./AppHeader";

export default function Navbar(props: {
  navItems?: NavItem[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  termText?: string;
  statusBadge?: string;
}) {
  return <AppHeader {...props} />;
}
