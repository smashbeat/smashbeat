import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncAccount } from "@/lib/meta/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function run(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  const days = Number(url.searchParams.get("days") ?? 28);
  const fetchVideoSources =
    url.searchParams.get("videos") === "1" ||
    url.searchParams.get("videos") === "true";

  const until = new Date();
  const since = new Date(until);
  since.setDate(since.getDate() - days);

  const accounts = accountId
    ? await prisma.adAccount.findMany({ where: { id: accountId } })
    : await prisma.adAccount.findMany();

  if (accounts.length === 0) {
    return NextResponse.json(
      { error: "no_accounts", message: "Connect a Meta ad account first." },
      { status: 404 },
    );
  }

  const results: Array<{
    accountId: string;
    upserts?: number;
    error?: string;
  }> = [];

  for (const acc of accounts) {
    try {
      const r = await syncAccount({
        accountId: acc.id,
        since: isoDate(since),
        until: isoDate(until),
        fetchVideoSources,
      });
      results.push({ accountId: acc.id, upserts: r.upserts });
    } catch (err) {
      results.push({
        accountId: acc.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ results });
}

export const GET = run;
export const POST = run;
