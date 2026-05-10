import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  await prisma.adAccount.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
