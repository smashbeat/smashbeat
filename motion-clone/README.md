# Beatreel — Creative analytics snapshot

A Motion-inspired creative analytics dashboard for performance ad teams. Single-page snapshot view that surfaces spend, revenue, ROAS, top creatives, dimension breakdowns, and fatigue/winner insights.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript
- Tailwind CSS
- Recharts for trend chart
- lucide-react icons

All data is mocked in `lib/mock-data.ts`.

## Run

```bash
cd motion-clone
npm install
npm run dev
```

Open http://localhost:3000.

## Layout

- `app/page.tsx` — snapshot dashboard
- `components/` — Sidebar, TopBar, SnapshotHeader, SummaryGrid, PerformanceChart, TopAdsGrid, BreakdownTabs, Insights, Sparkline
- `lib/mock-data.ts` — accounts, ads, daily series, breakdowns, insights
- `lib/format.ts` — number / currency / pct / date formatting

## What it shows

- 8-card KPI grid (Spend, Revenue, ROAS, CPA, Purchases, CTR, CPM, Thumb-stop) with vs-prior deltas and sparklines
- Toggle area chart for spend / revenue / ROAS over a 28-day window
- Top creatives ranked by ROAS with thumbnails, tags, hook rate, and trend
- Tabbed breakdown table by Platform / Format / Creative tag with share-of-spend bars
- Insights panels: standouts, fatigue watchlist, tag-level commentary
