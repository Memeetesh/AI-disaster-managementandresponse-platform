"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { queryKeys, invalidateRealtimeQueries } from "@/lib/queries";
import type { Incident } from "@/types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const STREAM_URL = `${API_URL}/stream`;
const RETRY_MS = 3000;

interface RealtimeContextValue {
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({ connected: false });

/** `{ connected }` — drives the dashboard's Live / Reconnecting indicator. */
export function useRealtimeStatus(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

/**
 * Holds one SSE connection to `GET /api/v1/stream` for the whole app and
 * turns server events into TanStack Query cache updates. Mounted under
 * QueryProvider + AuthProvider in the root layout.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // No token → no stream. `connected` is only ever set from the async
    // callbacks below (never synchronously here), so a sign-out is picked
    // up when the previous run's abort rejects into `.catch`.
    if (!token) return;

    const ctrl = new AbortController();

    function onEvent(type: string, payload: unknown): void {
      switch (type) {
        case "incident.created":
        case "incident.updated": {
          const incident = payload as Incident | null;
          if (incident && typeof incident.id === "number") {
            queryClient.setQueryData(queryKeys.incident(incident.id), incident);
          }
          void queryClient.invalidateQueries({ queryKey: queryKeys.incidents() });
          void queryClient.invalidateQueries({ queryKey: queryKeys.myReports() });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.dashboardStats(),
          });
          break;
        }
        case "risk.updated":
          void queryClient.invalidateQueries({ queryKey: queryKeys.riskMap() });
          break;
        case "shelter.updated":
          void queryClient.invalidateQueries({ queryKey: queryKeys.shelters() });
          break;
        case "alert.created":
        case "alert.updated":
          void queryClient.invalidateQueries({ queryKey: queryKeys.alerts() });
          break;
        case "rescue.updated":
          void queryClient.invalidateQueries({ queryKey: queryKeys.rescueOps() });
          void queryClient.invalidateQueries({ queryKey: queryKeys.incidents() });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.dashboardStats(),
          });
          break;
        case "responder.updated":
          void queryClient.invalidateQueries({
            queryKey: queryKeys.responders(),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.dashboardStats(),
          });
          break;
        case "simulator.updated":
          void queryClient.invalidateQueries({
            queryKey: queryKeys.simulatorState(),
          });
          break;
      }
    }

    void fetchEventSource(STREAM_URL, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}` },
      openWhenHidden: true,
      async onopen(res) {
        const ct = res.headers.get("content-type") ?? "";
        if (res.ok && ct.includes("text/event-stream")) {
          setConnected(true);
          // Catch anything missed while disconnected.
          invalidateRealtimeQueries(queryClient);
          return;
        }
        // Non-retryable (e.g. 401): throw so fetchEventSource gives up.
        throw new Error(`stream open failed: ${res.status}`);
      },
      onmessage(msg) {
        if (!msg.event || msg.event === "message" || !msg.data) return;
        let payload: unknown = null;
        try {
          payload = JSON.parse(msg.data);
        } catch {
          payload = msg.data;
        }
        onEvent(msg.event, payload);
      },
      onclose() {
        setConnected(false);
        // Returning here lets the library reconnect.
      },
      onerror(err) {
        setConnected(false);
        if (ctrl.signal.aborted) throw err; // unmounted — stop retrying
        return RETRY_MS;
      },
    }).catch(() => {
      // Aborted on unmount, or a thrown non-retryable open failure.
      setConnected(false);
    });

    return () => {
      ctrl.abort();
    };
  }, [token, queryClient]);

  return (
    <RealtimeContext.Provider value={{ connected }}>
      {children}
    </RealtimeContext.Provider>
  );
}
