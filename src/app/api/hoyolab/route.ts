import { RETCODE_MESSAGE, serverForUid, type HoyolabRaw } from "@/lib/connectors/hoyolab";
import { cookieFromEnv, dynamicSecret, HOYOLAB_BASE } from "@/lib/connectors/hoyolab-server";

/**
 * Read-only proxy for HoYoLAB Battle Chronicle (HSR, global servers).
 * Cookies are read from server environment variables (.env.local) and never sent to the browser.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cache = new Map<string, { until: number; body: HoyolabRaw }>();

export function GET() {
  return Response.json({ configured: cookieFromEnv() !== null });
}

async function call(path: string, cookie: string): Promise<{ data?: unknown; error?: string }> {
  let res: Response;
  try {
    res = await fetch(`${HOYOLAB_BASE}/${path}`, {
      method: "GET",
      headers: {
        Cookie: cookie, DS: dynamicSecret(), "x-rpc-app_version": "1.5.0", "x-rpc-client_type": "5", "x-rpc-language": "en-us",
        Origin: "https://act.hoyolab.com", Referer: "https://act.hoyolab.com/", Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    return { error: `Couldn't reach HoYoLAB (${e instanceof Error ? e.message : "network error"}).` };
  }
  if (!res.ok) return { error: `HoYoLAB returned HTTP ${res.status}.` };
  const j = (await res.json().catch(() => null)) as { retcode?: number; message?: string; data?: unknown } | null;
  if (!j) return { error: "HoYoLAB returned something that isn't JSON." };
  if (j.retcode !== 0) return { error: RETCODE_MESSAGE[j.retcode ?? -1] ?? `HoYoLAB error ${j.retcode}: ${j.message ?? "unknown"}` };
  return { data: j.data };
}

export async function POST(req: Request) {
  const cookie = cookieFromEnv();
  if (!cookie) return Response.json({ error: "HoYoLAB isn't configured. Add HOYOLAB_LTUID_V2 and HOYOLAB_LTOKEN_V2 to .env.local and restart." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { uid?: string } | null;
  const uid = String(body?.uid ?? "");
  const server = serverForUid(uid);
  if (!server) return Response.json({ error: "Enter a 9–10 digit global-server UID (starting with 6, 7, 8 or 9)." }, { status: 400 });
  const hit = cache.get(uid);
  if (hit && hit.until > Date.now()) return Response.json(hit.body);

  const q = `server=${server}&role_id=${uid}`;
  const errors: Record<string, string> = {};
  const out: HoyolabRaw = { uid, fetchedAt: new Date().toISOString(), errors };
  // Sequential and few: be gentle with HoYoLAB.
  const parts: [keyof HoyolabRaw, string, string][] = [
    ["index", `index?${q}`, "Profile"],
    ["note", `note?${q}`, "Real-time note"],
    ["moc", `challenge?${q}&schedule_type=1&need_all=true`, "Memory of Chaos"],
    ["pf", `challenge_story?${q}&schedule_type=1&need_all=true&type=story`, "Pure Fiction"],
    ["as", `challenge_boss?${q}&schedule_type=1&need_all=true&type=boss`, "Apocalyptic Shadow"],
  ];
  for (const [key, path, label] of parts) {
    const r = await call(path, cookie);
    if (r.error) {
      errors[label] = r.error;
      // Stop at auth or verification problems: further calls would fail the same way.
      if (/cookies|logged in|verification|doesn't match/.test(r.error)) break;
    } else (out as unknown as Record<string, unknown>)[key] = r.data;
  }
  if (Object.keys(errors).length === parts.length || (!out.index && !out.note)) return Response.json({ error: Object.values(errors)[0] ?? "No data returned.", errors }, { status: 502 });
  cache.set(uid, { until: Date.now() + 5 * 60_000, body: out });
  return Response.json(out);
}
