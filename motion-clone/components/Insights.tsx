import { AlertTriangle, Lightbulb, TrendingDown, Trophy } from "lucide-react";
import { fatigueSignals, winners } from "@/lib/mock-data";
import { fmtRoas, fmtUSD } from "@/lib/format";

export function Insights() {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="card p-4 md:p-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-success/10 text-success">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Standouts</h2>
            <p className="text-xs text-ink-500">
              Creatives carrying disproportionate return relative to spend.
            </p>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-ink-100">
          {winners.map(({ ad, roas }) => (
            <li key={ad.id} className="flex items-center gap-3 py-2.5">
              <img
                src={ad.thumbnail}
                alt=""
                className="h-12 w-9 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-900">
                  {ad.name}
                </div>
                <div className="text-[11px] text-ink-500">
                  {ad.platform} · {ad.format} · {fmtUSD(ad.spend)} spent
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-success">
                  {fmtRoas(roas)}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-ink-400">
                  ROAS
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4 md:p-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-warning/10 text-warning">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink-900">
              Fatigue watchlist
            </h2>
            <p className="text-xs text-ink-500">
              Daily ROAS trending down across the latest 4-day window.
            </p>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-ink-100">
          {fatigueSignals.length === 0 && (
            <li className="py-3 text-sm text-ink-500">
              Nothing trending down sharply right now.
            </li>
          )}
          {fatigueSignals.map(({ ad, drop }) => (
            <li key={ad.id} className="flex items-center gap-3 py-2.5">
              <img
                src={ad.thumbnail}
                alt=""
                className="h-12 w-9 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-900">
                  {ad.name}
                </div>
                <div className="text-[11px] text-ink-500">
                  {ad.launchedDays}d live · {fmtUSD(ad.spend)} spent
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-sm font-semibold text-danger">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {(drop * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] uppercase tracking-wide text-ink-400">
                  4d delta
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4 md:p-5 lg:col-span-2">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-100 text-brand-700">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink-900">
              What the snapshot suggests
            </h2>
            <p className="text-xs text-ink-500">
              Heuristics applied to your tagged creative library.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            {
              tag: "Founder POV",
              note:
                "Founder-led UGC drives the strongest hold rate of any tag in this account. Worth scaling into a 3-variant test next sprint.",
              metric: "+34% hold vs. account avg",
            },
            {
              tag: "Hook: statistic",
              note:
                "Statistic-led hooks are pulling above-average thumb-stop on TikTok, but conversion drops past second 12. Consider a tighter CTA.",
              metric: "47.6% thumb-stop",
            },
            {
              tag: "Discount call-out",
              note:
                "Static discount slates are eating share of spend with the lowest ROAS in the set. Cap budget or rotate within the week.",
              metric: "1.76x ROAS",
            },
          ].map((b) => (
            <div
              key={b.tag}
              className="rounded-lg border border-ink-100 bg-ink-50/60 p-3"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                Tag
              </div>
              <div className="text-sm font-semibold text-ink-900">{b.tag}</div>
              <p className="mt-1 text-xs text-ink-600">{b.note}</p>
              <div className="mt-2 inline-flex rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-ink-700 ring-1 ring-ink-100">
                {b.metric}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
