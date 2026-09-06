"use client";

import { useId } from "react";

interface LineChartProps {
  data: number[];
  color?: string;
  height?: number;
  showArea?: boolean;
  showDots?: boolean;
  max?: number;
  min?: number;
}

export function LineChart({ data, color = "#3d5da0", height = 60, showArea = true, showDots = false, max, min }: LineChartProps) {
  const gradientId = useId();
  const w = 100;
  const h = height;
  const maxVal = max ?? Math.max(...data) * 1.15;
  const minVal = min ?? Math.min(...data) * 0.85;
  const range = maxVal - minVal || 1;
  const step = w / (data.length - 1);

  const points = data.map((d, i) => ({
    x: i * step,
    y: h - ((d - minVal) / range) * (h - 8) - 4,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const areaD = `${pathD} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {showArea && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradientId})`} />
        </>
      )}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {showDots && points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} />)}
    </svg>
  );
}
