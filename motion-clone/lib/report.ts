import { prisma } from "@/lib/db";
import { ads as mockAds, dailySeries as mockSeries } from "@/lib/mock-data";
import type { Ad, DailyPoint } from "@/lib/mock-data";

export type ReportAccount = {
  id: string;
  name: string;
  currency: string;
  timezone?: string | null;
  lastSyncedAt?: Date | null;
};

export type SummaryStat = {
  key: string;
  label: string;
  value: number;
  delta: number;
  fmt: "usd" | "usd2" | "num" | "pct" | "roas";
  inverted?: boolean;
};

export type Breakdown = {
  key: string;
  label: string;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  share: number;
};

export type Report = {
  source: "live" | "demo";
  account: ReportAccount;
  rangeLabel: string;
  comparisonLabel: string;
  summary: SummaryStat[];
  daily: DailyPoint[];
  topAds: Array<{
    ad: Ad;
    score: number;
  }>;
  byPlatform: Breakdown[];
  byFormat: Breakdown[];
  byTag: Breakdown[];
  winners: Array<{ ad: Ad; roas: number }>;
  fatigue: Array<{ ad: Ad; drop: number }>;
};

const sum = <T,>(arr: T[], pick: (t: T) => number) =>
  arr.reduce((s, x) => s + pick(x), 0);

const safe = (n: number, fb = 0) => (Number.isFinite(n) ? n : fb);

