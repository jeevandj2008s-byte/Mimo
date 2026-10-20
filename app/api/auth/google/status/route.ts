import { NextResponse } from "next/server";
import { checkGoogleOAuthReadiness } from "@/lib/google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Probe only this deployment's configured project. Never accept a URL/key
  // from the request or return OAuth Locations, cookies, or credentials.
  const result = await checkGoogleOAuthReadiness({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    redirectTo: new URL("/auth/callback", request.url).toString(),
  });
  return NextResponse.json(result, {
    status: result.ready ? 200 : result.code === "timeout" ? 504 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
