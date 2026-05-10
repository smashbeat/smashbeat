import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  listAdAccounts,
} from "@/lib/meta/client";
import { consumeState } from "@/lib/meta/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const base = process.env.APP_BASE_URL ?? url.origin;
  const back = (status: string, message?: string) => {
    const u = new URL("/connect", base);
    u.searchParams.set("status", status);
    if (message) u.searchParams.set("message", message);
    return NextResponse.redirect(u);
  };

  if (error) return back("error", errorDescription ?? error);
  if (!code || !state) return back("error", "Missing code or state");

  const { valid, redirectTo } = await consumeState(state);
  if (!valid) return back("error", "Invalid or expired state");

  try {
    const short = await exchangeCodeForToken(code);
    const long = await exchangeForLongLivedToken(short.access_token);
    const token = long.access_token;
    const expiresAt = long.expires_in
      ? new Date(Date.now() + long.expires_in * 1000)
      : null;

    const accounts = await listAdAccounts(token);
    if (accounts.length === 0) {
      return back(
        "warning",
        "Authenticated but no ad accounts visible. Grant access in Business Manager.",
      );
    }

    const enc = encrypt(token);
    for (const a of accounts) {
      await prisma.adAccount.upsert({
        where: { id: a.id },
        create: {
          id: a.id,
          name: a.name,
          currency: a.currency,
          timezone: a.timezone_name ?? null,
          accessTokenEnc: enc,
          tokenExpiresAt: expiresAt,
          scopes: "ads_read,ads_management,business_management",
        },
        update: {
          name: a.name,
          currency: a.currency,
          timezone: a.timezone_name ?? null,
          accessTokenEnc: enc,
          tokenExpiresAt: expiresAt,
        },
      });
    }

    const dest = new URL(redirectTo ?? "/", base);
    dest.searchParams.set("connected", String(accounts.length));
    return NextResponse.redirect(dest);
  } catch (err) {
    return back("error", err instanceof Error ? err.message : String(err));
  }
}
