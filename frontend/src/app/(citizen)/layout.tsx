"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ToastProvider } from "@/lib/toast-context";
import { Sidebar } from "@/components/citizen/Sidebar";
import { Header } from "@/components/citizen/Header";
import { Icon } from "@/components/citizen/Icon";
import Link from "next/link";
import { usePathname } from "next/navigation";

const mobileNavItems = [
  { href: "/", icon: "Home", label: "Home" },
  { href: "/reports", icon: "FileText", label: "Reports" },
  { href: "/emergency", icon: "Siren", label: "SOS" },
  { href: "/family", icon: "Users", label: "Family" },
  { href: "/support", icon: "HeartHandshake", label: "Support" },
];

export default function CitizenLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate2-500 bg-slate2-50">Loading…</div>;
  }

  return (
    <ToastProvider>
      <div className="citizen-app flex h-screen overflow-hidden bg-slate2-50">
        <div className="hidden lg:block flex-shrink-0">
          <Sidebar />
        </div>

        {mobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-[60] flex">
            <div className="fixed inset-0 bg-navy-950/50 backdrop-blur-sm animate-fade-in" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative animate-slide-in">
              <Sidebar onClose={() => setMobileSidebarOpen(false)} isMobile />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onMenuClick={() => setMobileSidebarOpen(true)} />

          <main className="flex-1 overflow-y-auto px-4 md:px-6 py-5 pb-28 lg:pb-6">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>

          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-slate2-100 shadow-[var(--shadow-card-lg)]">
            <div className="flex items-center justify-around px-2 py-1.5 max-w-md mx-auto">
              {mobileNavItems.map((item) => {
                const active = pathname === item.href;
                const isEmergency = item.href === "/emergency";
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors no-tap-highlight ${
                      active ? "text-navy-700" : "text-slate2-400"
                    }`}
                  >
                    <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      isEmergency ? "bg-danger-600 text-white shadow-md shadow-danger-600/30 active:scale-90" : active ? "bg-navy-100 text-navy-700 scale-105" : ""
                    }`}>
                      <Icon name={item.icon} className="w-5 h-5" strokeWidth={isEmergency ? 2.5 : 2} />
                      {isEmergency && <div className="absolute inset-0 rounded-xl bg-danger-400 animate-pulse-ring opacity-20" />}
                    </div>
                    <span className={`text-[10px] font-semibold ${active ? "text-navy-700" : "text-slate2-400"}`}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </ToastProvider>
  );
}
