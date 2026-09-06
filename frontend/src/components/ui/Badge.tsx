const TONES = {
  neutral: "bg-slate-700/50 text-slate-200 ring-slate-600",
  low: "bg-emerald-900/40 text-emerald-300 ring-emerald-700",
  moderate: "bg-amber-900/40 text-amber-300 ring-amber-700",
  high: "bg-orange-900/40 text-orange-300 ring-orange-700",
  critical: "bg-red-900/40 text-red-300 ring-red-700",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
