"use client";

import { useMemo } from "react";

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export function Sparkline({
  seed,
  positive = true,
  className = "h-8 w-24",
  values,
}: {
  seed: string;
  positive?: boolean;
  className?: string;
  values?: number[];
}) {
  const points = useMemo(() => {
    if (values && values.length) return values;
    const n = 24;
    const h = hash(seed);
    return Array.from({ length: n }, (_, i) => {
      const a = Math.sin(i * 0.45 + (h % 13)) * 0.6;
      const b = Math.cos(i * 0.21 + (h % 7)) * 0.3;
      const drift = (i / n) * (positive ? 0.7 : -0.7);
      return 1 + a + b + drift;
    });
  }, [seed, positive, values]);

  const width = 100;
  const height = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const norm = (v: number) =>
    height - 2 - ((v - min) / Math.max(0.0001, max - min)) * (height - 6);
  const step = width / (points.length - 1);
  const d = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${norm(v).toFixed(2)}`)
    .join(" ");
  const fillD = `${d} L${width},${height} L0,${height} Z`;
  const stroke = positive ? "#1F9D55" : "#DC2626";
  const fill = positive ? "rgba(31,157,85,0.12)" : "rgba(220,38,38,0.10)";

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={fillD} fill={fill} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}
