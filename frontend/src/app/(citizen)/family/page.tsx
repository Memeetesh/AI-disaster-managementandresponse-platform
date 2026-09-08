"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/citizen/Icon";
import { FamilyMemberModal } from "@/components/citizen/FamilyMemberModal";
import { familyMembers } from "@/data/citizen-mock";
import { useToast } from "@/lib/toast-context";
import { ApiError } from "@/lib/api";
import { useLocation } from "@/hooks/useLocation";
import {
  useFamily,
  useFamilyRequests,
  useLocationSharing,
  useAddFamilyMember,
  useRemoveFamilyMember,
  useRespondToFamilyRequest,
  useSetLocationSharing,
  useSendLocationPing,
} from "@/lib/queries";
import type { FamilyStatus, RealFamilyMember } from "@/lib/family-api";
import type { FamilyMember } from "@/types/citizen-ui";

const PING_INTERVAL_MS = 120_000;

// Small pill button (the shared .btn class bakes in larger padding via @apply,
// which is awkward to override under Tailwind v4).
const SM_BTN =
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all active:scale-[0.98] disabled:opacity-60";

const realStatusConfig: Record<
  FamilyStatus,
  { dot: string; label: string; bg: string; border: string; icon: string }
> = {
  safe: { dot: "bg-safe-500", label: "text-safe-700", bg: "bg-safe-50", border: "border-safe-200", icon: "CheckCircle2" },
  needs_help: { dot: "bg-danger-500", label: "text-danger-700", bg: "bg-danger-50", border: "border-danger-200", icon: "AlertCircle" },
  in_emergency: { dot: "bg-danger-600", label: "text-danger-700", bg: "bg-danger-50", border: "border-danger-300", icon: "Siren" },
  no_checkin: { dot: "bg-warn-500", label: "text-warn-700", bg: "bg-warn-50", border: "border-warn-200", icon: "Clock" },
  invite_pending: { dot: "bg-slate2-400", label: "text-slate2-600", bg: "bg-slate2-50", border: "border-slate2-200", icon: "Clock" },
  invite_declined: { dot: "bg-slate2-300", label: "text-slate2-500", bg: "bg-slate2-50", border: "border-slate2-200", icon: "X" },
  not_registered: { dot: "bg-slate2-400", label: "text-slate2-600", bg: "bg-slate2-50", border: "border-slate2-200", icon: "UserPlus" },
};