const fmtRange = (since: Date, until: Date) => {
  const f = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${f(since)} – ${f(until)}, ${until.getFullYear()}`;
};

const buildBreakdown = (
  groups: Map<string, Ad[]>,
  total: number,
): Breakdown[] =>
  Array.from(groups.entries())
    .map(([label, items]) => {
      const spend = sum(items, (i) => i.spend);
      const revenue = sum(items, (i) => i.revenue);
      const purchases = sum(items, (i) => i.purchases);
      return {
        key: label,
        label,
        spend,
        revenue,
        roas: safe(revenue / spend),
        cpa: safe(spend / Math.max(1, purchases)),
        share: safe(spend / total),
      };
    })
    .sort((a, b) => b.spend - a.spend);

const groupBy = <T,>(arr: T[], pick: (t: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of arr) {
    const k = pick(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return m;
};

export async function loadLiveReport(
  accountId: string,
  days = 28,
): Promise<Report | null> {
  const account = await prisma.adAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) return null;

  const until = new Date();
  until.setHours(0, 0, 0, 0);
  const since = new Date(until);
  since.setDate(since.getDate() - days);
  const compStart = new Date(since);
  compStart.setDate(compStart.getDate() - days);

  const [insights, prevInsights, dbAds] = await Promise.all([
    prisma.adInsight.findMany({
      where: {
        accountId,
        date: { gte: since, lte: until },
      },
    }),
    prisma.adInsight.findMany({
      where: {
        accountId,
        date: { gte: compStart, lt: since },
      },
    }),
    prisma.ad.findMany({ where: { accountId } }),
  ]);

  if (insights.length === 0) {
    return null;
  }

  const adById = new Map(dbAds.map((a) => [a.id, a]));

  const totals = {
    spend: sum(insights, (i) => i.spend),
    revenue: sum(insights, (i) => i.revenue),
    purchases: sum(insights, (i) => i.purchases),
    impressions: sum(insights, (i) => i.impressions),
    clicks: sum(insights, (i) => i.clicks),
    video3s: sum(insights, (i) => i.video3s),
  };
  const prev = {
    spend: sum(prevInsights, (i) => i.spend),
    revenue: sum(prevInsights, (i) => i.revenue),
    purchases: sum(prevInsights, (i) => i.purchases),
    impressions: sum(prevInsights, (i) => i.impressions),
    clicks: sum(prevInsights, (i) => i.clicks),
    video3s: sum(prevInsights, (i) => i.video3s),
  };

  const delta = (a: number, b: number) => safe((a - b) / Math.max(1e-9, b), 0);

  const dailyMap = new Map<string, DailyPoint>();
  for (const i of insights) {
    const k = i.date.toISOString().slice(0, 10);
    const cur = dailyMap.get(k) ?? {
      date: k,
      spend: 0,
      revenue: 0,
      purchases: 0,
      cpa: 0,
      roas: 0,
    };
    cur.spend += i.spend;
    cur.revenue += i.revenue;
    cur.purchases += i.purchases;
    dailyMap.set(k, cur);
  }
  const daily: DailyPoint[] = Array.from(dailyMap.values())
    .map((d) => ({
      ...d,
      spend: Math.round(d.spend),
      revenue: Math.round(d.revenue),
      purchases: Math.round(d.purchases),
      cpa: safe(d.spend / Math.max(1, d.purchases), 0),
      roas: safe(d.revenue / Math.max(1e-9, d.spend), 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const perAd = new Map<
    string,
    {
      spend: number;
      revenue: number;
      purchases: number;
      impressions: number;
      clicks: number;
      video3s: number;
      thruplays: number;
      trend: number[];
    }
  >();
  for (const i of insights) {
    const r = perAd.get(i.adId) ?? {
      spend: 0,
      revenue: 0,
      purchases: 0,
      impressions: 0,
      clicks: 0,
      video3s: 0,
      thruplays: 0,
      trend: [],
    };
    r.spend += i.spend;
    r.revenue += i.revenue;
    r.purchases += i.purchases;
    r.impressions += i.impressions;
    r.clicks += i.clicks;
    r.video3s += i.video3s;
    r.thruplays += i.thruplays;
    perAd.set(i.adId, r);
  }
  const trendByAdAndDay = new Map<string, Map<string, number>>();
  for (const i of insights) {
    const key = i.adId;
    const day = i.date.toISOString().slice(0, 10);
    const m = trendByAdAndDay.get(key) ?? new Map<string, number>();
    m.set(
      day,
      safe(i.revenue / Math.max(1e-9, i.spend), 0) +
        (m.get(day) ?? 0),
    );
    trendByAdAndDay.set(key, m);
  }
  const dayKeys = daily.map((d) => d.date);
  for (const [adId, dayMap] of trendByAdAndDay) {
    const trend = dayKeys.map((k) => dayMap.get(k) ?? 0);
    const r = perAd.get(adId);
    if (r) r.trend = trend;
  }

  const adsForReport: Ad[] = Array.from(perAd.entries()).map(([id, m]) => {
    const meta = adById.get(id);
    return {
      id,
      name: meta?.name ?? `Ad ${id}`,
      platform: "Meta",
      format:
        (meta?.format as Ad["format"]) ??
        (meta?.videoId ? "Video" : "Image"),
      thumbnail: meta?.thumbnailUrl ?? thumbFallback(meta?.name ?? id),
      duration: undefined,
      spend: m.spend,
      impressions: m.impressions,
      clicks: m.clicks,
      purchases: m.purchases,
      revenue: m.revenue,
      thumbStop: safe(m.video3s / Math.max(1, m.impressions), 0),
      holdRate: safe(m.thruplays / Math.max(1, m.video3s), 0),
      tags: [],
      launchedDays: meta?.launchedAt
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - meta.launchedAt.getTime()) / (1000 * 60 * 60 * 24),
            ),
          )
        : 0,
      trend: m.trend.length ? m.trend : [0],
    };
  });

  const totalSpend = sum(adsForReport, (a) => a.spend);

  const summary: SummaryStat[] = [
    {
      key: "spend",
      label: "Spend",
      value: totals.spend,
      delta: delta(totals.spend, prev.spend),
      fmt: "usd",
    },
    {
      key: "revenue",
      label: "Revenue",
      value: totals.revenue,
      delta: delta(totals.revenue, prev.revenue),
      fmt: "usd",
    },
    {
      key: "roas",
      label: "Blended ROAS",
      value: safe(totals.revenue / totals.spend, 0),
      delta: delta(
        safe(totals.revenue / totals.spend, 0),
        safe(prev.revenue / prev.spend, 0),
      ),
      fmt: "roas",
    },
    {
      key: "cpa",
      label: "CPA",
      value: safe(totals.spend / Math.max(1, totals.purchases), 0),
      delta: delta(
        safe(totals.spend / Math.max(1, totals.purchases), 0),
        safe(prev.spend / Math.max(1, prev.purchases), 0),
      ),
      fmt: "usd2",
      inverted: true,
    },
    {
      key: "purchases",
      label: "Purchases",
      value: totals.purchases,
      delta: delta(totals.purchases, prev.purchases),
      fmt: "num",
    },
    {
      key: "ctr",
      label: "CTR",
      value: safe(totals.clicks / Math.max(1, totals.impressions), 0),
      delta: delta(
        safe(totals.clicks / Math.max(1, totals.impressions), 0),
        safe(prev.clicks / Math.max(1, prev.impressions), 0),
      ),
      fmt: "pct",
    },
    {
      key: "cpm",
      label: "CPM",
      value: safe((totals.spend / Math.max(1, totals.impressions)) * 1000, 0),
      delta: delta(
        safe((totals.spend / Math.max(1, totals.impressions)) * 1000, 0),
        safe((prev.spend / Math.max(1, prev.impressions)) * 1000, 0),
      ),
      fmt: "usd2",
      inverted: true,
    },
    {
      key: "thumbstop",
      label: "Avg. Thumb-stop",
      value: safe(totals.video3s / Math.max(1, totals.impressions), 0),
      delta: delta(
        safe(totals.video3s / Math.max(1, totals.impressions), 0),
        safe(prev.video3s / Math.max(1, prev.impressions), 0),
      ),
      fmt: "pct",
    },
  ];

  const winners = [...adsForReport]
    .map((a) => ({ ad: a, roas: safe(a.revenue / Math.max(1e-9, a.spend), 0) }))
    .filter((w) => w.ad.spend > 0)
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 4);

  const topAds = [...adsForReport]
    .map((a) => ({ ad: a, score: safe(a.revenue / Math.max(1e-9, a.spend), 0) }))
    .filter((w) => w.ad.spend > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const fatigue = adsForReport
    .map((a) => {
      const t = a.trend;
      if (t.length < 8) return null;
      const first = t.slice(0, 4).reduce((s, v) => s + v, 0) / 4;
      const last = t.slice(-4).reduce((s, v) => s + v, 0) / 4;
      if (first <= 0) return null;
      const drop = (last - first) / first;
      return { ad: a, drop };
    })
    .filter((x): x is { ad: Ad; drop: number } => !!x && x.drop < -0.08)
    .sort((a, b) => a.drop - b.drop)
    .slice(0, 4);

  const byFormat = buildBreakdown(
    groupBy(adsForReport, (a) => a.format ?? "Unknown"),
    totalSpend,
  );
  const byPlatform = buildBreakdown(
    new Map([["Meta", adsForReport]]),
    totalSpend,
  );
  const byTag: Breakdown[] = [];

  return {
    source: "live",
    account: {
      id: account.id,
      name: account.name,
      currency: account.currency,
      timezone: account.timezone,
      lastSyncedAt: account.lastSyncedAt,
    },
    rangeLabel: fmtRange(since, until),
    comparisonLabel: `vs. ${fmtRange(compStart, since)}`,
    summary,
    daily,
    topAds,
    byPlatform,
    byFormat,
    byTag,
    winners,
    fatigue,
  };
}

export function loadDemoReport(): Report {
  const totalSpend = sum(mockAds, (a) => a.spend);
  const total = {
    spend: sum(mockSeries, (d) => d.spend),
    revenue: sum(mockSeries, (d) => d.revenue),
    purchases: sum(mockSeries, (d) => d.purchases),
    impressions: sum(mockAds, (a) => a.impressions),
    clicks: sum(mockAds, (a) => a.clicks),
  };

  const summary: SummaryStat[] = [
    { key: "spend", label: "Spend", value: total.spend, delta: 0.142, fmt: "usd" },
    {
      key: "revenue",
      label: "Revenue",
      value: total.revenue,
      delta: 0.218,
      fmt: "usd",
    },
    {
      key: "roas",
      label: "Blended ROAS",
      value: total.revenue / total.spend,
      delta: 0.067,
      fmt: "roas",
    },
    {
      key: "cpa",
      label: "CPA",
      value: total.spend / total.purchases,
      delta: -0.058,
      fmt: "usd2",
      inverted: true,
    },
    {
      key: "purchases",
      label: "Purchases",
      value: total.purchases,
      delta: 0.193,
      fmt: "num",
    },
    {
      key: "ctr",
      label: "CTR",
      value: total.clicks / total.impressions,
      delta: 0.034,
      fmt: "pct",
    },
    {
      key: "cpm",
      label: "CPM",
      value: (total.spend / total.impressions) * 1000,
      delta: -0.022,
      fmt: "usd2",
      inverted: true,
    },
    {
      key: "thumbstop",
      label: "Avg. Thumb-stop",
      value:
        sum(mockAds, (a) => a.thumbStop * a.impressions) /
        sum(mockAds, (a) => a.impressions),
      delta: 0.041,
      fmt: "pct",
    },
  ];

  const topAds = [...mockAds]
    .map((a) => ({ ad: a, score: a.revenue / a.spend }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const winners = [...mockAds]
    .map((a) => ({ ad: a, roas: a.revenue / a.spend }))
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 4);

  const fatigue = mockAds
    .map((a) => {
      const first = a.trend.slice(0, 4).reduce((s, v) => s + v, 0) / 4;
      const last = a.trend.slice(-4).reduce((s, v) => s + v, 0) / 4;
      return { ad: a, drop: (last - first) / first };
    })
    .filter((s) => s.drop < -0.08)
    .sort((a, b) => a.drop - b.drop)
    .slice(0, 4);

  return {
    source: "demo",
    account: {
      id: "demo",
      name: "Northwind Coffee Co. (sample)",
      currency: "USD",
      timezone: "America/New_York",
    },
    rangeLabel: "Apr 12 – May 9, 2026",
    comparisonLabel: "vs. Mar 15 – Apr 11",
    summary,
    daily: mockSeries,
    topAds,
    byPlatform: buildBreakdown(
      groupBy(mockAds, (a) => a.platform),
      totalSpend,
    ),
    byFormat: buildBreakdown(
      groupBy(mockAds, (a) => a.format),
      totalSpend,
    ),
    byTag: buildTagBreakdown(mockAds, totalSpend),
    winners,
    fatigue,
  };
}

function buildTagBreakdown(adsList: Ad[], total: number): Breakdown[] {
  const groups = new Map<string, Ad[]>();
  for (const a of adsList) {
    for (const t of a.tags) {
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t)!.push(a);
    }
  }
  return buildBreakdown(groups, total);
}

function thumbFallback(label: string): string {
  const initials = label
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 320'>
    <rect width='240' height='320' fill='#1F2980'/>
    <circle cx='120' cy='128' r='44' fill='rgba(255,255,255,0.9)'/>
    <text x='120' y='140' text-anchor='middle' font-family='Inter, system-ui, sans-serif'
      font-size='34' font-weight='700' fill='#1F2980'>${initials || "AD"}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
