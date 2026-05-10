import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import clsx from "clsx";
import {
  fmtCompact,
  fmtDelta,
  fmtPct,
  fmtRoas,
  fmtUSD,
  fmtUSDPrecise,
} from "@/lib/format";
import { summary } from "@/lib/mock-data";
import { Sparkline } from "./Sparkline";

const formatValue = (
  value: number,
  fmt: "usd" | "usd2" | "num" | "pct" | "roas",
) => {
  switch (fmt) {
    case "usd":
      return fmtUSD(value);
    case "usd2":
      return fmtUSDPrecise(value);
    case "num":
      return fmtCompact(value);
    case "pct":
      return fmtPct(value);
    case "roas":
      return fmtRoas(value);
  }
};

export function SummaryGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {summary.map((m) => {
        const positive = m.inverted ? m.delta < 0 : m.delta > 0;
        return (
          <div key={m.key} className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-400">
              {m.label}
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <div className="text-2xl font-semibold tracking-tight text-ink-900">
                {formatValue(m.value, m.fmt)}
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <div
                className={clsx(
                  "flex items-center gap-1 text-xs font-medium",
                  positive ? "text-success" : "text-danger",
                )}
              >
                {positive ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {fmtDelta(m.delta)}
                <span className="ml-1 font-normal text-ink-400">
                  vs. prior
                </span>
              </div>
              <Sparkline
                seed={m.key}
                positive={positive}
                className="h-7 w-20"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
