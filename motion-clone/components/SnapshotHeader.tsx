import { Calendar, Filter, Link2, GitCompareArrows } from "lucide-react";
import type { Report } from "@/lib/report";
import { AccountSwitcher } from "./AccountSwitcher";
import { SyncButton } from "./SyncButton";

type Props = {
  report: Report;
  accounts: Array<{ id: string; name: string }>;
};

export function SnapshotHeader({ report, accounts }: Props) {
  const isDemo = report.source === "demo";
  const lastSynced = report.account.lastSyncedAt
    ? new Date(report.account.lastSyncedAt).toLocaleString()
    : "never";

  return (
    <div className="border-b border-ink-100 bg-white px-4 py-5 md:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <span>Snapshots</span>
            <span>/</span>
            <span>{report.account.name}</span>
            {isDemo && (
              <span className="ml-1 rounded-md bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                Sample
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 md:text-[28px]">
            Creative snapshot
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <span className="chip">
              <Calendar className="h-3.5 w-3.5" />
              {report.rangeLabel}
            </span>
            <span className="chip">
              <GitCompareArrows className="h-3.5 w-3.5" />
              {report.comparisonLabel}
            </span>
            {!isDemo && (
              <span className="chip">
                <Link2 className="h-3.5 w-3.5" />
                Last synced {lastSynced}
              </span>
            )}
            {report.account.currency && !isDemo && (
              <span className="chip">{report.account.currency}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isDemo && accounts.length > 1 && (
            <AccountSwitcher
              accounts={accounts}
              currentId={report.account.id}
            />
          )}
          <button className="btn">
            <Filter className="h-4 w-4" />
            Filters
          </button>
          {!isDemo && <SyncButton accountId={report.account.id} />}
          <div className="flex overflow-hidden rounded-lg border border-ink-200 bg-white text-sm">
            {["7d", "28d", "QTD"].map((v, i) => (
              <button
                key={v}
                className={
                  "px-3 py-1.5 " +
                  (i === 1
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-50")
                }
              >
                Last {v}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
