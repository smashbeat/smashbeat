import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/meta/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return NextResponse.json(
      {
        error: "meta_not_configured",
        message:
          "Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI in .env.local. Create an app at https://developers.facebook.com/apps.",
      },
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  const redirectTo = url.searchParams.get("redirectTo") ?? undefined;
  try {
    const authUrl = await buildAuthUrl(redirectTo);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    return NextResponse.json(
      { error: "auth_url_failed", message: errMsg(err) },
      { status: 500 },
    );
  }
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
