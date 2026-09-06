"use client";

import { useRef, useState } from "react";
import { Icon } from "./Icon";
import { submitSOS } from "@/lib/incidents-api";
import type { LocationState } from "@/hooks/useLocation";

interface SOSModalProps {
  onClose: () => void;
  onSent: () => void;
  token: string | null;
  location: LocationState;
}

// The parent mounts this only while the modal should be visible (`{open &&
// <SOSModal .../>}`) rather than passing an `open` boolean — that way each
// open is a fresh mount with fresh state, no reset-on-close effect needed.
export function SOSModal({ onClose, onSent, token, location }: SOSModalProps) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startHold = () => {
    if (location.status !== "ok" || !token) return;
    setHolding(true);
    let progress = 0;
    intervalRef.current = setInterval(() => {
      progress += 100 / 30;
      setHoldProgress(progress);
      if (progress >= 100) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        triggerSOS();
      }
    }, 100);
  };

  const stopHold = () => {
    if (!sent) {
      setHolding(false);
      setHoldProgress(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  const triggerSOS = async () => {
    if (location.status !== "ok" || !token) return;
    setSent(true);
    setCountdown(3);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : prev));
    }, 1000);

    try {
      await submitSOS(
        {
          latitude: location.lat,
          longitude: location.lon,
          peopleAffected: 1,
          description: "Emergency SOS sent from the DRISHTI app.",
        },
        token
      );
      if (countdownRef.current) clearInterval(countdownRef.current);
      onSent();
    } catch {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setError("Could not send SOS — check your connection and try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-fade-in" onClick={sent ? undefined : onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        {!sent ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-danger-50 flex items-center justify-center">
                  <Icon name="Siren" className="w-5 h-5 text-danger-600" />
                </div>
                <h2 className="text-xl font-bold text-navy-900">Emergency SOS</h2>
              </div>
              <button onClick={onClose} className="text-slate2-400 hover:text-slate2-600 transition-colors">
                <Icon name="X" className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate2-600 mb-6 text-center">
              Press and hold the button below to send an emergency alert with your location to responders.
            </p>

            {location.status !== "ok" && (
              <p className="text-xs text-warn-600 text-center mb-4">
                {location.status === "loading" ? "Getting your location…" : `Location unavailable: ${location.error}`}
              </p>
            )}

            <div className="flex flex-col items-center gap-4 mb-6">
              <button
                onMouseDown={startHold}
                onMouseUp={stopHold}
                onMouseLeave={stopHold}
                onTouchStart={startHold}
                onTouchEnd={stopHold}
                disabled={location.status !== "ok"}
                className="relative w-40 h-40 rounded-full bg-danger-600 text-white flex flex-col items-center justify-center shadow-lg shadow-danger-600/30 active:scale-95 transition-transform no-tap-highlight select-none disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {holding && (
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="74" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                    <circle
                      cx="80" cy="80" r="74" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={465} strokeDashoffset={465 - (465 * holdProgress) / 100}
                    />
                  </svg>
                )}
                <Icon name="Siren" className="w-10 h-10 mb-1 relative z-10" />
                <span className="text-lg font-bold relative z-10">Hold for SOS</span>
              </button>
              <p className="text-xs text-slate2-500">Hold for 3 seconds to confirm</p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate2-500">
              <Icon name="MapPin" className="w-3.5 h-3.5" />
              <span>Your location will be shared</span>
            </div>
          </>
        ) : error ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-20 h-20 rounded-full bg-danger-100 flex items-center justify-center mb-4">
              <Icon name="AlertCircle" className="w-10 h-10 text-danger-600" />
            </div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">SOS not sent</h2>
            <p className="text-sm text-slate2-600 mb-6">{error}</p>
            <button onClick={onClose} className="btn-secondary w-full">Close</button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-danger-200 animate-pulse-ring" />
              <div className="absolute inset-0 rounded-full bg-danger-300 animate-pulse-ring" style={{ animationDelay: "0.3s" }} />
              <div className="relative w-24 h-24 rounded-full bg-danger-600 flex items-center justify-center shadow-lg">
                <Icon name="Send" className="w-10 h-10 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-navy-900 mb-2">Sending SOS Alert</h2>
            <p className="text-sm text-slate2-600 mb-4">Notifying responders with your location…</p>
            {countdown !== null && <div className="text-3xl font-bold text-danger-600">{countdown}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
