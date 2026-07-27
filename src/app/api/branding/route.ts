import { NextResponse } from "next/server";
import { getOrganisationSettings } from "@/lib/organisation-settings";

export async function GET() {
  return NextResponse.json(await getOrganisationSettings(), {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
