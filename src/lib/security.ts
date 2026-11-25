/**
 * Same-origin guard for the app's API routes. The app runs a local server; without this, any
 * website open in the user's browser could send requests to it (spending the Claude key or
 * triggering HoYoLAB reads). Browsers always send Origin / Sec-Fetch-Site on cross-site requests.
 */
export function isSameOrigin(req: Request): boolean {
  // Desktop app: the server only ever serves the app's own window on loopback. Rejecting other
  // Host names also defeats DNS-rebinding (a site pointing its own domain at 127.0.0.1).
  if (process.env.ASTRAL_LOCAL_ONLY === "1") {
    const h = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
    if (!["127.0.0.1", "localhost", "[::1]"].includes(h)) return false;
  }
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin GETs and non-browser local tools omit Origin
  try {
    const host = req.headers.get("host") ?? new URL(req.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const forbidden = () => Response.json({ error: "Cross-site request blocked." }, { status: 403 });
