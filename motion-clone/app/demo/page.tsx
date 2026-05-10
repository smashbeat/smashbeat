import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { SnapshotHeader } from "@/components/SnapshotHeader";
import { SummaryGrid } from "@/components/SummaryGrid";
import { PerformanceChart } from "@/components/PerformanceChart";
import { TopAdsGrid } from "@/components/TopAdsGrid";
import { BreakdownTabs } from "@/components/BreakdownTabs";
import { Insights } from "@/components/Insights";
import { loadDemoReport } from "@/lib/report";

export default function DemoPage() {
  const report = loadDemoReport();
  return (
    <div className="flex h-screen w-full overflow-hidden bg-ink-50 text-ink-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <SnapshotHeader
            report={report}
            accounts={[{ id: report.account.id, name: report.account.name }]}
          />
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
              Sample report. Replace with live data by connecting a Meta ad
              account on the home page.
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
