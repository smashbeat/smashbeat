import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import {
  getVideoSource,
  listAdInsights,
  listAds,
} from "./client";
import {
  MetaActionRow,
  MetaAd,
  MetaInsightRow,
  PURCHASE_ACTION_TYPES,
} from "./types";

const num = (s?: string) => (s == null ? 0 : Number(s) || 0);

const sumActions = (
  rows: MetaActionRow[] | undefined,
  match: (t: string) => boolean,
) => {
  if (!rows) return 0;
  let total = 0;
  for (const r of rows) if (match(r.action_type)) total += num(r.value);
  return total;
};

const sumFirst = (rows: MetaActionRow[] | undefined) => {
  if (!rows || rows.length === 0) return 0;
  return rows.reduce((s, r) => s + num(r.value), 0);
};

const formatFromAd = (ad: MetaAd): string => {
  const t = ad.creative?.object_type?.toLowerCase();
  if (ad.creative?.video_id) return "Video";
  if (t === "share" || t === "photo") return "Image";
  if (t === "video") return "Video";
  if (t === "carousel") return "Carousel";
  return "Static";
};

export type SyncOptions = {
  accountId: string;
  /** ISO date YYYY-MM-DD */
  since: string;
  /** ISO date YYYY-MM-DD */
  until: string;
  /** Whether to fetch hosted video sources for newly-seen video creatives. */
  fetchVideoSources?: boolean;
};

export async function syncAccount(opts: SyncOptions) {
  const account = await prisma.adAccount.findUnique({
    where: { id: opts.accountId },
  });
  if (!account) throw new Error(`Account ${opts.accountId} not found`);

  const token = decrypt(account.accessTokenEnc);

  const run = await prisma.syncRun.create({
    data: {
      accountId: account.id,
      status: "running",
      rangeStart: new Date(opts.since),
      rangeEnd: new Date(opts.until),
    },
  });

  let upserts = 0;
  try {
    const seenAdIds = await upsertAdsForAccount(account.id, token);
    upserts += seenAdIds.size;

    if (opts.fetchVideoSources) {
      await hydrateVideoSources(account.id, token);
    }

    for await (const row of listAdInsights({
      accountId: account.id,
      token,
      since: opts.since,
      until: opts.until,
    })) {
      if (!seenAdIds.has(row.ad_id)) {
        // Ad metadata wasn't returned by /ads (e.g., archived) — create a stub.
        await prisma.ad.upsert({
          where: { id: row.ad_id },
          update: {},
          create: {
            id: row.ad_id,
            accountId: account.id,
            name: `Ad ${row.ad_id}`,
          },
        });
        seenAdIds.add(row.ad_id);
      }
      await upsertInsight(account.id, row);
      upserts++;
    }

    await prisma.adAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date() },
    });
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        rowsUpserted: upserts,
      },
    });
    return { upserts };
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
        rowsUpserted: upserts,
      },
    });
    throw err;
  }
}

async function upsertAdsForAccount(
  accountId: string,
  token: string,
): Promise<Set<string>> {
  const seen = new Set<string>();
  for await (const ad of listAds(accountId, token)) {
    seen.add(ad.id);
    await prisma.ad.upsert({
      where: { id: ad.id },
      create: {
        id: ad.id,
        accountId,
        name: ad.name,
        status: ad.status ?? null,
        effectiveStatus: ad.effective_status ?? null,
        campaignId: ad.campaign?.id ?? null,
        campaignName: ad.campaign?.name ?? null,
        adsetId: ad.adset?.id ?? null,
        adsetName: ad.adset?.name ?? null,
        creativeId: ad.creative?.id ?? null,
        thumbnailUrl: ad.creative?.thumbnail_url ?? ad.creative?.image_url ?? null,
        videoId: ad.creative?.video_id ?? null,
        format: formatFromAd(ad),
        createdTime: ad.created_time ? new Date(ad.created_time) : null,
        launchedAt: ad.created_time ? new Date(ad.created_time) : null,
      },
      update: {
        name: ad.name,
        status: ad.status ?? null,
        effectiveStatus: ad.effective_status ?? null,
        campaignId: ad.campaign?.id ?? null,
        campaignName: ad.campaign?.name ?? null,
        adsetId: ad.adset?.id ?? null,
        adsetName: ad.adset?.name ?? null,
        creativeId: ad.creative?.id ?? null,
        thumbnailUrl: ad.creative?.thumbnail_url ?? ad.creative?.image_url ?? null,
        videoId: ad.creative?.video_id ?? null,
        format: formatFromAd(ad),
      },
    });
  }
  return seen;
}

async function hydrateVideoSources(accountId: string, token: string) {
  const ads = await prisma.ad.findMany({
    where: {
      accountId,
      videoId: { not: null },
      videoSourceUrl: null,
    },
    take: 25,
  });
  for (const ad of ads) {
    if (!ad.videoId) continue;
    try {
      const v = await getVideoSource(ad.videoId, token);
      await prisma.ad.update({
        where: { id: ad.id },
        data: {
          videoSourceUrl: v.source ?? null,
          thumbnailUrl: ad.thumbnailUrl ?? v.picture ?? null,
        },
      });
    } catch {
      // best-effort: skip on per-asset failures
    }
  }
}

async function upsertInsight(accountId: string, row: MetaInsightRow) {
  const purchases = sumActions(row.actions, (t) =>
    PURCHASE_ACTION_TYPES.has(t),
  );
  const revenue = sumActions(row.action_values, (t) =>
    PURCHASE_ACTION_TYPES.has(t),
  );
  await prisma.adInsight.upsert({
    where: { adId_date: { adId: row.ad_id, date: new Date(row.date_start) } },
    create: {
      adId: row.ad_id,
      accountId,
      date: new Date(row.date_start),
      spend: num(row.spend),
      impressions: num(row.impressions),
      clicks: num(row.clicks),
      linkClicks: num(row.inline_link_clicks),
      purchases,
      revenue,
      videoP25: sumFirst(row.video_p25_watched_actions),
      videoP50: sumFirst(row.video_p50_watched_actions),
      videoP75: sumFirst(row.video_p75_watched_actions),
      videoP100: sumFirst(row.video_p100_watched_actions),
      video3s: sumFirst(row.video_3_sec_watched_actions),
      thruplays: sumFirst(row.video_thruplay_watched_actions),
    },
    update: {
      spend: num(row.spend),
      impressions: num(row.impressions),
      clicks: num(row.clicks),
      linkClicks: num(row.inline_link_clicks),
      purchases,
      revenue,
      videoP25: sumFirst(row.video_p25_watched_actions),
      videoP50: sumFirst(row.video_p50_watched_actions),
      videoP75: sumFirst(row.video_p75_watched_actions),
      videoP100: sumFirst(row.video_p100_watched_actions),
      video3s: sumFirst(row.video_3_sec_watched_actions),
      thruplays: sumFirst(row.video_thruplay_watched_actions),
    },
  });
}
