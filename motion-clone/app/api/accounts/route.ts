import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = await prisma.adAccount.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      currency: true,
      timezone: true,
      lastSyncedAt: true,
      tokenExpiresAt: true,
    },
  });
  return NextResponse.json({ accounts });
}
