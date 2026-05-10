import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

const OAUTH_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";

export const META_SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
  "public_profile",
];

export async function buildAuthUrl(redirectTo?: string): Promise<string> {
  const state = randomBytes(16).toString("base64url");
  await prisma.oAuthState.create({
    data: { state, redirectTo: redirectTo ?? null },
  });
  const url = new URL(OAUTH_DIALOG);
  url.searchParams.set("client_id", required("META_APP_ID"));
  url.searchParams.set("redirect_uri", required("META_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

export async function consumeState(
  state: string,
): Promise<{ valid: boolean; redirectTo: string | null }> {
  const row = await prisma.oAuthState.findUnique({ where: { state } });
  if (!row) return { valid: false, redirectTo: null };
  await prisma.oAuthState.delete({ where: { state } });
  const ageMs = Date.now() - row.createdAt.getTime();
  if (ageMs > 1000 * 60 * 15) return { valid: false, redirectTo: null };
  return { valid: true, redirectTo: row.redirectTo };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}
