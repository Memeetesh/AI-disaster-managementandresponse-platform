"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

interface SidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

const navItems = [
  { href: "/", icon: "Home", label: "Home", desc: "Overview of disaster risks and family safety" },
  { href: "/family", icon: "Users", label: "Family", desc: "Real-time safety status of your family" },
  { href: "/emergency", icon: "Siren", label: "Emergency", desc: "Immediate emergency assistance" },
  { href: "/report", icon: "AlertTriangle", label: "Report Incident", desc: "Report a flood, blocked road, or hazard" },
  { href: "/reports", icon: "FileText", label: "My Reports", desc: "Track the incidents you've reported" },
  { href: "/support", icon: "HeartHandshake", label: "Support", desc: "Post-disaster assistance and support" },
];

export function Sidebar({ onClose, isMobile }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={`flex flex-col h-full bg-navy-900 text-white ${isMobile ? "w-72" : "w-64"} flex-shrink-0`}>
      <div className="px-6 py-6 border-b border-navy-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-navy-500 to-navy-700 flex items-center justify-center shadow-lg ring-1 ring-white/10">
              <svg viewBox="0 0 40 40" className="w-7 h-7">
                <path d="M5 25 Q20 12 35 25" stroke="#fbbf24" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M5 25 L35 25" stroke="#fbbf24" strokeWidth="2" fill="none" strokeLinecap="round" />
                <line x1="10" y1="25" x2="10" y2="30" stroke="#88a3d0" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="20" y1="25" x2="20" y2="30" stroke="#88a3d0" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="30" y1="25" x2="30" y2="30" stroke="#88a3d0" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="20" cy="14" r="3.5" fill="#fbbf24" />
                <path d="M20 6 L20 8.5 M14 9 L15.5 10.5 M26 9 L24.5 10.5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight">DRISHTI</h1>
              <p className="text-[11px] text-navy-300 leading-tight">Disaster Intelligence &amp; Response</p>
            </div>
          </div>
          {isMobile && onClose && (
            <button onClick={onClose} className="text-navy-300 hover:text-white transition-colors p-1">
              <Icon name="X" className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-navy-400 mt-3 leading-relaxed">
          Bridging Hope. Building Resilient Communities.
        </p>
      </div>

      <nav className="flex-1 px-3 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-400 px-3 mb-2">Menu</p>
        <div className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`relative w-full flex items-start gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-left group no-tap-highlight ${
                  active ? "bg-white/10 text-white shadow-sm" : "text-navy-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  active ? "bg-navy-600" : "bg-navy-800 group-hover:bg-navy-700"
                }`}>
                  <Icon name={item.icon} className="w-4.5 h-4.5" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${active ? "text-white" : "text-navy-200"}`}>{item.label}</p>
                  <p className="text-[11px] text-navy-400 leading-tight mt-0.5">{item.desc}</p>
                </div>
                {active && <div className="w-1 h-full rounded-full bg-amber-400 absolute right-0 top-0" />}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="px-3 pb-4">
        <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-safe-500/20 flex items-center justify-center">
                <Icon name="ShieldCheck" className="w-5 h-5 text-safe-400" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-safe-400 ring-2 ring-navy-800" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">You are Safe</p>
              <p className="text-[11px] text-navy-400 leading-tight mt-0.5">No active critical alerts in your area</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
