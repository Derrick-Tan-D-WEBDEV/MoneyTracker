import { NextRequest, NextResponse } from "next/server";
import { refreshLorcanaPrices, pruneOldPriceSnapshots } from "@/lib/card-catalog-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const refreshed = await refreshLorcanaPrices();
    const pruned = await pruneOldPriceSnapshots(365);
    return NextResponse.json({ ok: true, refreshed, pruned });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
