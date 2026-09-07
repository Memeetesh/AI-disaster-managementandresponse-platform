"use client";

import { useState } from "react";
import { Icon } from "@/components/citizen/Icon";
import { lostFoundItems, breathingExercises, groundingExercises } from "@/data/citizen-mock";
import { useToast } from "@/lib/toast-context";
import { useAlerts } from "@/lib/queries";
import { alertRelativeTime, alertSourceLabel } from "@/lib/alerts";
import type { SeverityLevel } from "@/types";

type Tab = "lost-found" | "authority" | "emotional";

const alertSeverityConfig: Record<SeverityLevel, { badge: string; dot: string; label: string }> = {
  low: { badge: "bg-navy-100 text-navy-700", dot: "bg-navy-500", label: "Low" },
  moderate: { badge: "bg-warn-100 text-warn-700", dot: "bg-warn-500", label: "Moderate" },
  high: { badge: "bg-danger-100 text-danger-700", dot: "bg-danger-500", label: "High" },
  very_high: { badge: "bg-danger-100 text-danger-700", dot: "bg-danger-500", label: "Very high" },
  critical: { badge: "bg-danger-600 text-white", dot: "bg-danger-600", label: "Critical" },
};

const typeConfig = {
  "missing-person": { label: "Missing Person", icon: "Search", color: "text-danger-600 bg-danger-50" },
  "found-person": { label: "Found Person", icon: "CheckCircle2", color: "text-safe-600 bg-safe-50" },
  belonging: { label: "Belonging", icon: "Package", color: "text-navy-600 bg-navy-50" },
};

