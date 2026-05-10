export type Platform = "Meta" | "TikTok" | "YouTube" | "Snap";

export type AdFormat = "Video" | "Image" | "Carousel" | "UGC" | "Static";

export type CreativeTag =
  | "Hook: question"
  | "Hook: statistic"
  | "Hook: pattern interrupt"
  | "Voiceover"
  | "On-screen text"
  | "Founder POV"
  | "Customer testimonial"
  | "Product demo"
  | "Lifestyle"
  | "Discount call-out"
  | "Before / after"
  | "Animated";

export type Ad = {
  id: string;
  name: string;
  platform: Platform;
  format: AdFormat;
  thumbnail: string;
  duration?: number;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  thumbStop: number;
  holdRate: number;
  tags: CreativeTag[];
  launchedDays: number;
  trend: number[];
};

const palette = [
  ["#FFD9A8", "#F97D58"],
  ["#C7E3FF", "#3F7AF7"],
  ["#FFD2E6", "#E8458B"],
  ["#D4F2D2", "#2E9B61"],
  ["#E5DCFF", "#6F4DDB"],
  ["#FFE9B0", "#D08C18"],
  ["#CFEFEC", "#1F8C84"],
  ["#FBD0D0", "#C7344B"],
  ["#D9DDFF", "#3140CC"],
  ["#F4E1FF", "#8C3FE0"],
];

