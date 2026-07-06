import { NextResponse } from "next/server";
import { getApprovedFeed } from "@/lib/petfeed/db";

/**
 * GET /api/pet-feed — the approved pet pictures, as JSON, for the OBS overlay
 * (and the public gallery) to poll. Public on purpose: approved pics are meant
 * to be shown on stream, and the payload is only the image url + pet name +
 * caption (no submitter identity). Short cache so a fresh approval shows up
 * within a few seconds without a manual OBS refresh.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getApprovedFeed();
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, max-age=5, s-maxage=5" } },
    );
  } catch (e) {
    console.error("[pet-feed] api error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
