export type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export type MetaAdAccount = {
  id: string;
  account_id: string;
  name: string;
  currency: string;
  timezone_name?: string;
};

export type MetaCreative = {
  id?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  effective_object_story_id?: string;
  object_type?: string;
};

export type MetaAd = {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  created_time?: string;
  campaign?: { id: string; name: string };
  adset?: { id: string; name: string };
  creative?: MetaCreative;
};

export type MetaActionRow = {
  action_type: string;
  value: string;
  "1d_click"?: string;
  "7d_click"?: string;
  "1d_view"?: string;
};

export type MetaInsightRow = {
  ad_id: string;
  date_start: string;
  date_stop: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: MetaActionRow[];
  action_values?: MetaActionRow[];
  video_p25_watched_actions?: MetaActionRow[];
  video_p50_watched_actions?: MetaActionRow[];
  video_p75_watched_actions?: MetaActionRow[];
  video_p100_watched_actions?: MetaActionRow[];
  video_3_sec_watched_actions?: MetaActionRow[];
  video_thruplay_watched_actions?: MetaActionRow[];
};

export type MetaPaging = {
  cursors?: { before?: string; after?: string };
  next?: string;
  previous?: string;
};

export type MetaListResponse<T> = {
  data: T[];
  paging?: MetaPaging;
};

export type MetaErrorBody = {
  error?: {
    message: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export class MetaApiError extends Error {
  status: number;
  code?: number;
  subcode?: number;
  traceId?: string;
  constructor(status: number, body: MetaErrorBody | string) {
    const e = typeof body === "string" ? undefined : body.error;
    super(e?.message ?? (typeof body === "string" ? body : "Meta API error"));
    this.name = "MetaApiError";
    this.status = status;
    this.code = e?.code;
    this.subcode = e?.error_subcode;
    this.traceId = e?.fbtrace_id;
  }
}

export const PURCHASE_ACTION_TYPES = new Set([
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_web_purchase",
  "onsite_web_app_purchase",
]);