export const thumbFor = (i: number, label: string) => {
  const [a, b] = palette[i % palette.length];
  const initials = label
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 320'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/>
    </linearGradient></defs>
    <rect width='240' height='320' fill='url(#g)'/>
    <circle cx='120' cy='128' r='44' fill='rgba(255,255,255,0.85)'/>
    <text x='120' y='140' text-anchor='middle' font-family='Inter, system-ui, sans-serif'
      font-size='34' font-weight='700' fill='${b}'>${initials}</text>
    <rect x='24' y='244' width='192' height='12' rx='6' fill='rgba(255,255,255,0.7)'/>
    <rect x='24' y='264' width='128' height='10' rx='5' fill='rgba(255,255,255,0.55)'/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const seedTrend = (base: number, vol: number, len = 14) => {
  let v = base;
  return Array.from({ length: len }, (_, i) => {
    const wave = Math.sin((i / len) * Math.PI * 2) * vol * 0.4;
    const drift = (i - len / 2) * vol * 0.02;
    const noise = (Math.sin(i * 7.13 + base) + Math.cos(i * 3.7)) * vol * 0.25;
    v = Math.max(0.1, base + wave + drift + noise);
    return Number(v.toFixed(2));
  });
};

const adSeeds: Array<Omit<Ad, "thumbnail" | "trend"> & { trendBase: number }> = [
  {
    id: "ad_01",
    name: "Founder Story — 30s",
    platform: "Meta",
    format: "UGC",
    duration: 30,
    spend: 48210,
    impressions: 3120000,
    clicks: 41600,
    purchases: 2210,
    revenue: 184300,
    thumbStop: 0.412,
    holdRate: 0.318,
    tags: ["Founder POV", "Voiceover", "On-screen text"],
    launchedDays: 18,
    trendBase: 3.6,
  },
  {
    id: "ad_02",
    name: "Did You Know? Hook",
    platform: "TikTok",
    format: "Video",
    duration: 22,
    spend: 31900,
    impressions: 2510000,
    clicks: 38200,
    purchases: 1480,
    revenue: 122600,
    thumbStop: 0.476,
    holdRate: 0.291,
    tags: ["Hook: statistic", "On-screen text", "Animated"],
    launchedDays: 11,
    trendBase: 3.4,
  },
  {
    id: "ad_03",
    name: "Before / After Transformation",
    platform: "Meta",
    format: "Video",
    duration: 18,
    spend: 27450,
    impressions: 2010000,
    clicks: 27800,
    purchases: 1320,
    revenue: 110200,
    thumbStop: 0.38,
    holdRate: 0.27,
    tags: ["Before / after", "Customer testimonial"],
    launchedDays: 24,
    trendBase: 3.1,
  },
  {
    id: "ad_04",
    name: "Pattern Interrupt — Sketch",
    platform: "TikTok",
    format: "UGC",
    duration: 26,
    spend: 22300,
    impressions: 1740000,
    clicks: 29900,
    purchases: 980,
    revenue: 78400,
    thumbStop: 0.44,
    holdRate: 0.302,
    tags: ["Hook: pattern interrupt", "Voiceover"],
    launchedDays: 9,
    trendBase: 2.9,
  },
  {
    id: "ad_05",
    name: "Lifestyle Carousel",
    platform: "Meta",
    format: "Carousel",
    spend: 18950,
    impressions: 1650000,
    clicks: 19800,
    purchases: 690,
    revenue: 56100,
    thumbStop: 0.21,
    holdRate: 0.18,
    tags: ["Lifestyle", "Discount call-out"],
    launchedDays: 32,
    trendBase: 2.4,
  },
  {
    id: "ad_06",
    name: "Demo — How It Works",
    platform: "YouTube",
    format: "Video",
    duration: 45,
    spend: 16400,
    impressions: 1220000,
    clicks: 14600,
    purchases: 540,
    revenue: 47900,
    thumbStop: 0.34,
    holdRate: 0.41,
    tags: ["Product demo", "Voiceover"],
    launchedDays: 41,
    trendBase: 2.6,
  },
  {
    id: "ad_07",
    name: "Customer Voice — Maya",
    platform: "Meta",
    format: "UGC",
    duration: 24,
    spend: 14800,
    impressions: 1080000,
    clicks: 15300,
    purchases: 612,
    revenue: 51200,
    thumbStop: 0.39,
    holdRate: 0.29,
    tags: ["Customer testimonial", "Voiceover"],
    launchedDays: 6,
    trendBase: 3.2,
  },
  {
    id: "ad_08",
    name: "Discount Slate — Spring",
    platform: "Meta",
    format: "Static",
    spend: 12100,
    impressions: 980000,
    clicks: 9100,
    purchases: 280,
    revenue: 21300,
    thumbStop: 0.16,
    holdRate: 0.12,
    tags: ["Discount call-out", "On-screen text"],
    launchedDays: 50,
    trendBase: 1.8,
  },
  {
    id: "ad_09",
    name: "Snap Story — Quick Tips",
    platform: "Snap",
    format: "Video",
    duration: 12,
    spend: 8400,
    impressions: 720000,
    clicks: 8800,
    purchases: 210,
    revenue: 16400,
    thumbStop: 0.36,
    holdRate: 0.22,
    tags: ["On-screen text", "Animated"],
    launchedDays: 14,
    trendBase: 2.0,
  },
  {
    id: "ad_10",
    name: "Founder Voice — 60s",
    platform: "YouTube",
    format: "Video",
    duration: 60,
    spend: 6900,
    impressions: 540000,
    clicks: 6800,
    purchases: 188,
    revenue: 15800,
    thumbStop: 0.28,
    holdRate: 0.46,
    tags: ["Founder POV", "Voiceover"],
    launchedDays: 21,
    trendBase: 2.3,
  },
];

export const ads: Ad[] = adSeeds.map((a, i) => ({
  ...a,
  thumbnail: thumbFor(i, a.name),
  trend: seedTrend(a.trendBase, 0.6),
}));

export type DailyPoint = {
  date: string;
  spend: number;
  revenue: number;
  purchases: number;
  cpa: number;
  roas: number;
};

const start = new Date("2026-04-12");
export const dailySeries: DailyPoint[] = Array.from({ length: 28 }, (_, i) => {
  const d = new Date(start);
  d.setDate(d.getDate() + i);
  const wave = Math.sin((i / 28) * Math.PI * 2);
  const noise = Math.sin(i * 1.7) * 0.4 + Math.cos(i * 0.9) * 0.3;
  const spend = 7000 + wave * 1400 + noise * 900 + i * 60;
  const roas = 2.6 + wave * 0.4 + noise * 0.18;
  const revenue = spend * roas;
  const purchases = revenue / 86;
  const cpa = spend / purchases;
  return {
    date: d.toISOString().slice(0, 10),
    spend: Math.round(spend),
    revenue: Math.round(revenue),
    purchases: Math.round(purchases),
    cpa: Number(cpa.toFixed(2)),
    roas: Number(roas.toFixed(2)),
  };
});

const sum = <T,>(arr: T[], pick: (t: T) => number) =>
  arr.reduce((s, x) => s + pick(x), 0);

export const account = {
  brand: "Northwind Coffee Co.",
  workspace: "Creative Strategy",
  reportName: "Q2 Creative Snapshot",
  rangeLabel: "Apr 12 – May 9, 2026",
  comparisonLabel: "vs. Mar 15 – Apr 11",
  preparedBy: "Jordan Reyes, Growth Lead",
};

export const totals = {
  spend: sum(dailySeries, (d) => d.spend),
  revenue: sum(dailySeries, (d) => d.revenue),
  purchases: sum(dailySeries, (d) => d.purchases),
  impressions: sum(ads, (a) => a.impressions),
  clicks: sum(ads, (a) => a.clicks),
};

export const summary = [
  {
    key: "spend",
    label: "Spend",
    value: totals.spend,
    delta: 0.142,
    fmt: "usd" as const,
  },
  {
    key: "revenue",
    label: "Revenue",
    value: totals.revenue,
    delta: 0.218,
    fmt: "usd" as const,
  },
  {
    key: "roas",
    label: "Blended ROAS",
    value: totals.revenue / totals.spend,
    delta: 0.067,
    fmt: "roas" as const,
  },
  {
    key: "cpa",
    label: "CPA",
    value: totals.spend / totals.purchases,
    delta: -0.058,
    fmt: "usd2" as const,
    inverted: true,
  },
  {
    key: "purchases",
    label: "Purchases",
    value: totals.purchases,
    delta: 0.193,
    fmt: "num" as const,
  },
  {
    key: "ctr",
    label: "CTR",
    value: totals.clicks / totals.impressions,
    delta: 0.034,
    fmt: "pct" as const,
  },
  {
    key: "cpm",
    label: "CPM",
    value: (totals.spend / totals.impressions) * 1000,
    delta: -0.022,
    fmt: "usd2" as const,
    inverted: true,
  },
  {
    key: "thumbstop",
    label: "Avg. Thumb-stop",
    value:
      sum(ads, (a) => a.thumbStop * a.impressions) /
      sum(ads, (a) => a.impressions),
    delta: 0.041,
    fmt: "pct" as const,
  },
];

export type Breakdown = {
  key: string;
  label: string;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  share: number;
};

const groupBy = <T,>(arr: T[], pick: (t: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of arr) {
    const k = pick(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return m;
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
        roas: revenue / spend,
        cpa: spend / Math.max(1, purchases),
        share: spend / total,
      };
    })
    .sort((a, b) => b.spend - a.spend);

export const byPlatform = buildBreakdown(
  groupBy(ads, (a) => a.platform),
  sum(ads, (a) => a.spend),
);

export const byFormat = buildBreakdown(
  groupBy(ads, (a) => a.format),
  sum(ads, (a) => a.spend),
);

const tagAds = new Map<string, Ad[]>();
for (const a of ads) {
  for (const t of a.tags) {
    if (!tagAds.has(t)) tagAds.set(t, []);
    tagAds.get(t)!.push(a);
  }
}
export const byTag = buildBreakdown(
  tagAds,
  sum(ads, (a) => a.spend),
);

export const fatigueSignals = ads
  .map((a) => {
    const trend = a.trend;
    const first = trend.slice(0, 4).reduce((s, v) => s + v, 0) / 4;
    const last = trend.slice(-4).reduce((s, v) => s + v, 0) / 4;
    const drop = (last - first) / first;
    return { ad: a, drop };
  })
  .filter((s) => s.drop < -0.08)
  .sort((a, b) => a.drop - b.drop)
  .slice(0, 4);

export const winners = ads
  .map((a) => ({ ad: a, roas: a.revenue / a.spend }))
  .sort((a, b) => b.roas - a.roas)
  .slice(0, 4);
