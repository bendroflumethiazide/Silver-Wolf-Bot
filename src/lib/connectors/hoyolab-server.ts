import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Server-only parts of the HoYoLAB connector: request signing and secrets from the environment. */
export const HOYOLAB_BASE = "https://bbs-api-os.hoyolab.com/game_record/hkrpg/api";
const DS_SALT = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt";

/** HoYoLAB "DS" request signature (overseas web variant). */
export function dynamicSecret(now = Math.floor(Date.now() / 1000), rand = randomBytes(3).toString("hex")): string {
  const r = rand.slice(0, 6);
  const sig = createHash("md5").update(`salt=${DS_SALT}&t=${now}&r=${r}`).digest("hex");
  return `${now},${r},${sig}`;
}

/** Cookies come only from server environment variables (.env.local), never from the browser. */
export function cookieFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  if (env.HOYOLAB_COOKIE?.trim()) return env.HOYOLAB_COOKIE.trim();
  if (env.HOYOLAB_LTUID_V2 && env.HOYOLAB_LTOKEN_V2) return `ltuid_v2=${env.HOYOLAB_LTUID_V2}; ltoken_v2=${env.HOYOLAB_LTOKEN_V2}`;
  return null;
}
