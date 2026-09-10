"use client";

import { useState } from "react";
import { Icon } from "@/components/citizen/Icon";
import { SOSModal } from "@/components/citizen/SOSModal";
import { emergencyQuickActions } from "@/data/citizen-mock";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { useLocation } from "@/hooks/useLocation";
import { useCheckIn, useMyCheckIn, useNearbyPlaces, useNearestShelters } from "@/lib/queries";
import { alertRelativeTime } from "@/lib/alerts";
import { downloadOfflineMap, type OfflineMapPlace } from "@/lib/offline-map";

function openOnMap(place: { latitude: number; longitude: number }): void {
  const { latitude: lat, longitude: lon } = place;
  window.open(
    `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`,
    "_blank",
    "noopener,noreferrer"
  );
}

export default function EmergencyPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const location = useLocation();
  const [sosOpen, setSosOpen] = useState(false);

  const lat = location.status === "ok" ? location.lat : null;
  const lon = location.status === "ok" ? location.lon : null;
  const { data: appShelters = [] } = useNearestShelters(lat, lon, 5);
  const { data: hospitals = [], isLoading: hospitalsLoading } = useNearbyPlaces(lat, lon, "hospital", {
    radiusKm: 12,
    limit: 5,
  });
  const appSheltersNear = appShelters.filter((s) => s.distance_km <= 25);
  const { data: osmShelters = [] } = useNearbyPlaces(lat, lon, "shelter", {
    radiusKm: 15,
    limit: 5,
    enabled: appSheltersNear.length < 3,
  });
  const checkIn = useCheckIn();
  const [buildingMap, setBuildingMap] = useState(false);
  const { data: myCheckIn } = useMyCheckIn();

  // "Rescue center" = an app-registered relief shelter (has live capacity).
  // "Hospital" = a real hospital from OpenStreetMap.
  const nearestRescue = appShelters[0] ?? null;
  const nearestHospital = hospitals[0] ?? null;
  const isSafe = myCheckIn?.status === "safe";

  function actionDetail(id: string): string {
    if (id === "hospital") {
      if (nearestHospital) return `${nearestHospital.name} · ${nearestHospital.distance_km.toFixed(1)} km`;
      return hospitalsLoading ? "Finding nearest hospital…" : "None found nearby";
    }
    if (id === "rescue") {
      return nearestRescue
        ? `${nearestRescue.name} · ${nearestRescue.distance_km.toFixed(1)} km`
        : "No registered shelter nearby";
    }
    if (id === "offline-map") {
      return buildingMap ? "Building…" : "Download for offline use";
    }
    return emergencyQuickActions.find((a) => a.id === id)?.detail ?? "";
  }

  function handleAction(id: string): void {
    if (id === "helpline") {
      window.location.assign("tel:112");
      return;
    }
    if (id === "hospital") {
      if (nearestHospital?.phone) {
        window.location.assign(`tel:${nearestHospital.phone.replace(/[^\d+]/g, "")}`);
      } else if (nearestHospital) {
        openOnMap(nearestHospital);
      } else {
        addToast(
          location.status === "ok" ? "No hospital found within 12 km." : "Waiting for your location.",
          "info"
        );
      }
      return;
    }
    if (id === "rescue") {
      if (nearestRescue) openOnMap(nearestRescue);
      else addToast("No registered relief shelter near you yet.", "info");
      return;
    }
    if (id === "offline-map") {
      handleOfflineMap();
      return;
    }
    addToast("This action isn't available yet.", "info");
  }

  function handleOfflineMap(): void {
    if (location.status !== "ok" || lat === null || lon === null) {
      addToast("I need your location to build an offline map.", "info");
      return;
    }
    const shelterSource: OfflineMapPlace[] =
      appSheltersNear.length > 0
        ? appSheltersNear.map((s) => ({
            name: s.name,
            latitude: s.latitude,
            longitude: s.longitude,
            distance_km: s.distance_km,
            detail: `${s.occupied}/${s.capacity} · ${s.status}`,
            address: s.accessibility,
          }))
        : osmShelters.map((p) => ({
            name: p.name,
            latitude: p.latitude,
            longitude: p.longitude,
            distance_km: p.distance_km,
            phone: p.phone,
            address: p.address,
          }));
    const hospital: OfflineMapPlace | null = nearestHospital
      ? {
          name: nearestHospital.name,
          latitude: nearestHospital.latitude,
          longitude: nearestHospital.longitude,
          distance_km: nearestHospital.distance_km,
          phone: nearestHospital.phone,
          address: nearestHospital.address,
        }
      : null;

    setBuildingMap(true);
    addToast("Preparing your offline map…", "info");
    downloadOfflineMap({
      lat,
      lon,
      accuracyM: location.status === "ok" ? location.accuracy : null,
      shelters: shelterSource,
      hospital,
    })
      .then(() =>
        addToast("Saved. Open aasha-setu-offline-map.html anytime — no internet needed.", "success")
      )
      .catch(() => addToast("Could not build the offline map. Try again with a connection.", "error"))
      .finally(() => setBuildingMap(false));
  }

  function handleSafe(): void {
    checkIn.mutate(
      { status: "safe", latitude: lat, longitude: lon },
      {
        onSuccess: () =>
          addToast("You're marked as safe. Your approximate area has been shared.", "success"),
        onError: () => addToast("Couldn't send your check-in. Try again.", "error"),
      }
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-danger-600 via-danger-700 to-danger-800 p-5 md:p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-danger-400/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Icon name="Siren" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Emergency Assistance</h1>
              <p className="text-sm text-danger-100">Immediate help is available. Stay calm.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {location.status === "ok" ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
                <Icon name="MapPin" className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warn-500/30 backdrop-blur-sm border border-warn-300/30">
                <Icon name="MapPin" className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {location.status === "loading" ? "Getting location…" : "Location unavailable"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center py-6 md:py-8">
        <button
          onClick={() => setSosOpen(true)}
          className="relative w-48 h-48 md:w-56 md:h-56 rounded-full bg-danger-600 text-white flex flex-col items-center justify-center shadow-2xl shadow-danger-600/40 hover:scale-105 active:scale-95 transition-all duration-200 no-tap-highlight pulse-glow"
        >
          <div className="absolute inset-0 rounded-full bg-danger-400 animate-pulse-ring opacity-20" />
          <div className="absolute inset-0 rounded-full bg-danger-400 animate-pulse-ring opacity-15" style={{ animationDelay: "0.4s" }} />
          <Icon name="Siren" className="w-14 h-14 md:w-16 md:h-16 mb-2 relative z-10" />
          <span className="text-3xl md:text-4xl font-bold relative z-10">SOS</span>
          <span className="text-xs md:text-sm text-danger-100 relative z-10 mt-1 text-center px-4">Press and hold for emergency assistance</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {emergencyQuickActions.map((action, idx) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.id)}
            className={`card card-hover card-glow p-5 flex items-start gap-4 text-left group stagger-${Math.min(idx + 1, 6)}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${action.color} transition-transform group-hover:scale-110`}>
              <Icon name={action.icon} className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-navy-900">{action.label}</p>
              <p className="text-xs text-slate2-500 mt-1 truncate">{actionDetail(action.id)}</p>
            </div>
            <Icon name="ChevronRight" className="w-4 h-4 text-slate2-300 flex-shrink-0 mt-1 group-hover:text-navy-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1.5 pt-2">
        <button
          onClick={handleSafe}
          disabled={checkIn.isPending}
          className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200 no-tap-highlight disabled:opacity-60 ${
            isSafe
              ? "bg-safe-100 text-safe-700 border-2 border-safe-300"
              : "bg-white text-safe-700 border-2 border-safe-200 hover:border-safe-400 hover:bg-safe-50 active:scale-95"
          }`}
        >
          <Icon name={isSafe ? "CheckCircle2" : "ShieldCheck"} className="w-5 h-5" />
          {checkIn.isPending ? "Sending…" : isSafe ? "You are marked as Safe" : "I am Safe"}
        </button>
        {isSafe && myCheckIn && (
          <p className="text-xs text-slate2-400">Checked in {alertRelativeTime(myCheckIn.created_at)}</p>
        )}
      </div>

      {sosOpen && (
        <SOSModal
          onClose={() => setSosOpen(false)}
          token={token}
          location={location}
          onSent={() => {
            setSosOpen(false);
            addToast("SOS sent. A responder will review it shortly.", "success");
          }}
        />
      )}
    </div>
  );
}
