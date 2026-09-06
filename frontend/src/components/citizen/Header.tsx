"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { notifications } from "@/data/citizen-mock";
import { useAuth } from "@/lib/auth-context";
import { useOutsideClick } from "@/hooks/useOutsideClick";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useOutsideClick(notifRef, () => setNotifOpen(false));
  useOutsideClick(profileRef, () => setProfileOpen(false));

  const unreadCount = notifications.filter((n) => !n.read).length;
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const initial = user?.name?.[0]?.toUpperCase() ?? "?";

  function handleSignOut() {
    signOut();
    router.push("/login");
  }

  const priorityColor = (p: string) => {
    switch (p) {
      case "critical": return "bg-danger-500";
      case "warning": return "bg-warn-500";
      default: return "bg-navy-500";
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate2-100">
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-slate2-100 transition-colors text-navy-700" aria-label="Menu">
            <Icon name="Menu" className="w-5 h-5" />
          </button>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-navy-800">DRISHTI</p>
            <p className="text-[11px] text-slate2-500">Disaster Management &amp; Community Resilience</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-2 rounded-xl hover:bg-slate2-100 transition-colors text-navy-700"
              aria-label="Notifications"
            >
              <Icon name="Bell" className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-danger-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white px-0.5">
                  {unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-[var(--shadow-card-lg)] border border-slate2-100 overflow-hidden animate-slide-up">
                <div className="px-4 py-3 border-b border-slate2-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-navy-900">Notifications</p>
                  <span className="text-xs text-slate2-500">{unreadCount} unread</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((n) => (
                    <div key={n.id} className={`px-4 py-3 border-b border-slate2-50 hover:bg-slate2-50 transition-colors cursor-pointer ${!n.read ? "bg-navy-50/40" : ""}`}>
                      <div className="flex items-start gap-2.5">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priorityColor(n.priority)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy-800">{n.title}</p>
                          <p className="text-xs text-slate2-600 mt-0.5">{n.body}</p>
                          <p className="text-[11px] text-slate2-400 mt-1">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate2-100 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-500 to-navy-700 flex items-center justify-center text-white text-sm font-bold">
                {initial}
              </div>
              <span className="hidden sm:block text-sm font-semibold text-navy-700">Hi, {firstName}</span>
              <Icon name="ChevronDown" className="w-4 h-4 text-slate2-400 hidden sm:block" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-[var(--shadow-card-lg)] border border-slate2-100 overflow-hidden animate-slide-up">
                <div className="px-4 py-3 border-b border-slate2-100">
                  <p className="text-sm font-semibold text-navy-900">{user?.name}</p>
                  <p className="text-xs text-slate2-500">{user?.phone}</p>
                </div>
                <div className="py-1">
                  <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50 transition-colors">
                    <Icon name="LogOut" className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
