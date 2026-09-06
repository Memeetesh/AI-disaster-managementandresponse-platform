"use client";

import { useState } from "react";
import { Icon } from "@/components/citizen/Icon";
import { FamilyMemberModal } from "@/components/citizen/FamilyMemberModal";
import { familyMembers } from "@/data/citizen-mock";
import { useToast } from "@/lib/toast-context";
import type { FamilyMember } from "@/types/citizen-ui";

const statusConfig = {
  safe: { dot: "bg-safe-500", label: "text-safe-700", bg: "bg-safe-50", border: "border-safe-200", icon: "CheckCircle2" },
  warning: { dot: "bg-warn-500", label: "text-warn-700", bg: "bg-warn-50", border: "border-warn-200", icon: "AlertTriangle" },
  danger: { dot: "bg-danger-500", label: "text-danger-700", bg: "bg-danger-50", border: "border-danger-200", icon: "AlertCircle" },
};

export default function FamilyPage() {
  const { addToast } = useToast();
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  const safeCount = familyMembers.filter((m) => m.status === "safe").length;
  const warningCount = familyMembers.filter((m) => m.status === "warning").length;
  const dangerCount = familyMembers.filter((m) => m.status === "danger").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-navy-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Icon name="Users" className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-navy-300">Family Safety</span>
            <span className="badge bg-white/10 text-navy-200 text-[10px]">Sample data</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Your Family, Connected &amp; Safe</h1>
          <p className="text-sm text-navy-300 max-w-md">
            Real-time safety status of your loved ones. Click any member to view details or request a check-in.
          </p>

          <div className="flex flex-wrap gap-3 mt-5">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-safe-400" />
              <span className="text-2xl font-bold text-white">{safeCount}</span>
              <span className="text-xs text-navy-300 font-medium">Safe</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-warn-400" />
              <span className="text-2xl font-bold text-white">{warningCount}</span>
              <span className="text-xs text-navy-300 font-medium">Caution</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-danger-400" />
              <span className="text-2xl font-bold text-white">{dangerCount}</span>
              <span className="text-xs text-navy-300 font-medium">Need Help</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {familyMembers.map((m, idx) => {
          const sc = statusConfig[m.status];
          return (
            <button
              key={m.id}
              onClick={() => setSelectedMember(m)}
              className={`card card-hover card-glow p-5 text-left stagger-${Math.min(idx + 1, 6)} border ${sc.border}`}
            >
              <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <div className={`w-14 h-14 rounded-2xl ${m.avatarColor} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                    {m.initials}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${sc.dot} ring-2 ring-white flex items-center justify-center`}>
                    <Icon name={sc.icon} className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-navy-900 truncate">{m.name}</p>
                    <span className="text-xs text-slate2-400 font-medium">{m.role}</span>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg ${sc.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    <span className={`text-xs font-semibold ${sc.label}`}>{m.statusLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-slate2-400">
                    <Icon name="Clock" className="w-3 h-3" />
                    <span>Updated {m.lastUpdated}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate2-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate2-500">
                  <Icon name="MapPin" className="w-3.5 h-3.5 text-slate2-400" />
                  <span className="truncate">{m.location}</span>
                </div>
                <Icon name="ChevronRight" className="w-4 h-4 text-slate2-300 flex-shrink-0" />
              </div>
            </button>
          );
        })}

        <button
          onClick={() => addToast("Family invites aren't wired up yet — coming in a later phase.", "info")}
          className="card card-hover p-5 flex flex-col items-center justify-center gap-3 min-h-[180px] border-2 border-dashed border-slate2-200 hover:border-navy-300 hover:bg-navy-50/30 transition-all"
        >
          <div className="w-12 h-12 rounded-2xl bg-slate2-100 flex items-center justify-center">
            <Icon name="Plus" className="w-6 h-6 text-slate2-400" />
          </div>
          <p className="text-sm font-semibold text-slate2-500">Add Family Member</p>
          <p className="text-xs text-slate2-400 text-center">Invite a loved one to join your safety circle</p>
        </button>
      </div>

      <div className="rounded-2xl bg-navy-50 border border-navy-100 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-navy-100 flex items-center justify-center flex-shrink-0">
          <Icon name="ShieldCheck" className="w-5 h-5 text-navy-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-navy-900">Privacy First</p>
          <p className="text-xs text-slate2-500 mt-1 leading-relaxed">
            Only approximate area is shared — precise locations are never exposed. Family members control their own check-in status and can opt out at any time.
          </p>
        </div>
      </div>

      <FamilyMemberModal
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onCheckIn={(name) => {
          setSelectedMember(null);
          addToast(`Check-in request sent to ${name} (demo — no backend yet).`, "success");
        }}
      />
    </div>
  );
}
