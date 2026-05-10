# Beatreel — creative analytics for performance ads

A working snapshot dashboard for Meta ad creatives. OAuth login, daily sync from the Meta Marketing API, encrypted token storage, breakdown views by format and creative tag.

Inspired by Motion (motionapp.com). Meta-only for the MVP — that's where most of Motion's value sits anyway.

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS, Recharts, lucide-react
- Prisma + SQLite (swap to Postgres for production)
- AES-256-GCM at-rest encryption for access tokens
- Meta Marketing API `v21.0` (`/me/adaccounts`, `/act_*/ads`, `/act_*/insights`, `/{video_id}`)

## Quick start

```bash
cd motion-clone
cp .env.example .env.local
npm install
npm run db:push         # create the local SQLite schema
npm run dev             # http://localhost:3000
```

Without credentials the home page shows the connect CTA and `/demo` renders a sample report.

## Connecting Meta

1. Create an app at https://developers.facebook.com/apps. Add **Marketing API** and **Facebook Login** products.
2. Add `http://localhost:3000/api/auth/meta/callback` as an OAuth redirect URI.
3. Fill these into `.env.local`:

   ```env
   META_APP_ID=...
   META_APP_SECRET=...
   META_REDIRECT_URI=http://localhost:3000/api/auth/meta/callback
   TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```

4. Restart `npm run dev`, click **Connect Meta**, authorise on the OAuth dialog. Callback will pull your visible ad accounts and persist long-lived tokens (encrypted).
5. Click **Sync** in the dashboard header (or `POST /api/sync?accountId=act_xxx&days=28`).

The first sync upserts ads + 28 days of daily insights. Re-running is idempotent.

For production, swap `provider = "sqlite"` for `postgresql` in `prisma/schema.prisma`, point `DATABASE_URL` at your Postgres, and run `prisma migrate deploy`.

## What lives where

```
app/
  page.tsx                       # snapshot dashboard (live data)
  demo/page.tsx                  # same UI on mocked data
  connect/page.tsx               # setup checklist + connect button
  api/
    auth/meta/start/route.ts     # OAuth: redirect to FB dialog
    auth/meta/callback/route.ts  # OAuth: code -> long-lived token -> save accounts
    sync/route.ts                # GET/POST: pull insights for one or all accounts
    accounts/route.ts            # list connected accounts
    accounts/[id]/route.ts       # disconnect (DELETE)

components/                       # presentational, no data fetching
  Sidebar, TopBar, SnapshotHeader, SummaryGrid, PerformanceChart,
  TopAdsGrid, BreakdownTabs, Insights, EmptyState,
  AccountSwitcher (client), SyncButton (client), Sparkline (client)

lib/
  db.ts                          # PrismaClient singleton
  crypto.ts                      # AES-256-GCM encrypt/decrypt for tokens
  format.ts                      # number/currency/pct formatters
  mock-data.ts                   # sample data for /demo
  report.ts                      # builds Report{} from DB or mock
  meta/
    client.ts                    # Graph API fetch wrapper, paged generators
    oauth.ts                     # auth URL + state CSRF table
    sync.ts                      # /act/ads + /insights -> DB upserts
    types.ts

prisma/
  schema.prisma                  # AdAccount, Ad, AdInsight, SyncRun, OAuthState
```

## Data model (Prisma)

- **AdAccount** — Meta act_xxx, currency, timezone, encrypted long-lived token, last-sync timestamp
- **Ad** — id, name, campaign/adset, creative thumbnail/video URLs, format
- **AdInsight** — `(adId, date)` unique. Spend, impressions, clicks, link clicks, purchases, revenue, video p25/50/75/100, 3s views, thruplays
- **SyncRun** — audit trail for each sync invocation
- **OAuthState** — short-lived CSRF tokens for the OAuth round-trip

## Metric mapping (Meta → Beatreel)

| Beatreel       | Meta API field                                                         |
| -------------- | ---------------------------------------------------------------------- |
| Spend          | `spend`                                                                |
| Impressions    | `impressions`                                                          |
| Clicks         | `clicks`                                                               |
| Link clicks    | `inline_link_clicks`                                                   |
| Purchases      | sum of `actions[]` where action_type is in the purchase set            |
| Revenue        | sum of `action_values[]` where action_type is in the purchase set      |
| Thumb-stop     | `video_3_sec_watched_actions` / `impressions`                          |
| Hold rate      | `video_thruplay_watched_actions` / `video_3_sec_watched_actions`       |

Purchase action types matched: `purchase`, `omni_purchase`, `offsite_conversion.fb_pixel_purchase`, `onsite_web_purchase`, `onsite_web_app_purchase`. Edit `lib/meta/types.ts` if your account uses a custom event.

## Sync cadence

Manual button + `POST /api/sync` route. To run nightly, point a Vercel Cron or GitHub Action at `/api/sync?days=28`. Long-lived Meta user tokens last ~60 days; the dashboard surfaces `tokenExpiresAt` so you can prompt users to reconnect before they expire.

## What's deliberately out of scope (for now)

- TikTok / YouTube / LinkedIn integrations — Meta is ~80% of the value
- Multi-tenant auth — single-workspace; layer NextAuth/Clerk on top later
- AI tagging — server-side video tagging is its own project; the tag breakdown shows up automatically once the `Ad.tags` field is populated
- Background queue — manual sync + cron is fine until volume warrants BullMQ/SQS
