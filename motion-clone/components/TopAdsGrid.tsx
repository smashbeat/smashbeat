import { Play, TrendingUp } from "lucide-react";
import type { Ad } from "@/lib/mock-data";
import { fmtCompact, fmtPct, fmtRoas, fmtUSD } from "@/lib/format";
import { Sparkline } from "./Sparkline";

type Props = {
  topAds: Array<{ ad: Ad; score: number }>;
  totalCount?: number;
};

export function TopAdsGrid({ topAds, totalCount }: Props) {
  if (topAds.length === 0) {
    return (
      <section className="card p-6 text-center">
        <h2 className="text-base font-semibold text-ink-900">
          Top creatives this period
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          No ad-level performance has come back from the last sync yet. Try
          syncing once at least one ad has spent in the selected window.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink-900">
            Top creatives this period
          </h2>
          <p className="text-xs text-ink-500">
            Ranked by ROAS. Click any ad to inspect creative attributes,
            audience splits, and frame-by-frame retention.
          </p>
        </div>
        {typeof totalCount === "number" && totalCount > topAds.length && (
          <button className="text-sm font-medium text-ink-700 hover:underline">
            See all {totalCount} →
          </button>
        )}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {topAds.map(({ ad, score }, i) => (
          <article
            key={ad.id}
            className="group flex overflow-hidden rounded-xl border border-ink-100 bg-white transition hover:shadow-pop"
          >
            <div className="relative w-32 shrink-0 bg-ink-50">
              <img
                src={ad.thumbnail}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/20">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-white/90 opacity-0 shadow-pop transition group-hover:opacity-100">
                  <Play className="h-4 w-4 fill-ink-900 text-ink-900" />
                </div>
              </div>
              <span className="absolute left-2 top-2 rounded-md bg-ink-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                #{i + 1}
              </span>
              {ad.duration && (
                <span className="absolute bottom-2 right-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {ad.duration}s
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col p-3">
              <div className="flex items-center gap-2 text-[11px] font-medium text-ink-500">
                <span>{ad.platform}</span>
                <span>·</span>
                <span>{ad.format}</span>
                {ad.launchedDays > 0 && (
                  <>
                    <span>·</span>
                    <span>{ad.launchedDays}d live</span>
                  </>
                )}
              </div>
              <h3 className="mt-0.5 truncate text-sm font-semibold text-ink-900">
                {ad.name}
              </h3>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-400">
                    Spend
                  </div>
                  <div className="font-semibold text-ink-900">
                    {fmtUSD(ad.spend)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-400">
                    ROAS
                  </div>
                  <div className="font-semibold text-ink-900">
                    {fmtRoas(score)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-400">
                    Hook rate
                  </div>
                  <div className="font-semibold text-ink-900">
                    {fmtPct(ad.thumbStop, 1)}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {ad.tags.slice(0, 2).map((t) => (
                    <span key={t} className="pill">
                      {t}
                    </span>
                  ))}
                  {ad.tags.length > 2 && (
                    <span className="pill">+{ad.tags.length - 2}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-success">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <Sparkline
                    seed={ad.id}
                    positive
                    values={ad.trend}
                    className="h-6 w-16"
                  />
                </div>
              </div>
              <div className="mt-2 text-[11px] text-ink-500">
                {fmtCompact(ad.impressions)} impressions · {fmtCompact(ad.clicks)}{" "}
                clicks
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
