"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { useAuth } from "@/lib/auth-context";
import { useAlerts, useMyReports } from "@/lib/queries";
import { alertRelativeTime, alertSourceLabel, SEVERITY_RANK } from "@/lib/alerts";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import type { IncidentStatus } from "@/types";

const SEEN_KEY = "aasha_setu_notifs_seen";

function loadSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persistSeen(seen: Set<string>): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
  } catch {
    // private mode / storage disabled — unread state just won't persist
  }
}

const INCIDENT_NOTE: Partial<Record<IncidentStatus, string>> = {
  verified: "was verified by a responder",
  rejected: "was reviewed and not verified",
  in_progress: "has a response in progress",
  resolved: "was marked resolved",
};

interface Note {
  id: string;
  kind: "alert" | "incident";
  title: string;
  body: string;
  iso: string;
  rank: number;
  href: string;
}

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const { data: alerts = [] } = useAlerts();
  const { data: myReports = [] } = useMyReports();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : loadSeen()
  );
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useOutsideClick(notifRef, () => setNotifOpen(false));
  useOutsideClick(profileRef, () => setProfileOpen(false));

  const notes = useMemo<Note[]>(() => {
    const fromAlerts: Note[] = alerts.map((a) => ({
      id: `alert-${a.id}`,
      kind: "alert",
      title: `${alertSourceLabel(a.source)} · ${a.severity.replace("_", " ")}`,
      body: a.message,
      iso: a.issued_at,
      rank: SEVERITY_RANK[a.severity] ?? 0,
      href: "/support",
    }));
    const fromReports: Note[] = myReports
      .filter((i) => INCIDENT_NOTE[i.status])
      .map((i) => ({
        id: `incident-${i.id}-${i.status}`,
        kind: "incident",
        title: `Your report #${i.id}`,
        body: `Report #${i.id} (${i.type}) ${INCIDENT_NOTE[i.status]}.`,
        iso: i.verified_at ?? i.created_at,
        rank: 2,
        href: "/reports",
      }));
    return [...fromAlerts, ...fromReports].sort(
      (a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime()
    );
  }, [alerts, myReports]);

  const unreadCount = notes.filter((n) => !seen.has(n.id)).length;
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const initial = user?.name?.[0]?.toUpperCase() ?? "?";

  function markAllSeen() {
    if (notes.length === 0) return;
    setSeen((prev) => {
      const next = new Set(prev);
      notes.forEach((n) => next.add(n.id));
      persistSeen(next);
      return next;
    });
  }

  function openNotifs() {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) markAllSeen();
  }

  const dot = (rank: number) =>
    rank >= 4 ? "bg-danger-500" : rank >= 2 ? "bg-warn-500" : "bg-navy-500";

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate2-100">
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-slate2-100 transition-colors text-navy-700" aria-label="Menu">
            <Icon name="Menu" className="w-5 h-5" />
          </button>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-navy-800">Aasha Setu</p>
            <p className="text-[11px] text-slate2-500">Disaster Management &amp; Community Resilience</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative" ref={notifRef}>
            <button
              onClick={openNotifs}
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
                  <span className="text-xs text-slate2-500">{notes.length} recent</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notes.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-slate2-500">
                      Nothing new. Alerts and updates on your reports show up here.
                    </p>
                  ) : (
                    notes.slice(0, 20).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setNotifOpen(false);
                          router.push(n.href);
                        }}
                        className="w-full text-left px-4 py-3 border-b border-slate2-50 hover:bg-slate2-50 transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dot(n.rank)}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-navy-800 flex items-center gap-1.5">
                              <Icon
                                name={n.kind === "alert" ? "Megaphone" : "FileText"}
                                className="w-3.5 h-3.5 text-slate2-400"
                              />
                              {n.title}
                            </p>
                            <p className="text-xs text-slate2-600 mt-0.5 line-clamp-2">{n.body}</p>
                            <p className="text-[11px] text-slate2-400 mt-1">{alertRelativeTime(n.iso)}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
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
                <div className="py-2 px-4">
                  <p className="text-[11px] text-slate2-400">Demo session — no sign-in needed</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
