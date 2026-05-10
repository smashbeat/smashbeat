import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { SnapshotHeader } from "@/components/SnapshotHeader";
import { SummaryGrid } from "@/components/SummaryGrid";
import { PerformanceChart } from "@/components/PerformanceChart";
import { TopAdsGrid } from "@/components/TopAdsGrid";
import { BreakdownTabs } from "@/components/BreakdownTabs";
import { Insights } from "@/components/Insights";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { loadLiveReport } from "@/lib/report";

export const dynamic = "force-dynamic";

async function safeListAccounts() {
  try {
    return await prisma.adAccount.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } catch {
    return [];
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: { accountId?: string };
}) {
  const accounts = await safeListAccounts();
  const metaConfigured = !!(
    process.env.META_APP_ID &&
    process.env.META_APP_SECRET &&
    process.env.TOKEN_ENCRYPTION_KEY
  );

  if (accounts.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <EmptyState metaConfigured={metaConfigured} />
      </div>
    );
  }

  const accountId = searchParams.accountId ?? accounts[0].id;
  const report = await loadLiveReport(accountId);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-ink-50 text-ink-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {report ? (
            <>
              <SnapshotHeader report={report} accounts={accounts} />
              <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-5 md:px-8 md:py-6">
                <SummaryGrid stats={report.summary} />
                <PerformanceChart daily={report.daily} />
                <TopAdsGrid topAds={report.topAds} />
                <BreakdownTabs
                  byPlatform={report.byPlatform}
                  byFormat={report.byFormat}
                  byTag={report.byTag}
                />
                <Insights
                  winners={report.winners}
                  fatigue={report.fatigue}
                  hasTags={report.byTag.length > 0}
                />
                <footer className="mt-2 border-t border-ink-100 pt-4 text-xs text-ink-400">
                  Live data from Meta Marketing API. Encrypted at rest.
                </footer>
              </div>
            </>
          ) : (
            <NoInsights accountId={accountId} />
          )}
        </main>
      </div>
    </div>
  );
}

function NoInsights({ accountId }: { accountId: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 p-12 text-center">
      <h2 className="text-xl font-semibold text-ink-900">
        This account has no synced data yet
      </h2>
      <p className="text-sm text-ink-500">
        Run a sync to pull the last 28 days of insights from Meta. Synced data
        is cached locally so the dashboard is fast.
      </p>
      <form action="/api/sync" method="post">
        <input type="hidden" name="accountId" value={accountId} />
        <button className="btn-primary" type="submit">
          Run first sync
        </button>
      </form>
    </div>
  );
}
