import {
  MetaAd,
  MetaAdAccount,
  MetaApiError,
  MetaErrorBody,
  MetaInsightRow,
  MetaListResponse,
  MetaTokenResponse,
} from "./types";

const VERSION = process.env.META_GRAPH_VERSION ?? "v21.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

type Params = Record<string, string | number | boolean | undefined>;

async function call<T>(
  path: string,
  params: Params,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith("http") ? new URL(path) : new URL(GRAPH + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    let body: MetaErrorBody | string;
    try {
      body = (await res.json()) as MetaErrorBody;
    } catch {
      body = await res.text();
    }
    throw new MetaApiError(res.status, body);
  }
  return (await res.json()) as T;
}

async function* paged<T>(
  path: string,
  params: Params,
): AsyncGenerator<T, void, unknown> {
  let next: string | undefined;
  let first = true;
  while (first || next) {
    const data = first
      ? await call<MetaListResponse<T>>(path, params)
      : await call<MetaListResponse<T>>(next!, {});
    first = false;
    for (const row of data.data ?? []) yield row;
    next = data.paging?.next;
    if (!next) break;
  }
}

export async function exchangeCodeForToken(
  code: string,
): Promise<MetaTokenResponse> {
  return call<MetaTokenResponse>("/oauth/access_token", {
    client_id: requiredEnv("META_APP_ID"),
    client_secret: requiredEnv("META_APP_SECRET"),
    redirect_uri: requiredEnv("META_REDIRECT_URI"),
    code,
  });
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<MetaTokenResponse> {
  return call<MetaTokenResponse>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: requiredEnv("META_APP_ID"),
    client_secret: requiredEnv("META_APP_SECRET"),
    fb_exchange_token: shortLivedToken,
  });
}

export async function listAdAccounts(token: string): Promise<MetaAdAccount[]> {
  const out: MetaAdAccount[] = [];
  for await (const acc of paged<MetaAdAccount>("/me/adaccounts", {
    access_token: token,
    fields: "id,account_id,name,currency,timezone_name",
    limit: 100,
  })) {
    out.push(acc);
  }
  return out;
}

const AD_FIELDS = [
  "id",
  "name",
  "status",
  "effective_status",
  "created_time",
  "campaign{id,name}",
  "adset{id,name}",
  "creative{id,thumbnail_url,image_url,video_id,object_type,effective_object_story_id}",
].join(",");

export async function* listAds(
  accountId: string,
  token: string,
): AsyncGenerator<MetaAd> {
  yield* paged<MetaAd>(`/${accountId}/ads`, {
    access_token: token,
    fields: AD_FIELDS,
    limit: 200,
  });
}

const INSIGHT_FIELDS = [
  "ad_id",
  "date_start",
  "date_stop",
  "spend",
  "impressions",
  "clicks",
  "inline_link_clicks",
  "actions",
  "action_values",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p100_watched_actions",
  "video_3_sec_watched_actions",
  "video_thruplay_watched_actions",
].join(",");

export async function* listAdInsights(args: {
  accountId: string;
  token: string;
  since: string;
  until: string;
}): AsyncGenerator<MetaInsightRow> {
  yield* paged<MetaInsightRow>(`/${args.accountId}/insights`, {
    access_token: args.token,
    level: "ad",
    time_increment: 1,
    time_range: JSON.stringify({ since: args.since, until: args.until }),
    fields: INSIGHT_FIELDS,
    limit: 500,
    action_attribution_windows: JSON.stringify(["7d_click", "1d_view"]),
  });
}

export async function getVideoSource(
  videoId: string,
  token: string,
): Promise<{ source?: string; picture?: string }> {
  return call<{ source?: string; picture?: string }>(`/${videoId}`, {
    access_token: token,
    fields: "source,picture",
  });
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing env ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return v;
}
