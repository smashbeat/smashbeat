"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import clsx from "clsx";
import { dailySeries } from "@/lib/mock-data";
import { dateLabel, fmtRoas, fmtUSD } from "@/lib/format";

type Metric = "spend" | "revenue" | "roas";

const metrics: { key: Metric; label: string }[] = [
  { key: "spend", label: "Spend" },
  { key: "revenue", label: "Revenue" },
  { key: "roas", label: "ROAS" },
];

export function PerformanceChart() {
  const [metric, setMetric] = useState<Metric>("revenue");

  const data = dailySeries.map((d) => ({
    ...d,
    label: dateLabel(d.date),
  }));

  const isRoas = metric === "roas";

  return (
    <div className="card p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink-900">
            Performance over time
          </h2>
          <p className="text-xs text-ink-500">
            Daily spend, revenue, and blended ROAS for the selected window.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-ink-200 bg-white text-sm">
          {metrics.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={clsx(
                "px-3 py-1.5",
                metric === m.key
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-50",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 h-[260px] w-full">
        <ResponsiveContainer>
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="g-rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4253E8" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#4253E8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="g-spend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B0D12" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#0B0D12" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="g-roas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1F9D55" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#1F9D55" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#8A93A3", fontSize: 11 }}
              axisLine={{ stroke: "#DDE1E8" }}
              tickLine={false}
              minTickGap={20}
            />
            <YAxis
              tick={{ fill: "#8A93A3", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={60}
              tickFormatter={(v) =>
                isRoas ? `${v.toFixed(1)}x` : fmtUSD(Number(v))
              }
            />
            <Tooltip
              cursor={{ stroke: "#B9C0CC", strokeDasharray: "3 3" }}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #DDE1E8",
                boxShadow: "0 8px 24px rgba(11,13,18,0.08)",
                fontSize: 12,
              }}
              formatter={(v: number, name) => {
                if (name === "ROAS") return [fmtRoas(v), name];
                return [fmtUSD(v), name];
              }}
            />
            {metric === "spend" && (
              <Area
                type="monotone"
                dataKey="spend"
                name="Spend"
                stroke="#0B0D12"
                strokeWidth={2}
                fill="url(#g-spend)"
              />
            )}
            {metric === "revenue" && (
              <>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#4253E8"
                  strokeWidth={2}
                  fill="url(#g-rev)"
                />
                <Line
                  type="monotone"
                  dataKey="spend"
                  name="Spend"
                  stroke="#8A93A3"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </>
            )}
            {metric === "roas" && (
              <Area
                type="monotone"
                dataKey="roas"
                name="ROAS"
                stroke="#1F9D55"
                strokeWidth={2}
                fill="url(#g-roas)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
