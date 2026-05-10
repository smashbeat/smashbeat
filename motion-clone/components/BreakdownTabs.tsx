"use client";

import { useState } from "react";
import clsx from "clsx";
import { byFormat, byPlatform, byTag } from "@/lib/mock-data";
import { fmtPct, fmtRoas, fmtUSD, fmtUSDPrecise } from "@/lib/format";

const tabs = [
  { key: "platform", label: "Platform", data: byPlatform },
  { key: "format", label: "Format", data: byFormat },
  { key: "tag", label: "Creative tag", data: byTag },
] as const;

export function BreakdownTabs() {
  const [active, setActive] = useState<(typeof tabs)[number]["key"]>("platform");
  const current = tabs.find((t) => t.key === active)!;

  return (
    <section className="card p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink-900">
            Breakdown by dimension
          </h2>
          <p className="text-xs text-ink-500">
            Slice spend, return, and efficiency across the dimensions that
            matter for creative strategy.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-ink-200 bg-white text-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={clsx(
                "px-3 py-1.5",
                active === t.key
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-50",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-ink-100">
        <table className="w-full border-collapse">
          <thead className="bg-ink-50">
            <tr>
              <th className="table-head">{current.label}</th>
              <th className="table-head">Share of spend</th>
              <th className="table-head text-right">Spend</th>
              <th className="table-head text-right">Revenue</th>
              <th className="table-head text-right">ROAS</th>
              <th className="table-head text-right">CPA</th>
            </tr>
          </thead>
          <tbody>
            {current.data.map((row) => (
              <tr
                key={row.key}
                className="border-t border-ink-100 hover:bg-ink-50/60"
              >
                <td className="table-cell">
                  <span className="font-medium text-ink-900">{row.label}</span>
                </td>
                <td className="table-cell w-1/3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-ink-900"
                        style={{ width: `${(row.share * 100).toFixed(1)}%` }}
                      />
                    </div>
                    <span className="w-12 text-xs text-ink-500">
                      {fmtPct(row.share, 1)}
                    </span>
                  </div>
                </td>
                <td className="table-cell text-right tabular-nums">
                  {fmtUSD(row.spend)}
                </td>
                <td className="table-cell text-right tabular-nums">
                  {fmtUSD(row.revenue)}
                </td>
                <td className="table-cell text-right tabular-nums font-semibold">
                  {fmtRoas(row.roas)}
                </td>
                <td className="table-cell text-right tabular-nums">
                  {fmtUSDPrecise(row.cpa)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
