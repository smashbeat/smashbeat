import { Calendar, Filter, Link2, GitCompareArrows } from "lucide-react";
import { account } from "@/lib/mock-data";

export function SnapshotHeader() {
  return (
    <div className="border-b border-ink-100 bg-white px-4 py-5 md:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <span>Snapshots</span>
            <span>/</span>
            <span>{account.brand}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 md:text-[28px]">
            {account.reportName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <span className="chip">
              <Calendar className="h-3.5 w-3.5" />
              {account.rangeLabel}
            </span>
            <span className="chip">
              <GitCompareArrows className="h-3.5 w-3.5" />
              {account.comparisonLabel}
            </span>
            <span className="chip">
              <Link2 className="h-3.5 w-3.5" />
              Shared snapshot
            </span>
            <span>·</span>
            <span>Prepared by {account.preparedBy}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn">
            <Filter className="h-4 w-4" />
            Filters
            <span className="ml-1 rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              3
            </span>
          </button>
          <div className="flex overflow-hidden rounded-lg border border-ink-200 bg-white text-sm">
            {["Last 7d", "Last 28d", "QTD", "Custom"].map((v, i) => (
              <button
                key={v}
                className={
                  "px-3 py-1.5 " +
                  (i === 1
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-50")
                }
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