export default function SupportPage() {
  const { addToast } = useToast();
  const { data: alerts = [], isLoading: alertsLoading } = useAlerts();
  const [activeTab, setActiveTab] = useState<Tab>("lost-found");
  const [lfFilter, setLfFilter] = useState<"all" | "missing-person" | "found-person" | "belonging">("all");
  const [breathingActive, setBreathingActive] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const filteredItems = lfFilter === "all" ? lostFoundItems : lostFoundItems.filter((i) => i.type === lfFilter);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-navy-900">Support &amp; Recovery</h1>
        <p className="text-sm text-slate2-500 mt-1">Post-disaster assistance, communication, and emotional wellbeing.</p>
        <span className="badge bg-slate2-100 text-slate2-500 text-[10px] mt-2">
          Lost &amp; Found and Emotional Support are still sample data
        </span>
      </div>

      <div className="flex gap-1 p-1 bg-white rounded-2xl border border-slate2-100 shadow-[var(--shadow-card)] overflow-x-auto">
        {[
          { id: "lost-found" as const, icon: "Search", label: "Lost & Found" },
          { id: "authority" as const, icon: "Megaphone", label: "Authority Messages" },
          { id: "emotional" as const, icon: "Heart", label: "Emotional Support" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.id ? "bg-navy-700 text-white shadow-sm" : "text-slate2-600 hover:bg-slate2-50"
            }`}
          >
            <Icon name={tab.icon} className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "lost-found" && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button onClick={() => setReportOpen(true)} className="card card-hover p-5 flex flex-col items-start gap-3 text-left">
              <div className="w-11 h-11 rounded-xl bg-danger-50 flex items-center justify-center">
                <Icon name="UserPlus" className="w-5.5 h-5.5 text-danger-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-navy-900">Report Missing Person</p>
                <p className="text-xs text-slate2-500 mt-1">Report someone who is missing</p>
              </div>
            </button>
            <button onClick={() => setReportOpen(true)} className="card card-hover p-5 flex flex-col items-start gap-3 text-left">
              <div className="w-11 h-11 rounded-xl bg-safe-50 flex items-center justify-center">
                <Icon name="CheckCircle2" className="w-5.5 h-5.5 text-safe-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-navy-900">Report Found Person</p>
                <p className="text-xs text-slate2-500 mt-1">Report someone you have found</p>
              </div>
            </button>
            <button onClick={() => setReportOpen(true)} className="card card-hover p-5 flex flex-col items-start gap-3 text-left">
              <div className="w-11 h-11 rounded-xl bg-navy-50 flex items-center justify-center">
                <Icon name="Package" className="w-5.5 h-5.5 text-navy-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-navy-900">Report Found Belonging</p>
                <p className="text-xs text-slate2-500 mt-1">Report an item you have found</p>
              </div>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icon name="Search" className="w-4 h-4 text-slate2-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Search by name, location, or description..." className="input pl-10" />
            </div>
            <div className="flex gap-1.5">
              {[
                { id: "all" as const, label: "All" },
                { id: "missing-person" as const, label: "Missing" },
                { id: "found-person" as const, label: "Found" },
                { id: "belonging" as const, label: "Belongings" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setLfFilter(f.id)}
                  className={`px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    lfFilter === f.id ? "bg-navy-700 text-white" : "bg-white text-slate2-600 border border-slate2-200 hover:bg-slate2-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => {
              const tc = typeConfig[item.type];
              return (
                <div key={item.id} className="card p-5 hover:shadow-[var(--shadow-card-hover)] transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${tc.color} flex items-center justify-center`}>
                        <Icon name={tc.icon} className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-navy-900">{item.name}</p>
                        <p className="text-xs text-slate2-500">{tc.label}</p>
                      </div>
                    </div>
                    <span className={`badge ${item.status === "active" ? "bg-warn-100 text-warn-700" : "bg-safe-100 text-safe-700"}`}>
                      {item.status === "active" ? "Active" : "Resolved"}
                    </span>
                  </div>
                  <p className="text-sm text-slate2-600 mb-3">{item.description}</p>
                  <div className="flex flex-col gap-1.5 text-xs text-slate2-500">
                    <div className="flex items-center gap-1.5">
                      <Icon name="MapPin" className="w-3.5 h-3.5" />
                      <span>{item.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon name="Calendar" className="w-3.5 h-3.5" />
                      <span>{item.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon name="Phone" className="w-3.5 h-3.5" />
                      <span>{item.contact}</span>
                    </div>
                  </div>
                  {item.status === "active" && (
                    <a href={`tel:${item.contact.replace(/\s/g, "")}`} className="btn-secondary w-full mt-4">
                      <Icon name="Phone" className="w-4 h-4" />
                      Contact
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "authority" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-navy-50 border border-navy-100">
            <Icon name="ShieldCheck" className="w-5 h-5 text-navy-600 flex-shrink-0" />
            <p className="text-sm text-navy-700">
              Verified alerts from the command center and the disaster simulator. Updates live.
            </p>
          </div>
          {alertsLoading ? (
            <div className="card p-6 text-sm text-slate2-500">Loading alerts…</div>
          ) : alerts.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate2-500">
              No active alerts right now.
            </div>
          ) : (
            <div className="relative space-y-4">
              <div className="absolute left-5 top-2 bottom-2 w-px bg-slate2-200" />
              {alerts.map((alert) => {
                const sc = alertSeverityConfig[alert.severity];
                return (
                  <div key={alert.id} className="relative pl-12">
                    <div className={`absolute left-3 top-4 w-5 h-5 rounded-full ${sc.dot} ring-4 ring-white flex items-center justify-center`}>
                      <Icon name="Megaphone" className="w-2.5 h-2.5 text-white" />
                    </div>
                    <div className="card p-5 hover:shadow-[var(--shadow-card-hover)] transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="badge text-navy-600 bg-navy-50">
                            <Icon name="Building2" className="w-3 h-3" />
                            {alertSourceLabel(alert.source)}
                          </span>
                          <span className={`badge ${sc.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <span className="text-xs text-slate2-400 flex-shrink-0">
                          {alertRelativeTime(alert.issued_at)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-navy-800 mb-1 capitalize">
                        {alert.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm text-slate2-600 leading-relaxed">{alert.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "emotional" && (
        <div className="space-y-6 animate-fade-in">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-support-50 to-navy-50 p-8 border border-support-100">
            <div className="relative max-w-lg">
              <div className="w-14 h-14 rounded-2xl bg-support-100 flex items-center justify-center mb-4">
                <Icon name="Heart" className="w-7 h-7 text-support-600" />
              </div>
              <h2 className="text-2xl font-bold text-navy-900 mb-2">You don&apos;t have to go through recovery alone.</h2>
              <p className="text-sm text-slate2-600 leading-relaxed">
                Recovery takes time, and it&apos;s okay to ask for help. These tools are here to support you — they are not a substitute for professional care.
              </p>
            </div>
          </div>

          <section>
            <h3 className="text-lg font-bold text-navy-900 mb-1">Guided Breathing</h3>
            <p className="text-xs text-slate2-500 mb-4">Simple exercises to help calm your mind and body.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {breathingExercises.map((ex) => (
                <div key={ex.id} className="card p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-support-50 flex items-center justify-center ${breathingActive === ex.id ? "animate-breathe" : ""}`}>
                      <Icon name="Wind" className="w-5 h-5 text-support-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-navy-900">{ex.title}</p>
                      <p className="text-xs text-slate2-500">{ex.duration}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate2-600 mb-4">{ex.description}</p>
                  <button
                    onClick={() => {
                      if (breathingActive === ex.id) {
                        setBreathingActive(null);
                        addToast("Breathing exercise ended. Well done.", "success");
                      } else {
                        setBreathingActive(ex.id);
                        addToast(`Starting ${ex.title}...`, "info");
                      }
                    }}
                    className={breathingActive === ex.id ? "btn-danger w-full" : "btn-primary w-full"}
                  >
                    <Icon name={breathingActive === ex.id ? "X" : "Activity"} className="w-4 h-4" />
                    {breathingActive === ex.id ? "Stop" : "Start"}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold text-navy-900 mb-1">Grounding Exercises</h3>
            <p className="text-xs text-slate2-500 mb-4">Techniques to bring you back to the present moment.</p>
            <div className="space-y-3">
              {groundingExercises.map((ex) => (
                <div key={ex.id} className="card p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0">
                    <Icon name="Flower2" className="w-5 h-5 text-navy-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-navy-900">{ex.title}</p>
                    <p className="text-xs text-slate2-600 mt-1">{ex.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold text-navy-900 mb-4">Connect &amp; Get Support</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card p-5">
                <div className="w-11 h-11 rounded-xl bg-support-50 flex items-center justify-center mb-4">
                  <Icon name="Headphones" className="w-5.5 h-5.5 text-support-600" />
                </div>
                <p className="text-sm font-bold text-navy-900 mb-1">Talk to Someone</p>
                <p className="text-xs text-slate2-500 mb-4">Connect with a trained support volunteer who can listen and help.</p>
                <button onClick={() => addToast("Live volunteer chat isn't wired up yet.", "info")} className="btn w-full bg-support-600 text-white hover:bg-support-700">
                  <Icon name="MessagesSquare" className="w-4 h-4" />
                  Start Conversation
                </button>
              </div>
              <div className="card p-5">
                <div className="w-11 h-11 rounded-xl bg-navy-50 flex items-center justify-center mb-4">
                  <Icon name="Phone" className="w-5.5 h-5.5 text-navy-600" />
                </div>
                <p className="text-sm font-bold text-navy-900 mb-1">Helpline Numbers</p>
                <p className="text-xs text-slate2-500 mb-4">Free, confidential support lines available 24/7.</p>
                <div className="space-y-2">
                  <a href="tel:9152987821" className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate2-50 hover:bg-slate2-100">
                    <span className="text-xs font-medium text-navy-700">iCall Mental Health</span>
                    <span className="text-sm font-bold text-navy-900">9152987821</span>
                  </a>
                  <a href="tel:18602662345" className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate2-50 hover:bg-slate2-100">
                    <span className="text-xs font-medium text-navy-700">Vandrevala Foundation</span>
                    <span className="text-sm font-bold text-navy-900">1860-2662-345</span>
                  </a>
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate2-50 border border-slate2-100">
            <Icon name="Info" className="w-5 h-5 text-slate2-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate2-500 leading-relaxed">
              These resources are for emotional support and coping — they do not constitute medical advice or diagnosis. If you are in crisis, please call 112 or go to your nearest hospital.
            </p>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setReportOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate2-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy-900">Report a Listing</h2>
              <button onClick={() => setReportOpen(false)} className="text-slate2-400 hover:text-slate2-600 transition-colors">
                <Icon name="X" className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate2-600 mb-1.5 block">Name</label>
                <input className="input" placeholder="Enter name" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate2-600 mb-1.5 block">Description</label>
                <textarea className="input min-h-[80px] resize-none" placeholder="Provide details — appearance, clothing, last known location..." />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate2-600 mb-1.5 block">Last Known Location</label>
                <input className="input" placeholder="Enter location" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate2-600 mb-1.5 block">Contact Number</label>
                <input className="input" placeholder="+91 ..." />
              </div>
              <button
                onClick={() => {
                  setReportOpen(false);
                  addToast("Lost & Found reporting isn't wired to a backend yet — this is a UI preview.", "info");
                }}
                className="btn-primary w-full"
              >
                <Icon name="Send" className="w-4 h-4" />
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