const mockStatusConfig = {
  safe: { dot: "bg-safe-500", label: "text-safe-700", bg: "bg-safe-50", border: "border-safe-200", icon: "CheckCircle2" },
  warning: { dot: "bg-warn-500", label: "text-warn-700", bg: "bg-warn-50", border: "border-warn-200", icon: "AlertTriangle" },
  danger: { dot: "bg-danger-500", label: "text-danger-700", bg: "bg-danger-50", border: "border-danger-200", icon: "AlertCircle" },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "no update yet";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

function LocationMapModal({
  member,
  onClose,
}: {
  member: RealFamilyMember | null;
  onClose: () => void;
}) {
  if (!member || member.latitude === null || member.longitude === null) return null;
  const lat = member.latitude;
  const lon = member.longitude;
  const bbox = `${lon - 0.012},${lat - 0.009},${lon + 0.012},${lat + 0.009}`;
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
  const gmaps = `https://www.google.com/maps?q=${lat},${lon}`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate2-100">
          <div>
            <p className="text-sm font-bold text-navy-900">{member.name}&apos;s last location</p>
            <p className="text-xs text-slate2-400">
              Shared {timeAgo(member.location_updated_at)}
              {member.distance_km !== null ? ` · ~${member.distance_km} km from you` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-slate2-400 hover:text-navy-700">
            <Icon name="X" className="w-5 h-5" />
          </button>
        </div>
        <iframe
          title={`${member.name} location`}
          src={embed}
          className="w-full h-72 border-0"
          loading="lazy"
        />
        <div className="px-5 py-3 flex items-center justify-between">
          <p className="text-[11px] text-slate2-400">
            Approximate point from the member&apos;s own device — not continuous tracking.
          </p>
          <a
            href={gmaps}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-navy-700 hover:text-navy-900 whitespace-nowrap"
          >
            Open in Maps
          </a>
        </div>
      </div>
    </div>
  );
}

export default function FamilyPage() {
  const { addToast } = useToast();
  const loc = useLocation();
  const origin = loc.status === "ok" ? { lat: loc.lat, lon: loc.lon } : null;

  const { data: family, isLoading, isError } = useFamily(origin);
  const { data: requests } = useFamilyRequests();
  const { data: sharing } = useLocationSharing();

  const addMember = useAddFamilyMember();
  const removeMember = useRemoveFamilyMember();
  const respond = useRespondToFamilyRequest();
  const setSharing = useSetLocationSharing();
  const { mutate: sendPing } = useSendLocationPing();

  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [mapMember, setMapMember] = useState<RealFamilyMember | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", relation: "" });

  const sharingOn = sharing?.enabled ?? false;

  // While location sharing is on and this page is open, push a fresh point
  // now and every 2 minutes. Stops the moment sharing is turned off or the
  // page unmounts.
  useEffect(() => {
    if (!sharingOn) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    let cancelled = false;
    const pushOnce = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          sendPing({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
      );
    };
    pushOnce();
    const iv = setInterval(pushOnce, PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [sharingOn, sendPing]);

  const members: RealFamilyMember[] = family ?? [];
  const incoming = requests ?? [];
  const safeCount = members.filter((m) => m.status === "safe").length;
  const awaitingCount = members.filter(
    (m) => m.status === "no_checkin" || m.status === "invite_pending"
  ).length;
  const helpCount = members.filter(
    (m) => m.status === "needs_help" || m.status === "in_emergency"
  ).length;

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (name.length < 1 || phone.replace(/\D/g, "").length < 6) {
      addToast("Enter a name and a valid phone number.", "error");
      return;
    }
    addMember.mutate(
      { name, phone, relation: form.relation.trim() || null },
      {
        onSuccess: (m) => {
          setForm({ name: "", phone: "", relation: "" });
          setShowForm(false);
          addToast(
            m.link_status === "pending"
              ? `Request sent to ${m.name}. You'll see their status once they accept.`
              : `${m.name} added as a saved contact (not on DRISHTI yet).`,
            "success"
          );
        },
        onError: (err) => {
          addToast(
            err instanceof ApiError ? err.message : "Couldn't add that person. Try again.",
            "error"
          );
        },
      }
    );
  }

  function handleRemove(m: RealFamilyMember) {
    removeMember.mutate(m.id, {
      onSuccess: () => addToast(`${m.name} removed from your circle.`, "info"),
      onError: () => addToast("Couldn't remove that person. Try again.", "error"),
    });
  }

  function handleRespond(id: number, accept: boolean) {
    respond.mutate(
      { id, accept },
      {
        onSuccess: () =>
          addToast(accept ? "You're now in their circle." : "Request declined.", "info"),
        onError: () => addToast("Couldn't respond. Try again.", "error"),
      }
    );
  }

  function toggleSharing() {
    const next = !sharingOn;
    setSharing.mutate(next, {
      onSuccess: () =>
        addToast(
          next
            ? "Location sharing on — your circle can see your point while this page is open."
            : "Location sharing off. Your last point was cleared.",
          next ? "success" : "info"
        ),
      onError: () => addToast("Couldn't change location sharing. Try again.", "error"),
    });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-navy-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Icon name="Users" className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-navy-300">Family Safety</span>
            <span className="badge bg-safe-500/20 text-safe-200 text-[10px]">Live</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Your Family, Connected &amp; Safe</h1>
          <p className="text-sm text-navy-300 max-w-md">
            Add loved ones by phone. If they use DRISHTI and accept, their live
            safety status shows here from their own check-ins.
          </p>

          <div className="flex flex-wrap gap-3 mt-5">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-safe-400" />
              <span className="text-2xl font-bold text-white">{safeCount}</span>
              <span className="text-xs text-navy-300 font-medium">Safe</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-warn-400" />
              <span className="text-2xl font-bold text-white">{awaitingCount}</span>
              <span className="text-xs text-navy-300 font-medium">Awaiting</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-danger-400" />
              <span className="text-2xl font-bold text-white">{helpCount}</span>
              <span className="text-xs text-navy-300 font-medium">Need Help</span>
            </div>
          </div>
        </div>
      </div>

      {/* Share my location */}
      <div
        className={`card p-5 border ${
          sharingOn ? "border-safe-200 bg-safe-50/40" : "border-slate2-100"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                sharingOn ? "bg-safe-100" : "bg-slate2-100"
              }`}
            >
              <Icon
                name={sharingOn ? "LocateFixed" : "MapPin"}
                className={`w-5 h-5 ${sharingOn ? "text-safe-600" : "text-slate2-400"}`}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900">Share my live location</p>
              <p className="text-xs text-slate2-500 mt-1 leading-relaxed max-w-sm">
                {sharingOn
                  ? `Sharing with people who've accepted your circle · updated ${timeAgo(
                      sharing?.updated_at ?? null
                    )}. Only while this page is open.`
                  : "Off by default. When on, your circle sees your last point (not continuous tracking), only while this page is open."}
              </p>
              {loc.status === "error" && !sharingOn && (
                <p className="text-[11px] text-warn-600 mt-1">
                  Location permission is needed — your browser will ask when you turn this on.
                </p>
              )}
            </div>
          </div>
          <button
            onClick={toggleSharing}
            disabled={setSharing.isPending}
            role="switch"
            aria-checked={sharingOn}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              sharingOn ? "bg-safe-500" : "bg-slate2-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                sharingOn ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-navy-900">Requests</h2>
          {incoming.map((r) => (
            <div
              key={r.id}
              className="card p-4 border border-navy-100 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-navy-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="UserPlus" className="w-5 h-5 text-navy-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-900 truncate">
                    {r.owner_name} wants to follow your safety status
                  </p>
                  <p className="text-xs text-slate2-400">
                    {r.relation ? `Added you as: ${r.relation} · ` : ""}They&apos;ll see your
                    check-ins, not your location.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleRespond(r.id, true)}
                  disabled={respond.isPending}
                  className={`${SM_BTN} bg-safe-600 text-white hover:bg-safe-700`}
                >
                  Accept
                </button>
                <button
                  onClick={() => handleRespond(r.id, false)}
                  disabled={respond.isPending}
                  className={`${SM_BTN} bg-slate2-100 text-navy-700 hover:bg-slate2-200`}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Your circle */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-900">Your Circle</h2>
          <button
            onClick={() => setShowForm((v) => !v)}
            className={`${SM_BTN} bg-navy-700 text-white hover:bg-navy-800`}
          >
            <Icon name={showForm ? "X" : "Plus"} className="w-4 h-4" />
            {showForm ? "Cancel" : "Add Member"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="card p-5 space-y-4 border border-navy-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate2-600">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Meera"
                  className="input mt-1"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate2-600">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="10-digit mobile"
                  className="input mt-1"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate2-600">
                  Relation <span className="text-slate2-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.relation}
                  onChange={(e) => setForm({ ...form, relation: e.target.value })}
                  placeholder="e.g. Sister"
                  className="input mt-1"
                  maxLength={40}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={addMember.isPending}
                className="btn bg-safe-600 text-white hover:bg-safe-700 disabled:opacity-60"
              >
                <Icon name="UserPlus" className="w-4 h-4" />
                {addMember.isPending ? "Adding…" : "Add to circle"}
              </button>
              <p className="text-xs text-slate2-400">
                We only store the name and phone you enter.
              </p>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="card p-8 text-center text-sm text-slate2-400">Loading your circle…</div>
        ) : isError ? (
          <div className="card p-8 text-center text-sm text-danger-600">
            Couldn&apos;t load your family circle. Try again shortly.
          </div>
        ) : members.length === 0 ? (
          <div className="card p-8 text-center border-2 border-dashed border-slate2-200">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate2-100 flex items-center justify-center mb-3">
              <Icon name="Users" className="w-6 h-6 text-slate2-400" />
            </div>
            <p className="text-sm font-semibold text-navy-800">No family members yet</p>
            <p className="text-xs text-slate2-400 mt-1">
              Add a loved one by phone to start tracking their safety.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => {
              const sc = realStatusConfig[m.status];
              return (
                <div key={m.id} className={`card p-5 border ${sc.border}`}>
                  <div className="flex items-start gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 rounded-2xl bg-navy-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {initialsOf(m.name)}
                      </div>
                      <div
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${sc.dot} ring-2 ring-white flex items-center justify-center`}
                      >
                        <Icon name={sc.icon} className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-navy-900 truncate">{m.name}</p>
                        {m.relation && (
                          <span className="text-xs text-slate2-400 font-medium">{m.relation}</span>
                        )}
                      </div>
                      <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg ${sc.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        <span className={`text-xs font-semibold ${sc.label}`}>{m.status_label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-slate2-400">
                        <Icon
                          name={
                            m.status === "invite_pending"
                              ? "Clock"
                              : m.on_drishti
                                ? "CheckCircle2"
                                : "Info"
                          }
                          className="w-3 h-3"
                        />
                        <span>
                          {m.status === "invite_pending"
                            ? "Waiting for them to accept"
                            : m.status === "invite_declined"
                              ? "They declined the request"
                              : !m.on_drishti
                                ? "Not a DRISHTI user"
                                : m.last_check_in_at
                                  ? `Checked in ${timeAgo(m.last_check_in_at)}`
                                  : "No check-in yet"}
                        </span>
                      </div>
                      {m.shares_location && (
                        <button
                          onClick={() => setMapMember(m)}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-navy-700 hover:text-navy-900"
                        >
                          <Icon name="MapPinned" className="w-3.5 h-3.5" />
                          {m.distance_km !== null ? `~${m.distance_km} km away` : "Location shared"}
                          <span className="text-slate2-400 font-normal">
                            · {timeAgo(m.location_updated_at)}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate2-50 flex items-center justify-between">
                    <a
                      href={`tel:${m.phone.replace(/\s/g, "")}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-700 hover:text-navy-900"
                    >
                      <Icon name="Phone" className="w-3.5 h-3.5" />
                      Call
                    </a>
                    <button
                      onClick={() => handleRemove(m)}
                      disabled={removeMember.isPending}
                      className="inline-flex items-center gap-1 text-xs text-slate2-400 hover:text-danger-600 disabled:opacity-50"
                    >
                      <Icon name="X" className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Privacy note */}
      <div className="rounded-2xl bg-navy-50 border border-navy-100 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-navy-100 flex items-center justify-center flex-shrink-0">
          <Icon name="ShieldCheck" className="w-5 h-5 text-navy-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-navy-900">Privacy First</p>
          <p className="text-xs text-slate2-500 mt-1 leading-relaxed">
            A member must accept before you see anything. Status comes from their own
            check-ins and SOS activity. Location sharing is a separate opt-in they control,
            updates only while their app is open, and clears the moment they turn it off.
          </p>
        </div>
      </div>

      {/* Demo section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-navy-900">Sample Family</h2>
          <span className="badge bg-slate2-100 text-slate2-500 text-[10px]">For demonstration</span>
        </div>
        <p className="text-xs text-slate2-400 -mt-2">
          These profiles are illustrative only — they show what a fully-populated circle
          looks like during a live disaster.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-90">
          {familyMembers.map((m, idx) => {
            const sc = mockStatusConfig[m.status];
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMember(m)}
                className={`card card-hover p-5 text-left stagger-${Math.min(idx + 1, 6)} border ${sc.border}`}
              >
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className={`relative w-14 h-14 overflow-hidden rounded-2xl ${m.avatarColor} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                      {m.initials}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.photoUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => e.currentTarget.remove()}
                      />
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${sc.dot} ring-2 ring-white flex items-center justify-center z-10`}>
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
        </div>
      </section>

      <FamilyMemberModal
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onCheckIn={(name) => {
          setSelectedMember(null);
          addToast(`Check-in request sent to ${name} (demo — sample profile).`, "info");
        }}
      />
      <LocationMapModal member={mapMember} onClose={() => setMapMember(null)} />
    </div>
  );
}
