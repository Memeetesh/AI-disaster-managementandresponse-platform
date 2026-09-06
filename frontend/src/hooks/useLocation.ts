"use client";

import { useEffect, useState } from "react";

export type LocationState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ok"; lat: number; lon: number };

export function useLocation() {
  const [state, setState] = useState<LocationState>(() =>
    typeof navigator !== "undefined" && "geolocation" in navigator
      ? { status: "loading" }
      : { status: "error", error: "Geolocation not supported by this browser" }
  );

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({ status: "ok", lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => setState({ status: "error", error: err.message }),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []);

  return state;
}
