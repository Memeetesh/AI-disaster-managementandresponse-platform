"use client";

import { Icon } from "./Icon";
import type { FamilyMember } from "@/types/citizen-ui";

interface FamilyMemberModalProps {
  member: FamilyMember | null;
  onClose: () => void;
  onCheckIn: (name: string) => void;
}

const statusConfig = {
  safe: { bg: "bg-safe-50", text: "text-safe-700", icon: "CheckCircle2", iconColor: "text-safe-600" },
  warning: { bg: "bg-warn-50", text: "text-warn-700", icon: "AlertTriangle", iconColor: "text-warn-600" },
  danger: { bg: "bg-danger-50", text: "text-danger-700", icon: "AlertCircle", iconColor: "text-danger-600" },
};

export function FamilyMemberModal({ member, onClose, onCheckIn }: FamilyMemberModalProps) {
  if (!member) return null;
  const sc = statusConfig[member.status];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-5 bg-navy-900 text-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-navy-300">Family Member</span>
            <button onClick={onClose} className="text-navy-300 hover:text-white transition-colors">
              <Icon name="X" className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className={`relative w-16 h-16 overflow-hidden rounded-2xl ${member.avatarColor} flex items-center justify-center text-white text-xl font-bold shadow-lg ring-2 ring-white/20`}>
              {member.initials}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={member.photoUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => e.currentTarget.remove()}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold">{member.name}</h2>
              <p className="text-sm text-navy-300">{member.role}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${sc.bg}`}>
            <Icon name={sc.icon} className={`w-5 h-5 ${sc.iconColor}`} />
            <div>
              <p className="text-sm font-semibold text-navy-900">Status: {member.statusLabel}</p>
              <p className="text-xs text-slate2-500">Last updated {member.lastUpdated}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 py-2.5 border-b border-slate2-50">
              <Icon name="MapPin" className="w-4 h-4 text-slate2-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate2-500">Location</p>
                <p className="text-sm font-medium text-navy-800">{member.location}</p>
                <p className="text-[11px] text-slate2-400 mt-0.5">Approximate area only — precise location not shared</p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2.5">
              <Icon name="Phone" className="w-4 h-4 text-slate2-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate2-500">Emergency Contact</p>
                <p className="text-sm font-medium text-navy-800">{member.contact}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => onCheckIn(member.name)} className="flex-1 btn bg-navy-700 text-white hover:bg-navy-800">
              <Icon name="MessageCircle" className="w-4 h-4" />
              Request Check-in
            </button>
            <a href={`tel:${member.contact.replace(/\s/g, "")}`} className="flex-1 btn bg-slate2-100 text-navy-700 hover:bg-slate2-200">
              <Icon name="Phone" className="w-4 h-4" />
              Call
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
