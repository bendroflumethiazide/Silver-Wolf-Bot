import { NextResponse } from "next/server";

/**
 * Local proxy for the Enka.Network HSR showcase API (browser CORS + required User-Agent).
 * Only a UID is forwarded. Responses are cached in memory for the `ttl` Enka returns, as Enka asks.
 */
const cache = new Map<string, { until: number; body: unknown }>();
const UA = "AstralCompanion/0.1 (personal local app)";

export async function GET(_req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  if (!/^\d{9,10}$/.test(uid)) return NextResponse.json({ error: "UID must be 9–10 digits." }, { status: 400 });
  const hit = cache.get(uid);
  if (hit && hit.until > Date.now()) return NextResponse.json({ cached: true, data: hit.body });
  let res: Response;
  try {
    res = await fetch(`https://enka.network/api/hsr/uid/${uid}`, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  } catch (e) {
    return NextResponse.json({ error: `Could not reach Enka.Network (${e instanceof Error ? e.message : "network error"}).` }, { status: 502 });
  }
  const messages: Record<number, string> = {
    400: "Wrong UID format.", 404: "Player not found.", 424: "Game maintenance or Enka is updating.",
    429: "Rate limited. Wait a minute and try again.", 500: "Enka.Network server error.", 503: "Enka.Network is temporarily unavailable.",
  };
  if (!res.ok) return NextResponse.json({ error: messages[res.status] ?? `Enka.Network returned HTTP ${res.status}.` }, { status: res.status });
  const body = (await res.json()) as { ttl?: number };
  cache.set(uid, { until: Date.now() + Math.max(30, body.ttl ?? 60) * 1000, body });
  return NextResponse.json({ cached: false, data: body });
}
