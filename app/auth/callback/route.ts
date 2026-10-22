import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";

function getSafeOrigin(requestUrl: string, request: Request): string {
  const url = new URL(requestUrl);
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  // Prevent 0.0.0.0 destination which causes ERR_ADDRESS_INVALID in Chromium browsers
  const safeHost = hostHeader.replace(/^0\.0\.0\.0(?=:|$)/, "localhost");
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "http";
  return `${proto}://${safeHost}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  // Defense in depth: prevent open redirect (require leading slash, disallow double slash or protocol-relative)
  const safeNext = next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
  const safeOrigin = getSafeOrigin(request.url, request);

  if (!code || !isSupabaseServerConfigured()) {
    return NextResponse.redirect(new URL("/?auth=error", safeOrigin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/?auth=error", safeOrigin));
  }
  return NextResponse.redirect(new URL(safeNext, safeOrigin));
}
