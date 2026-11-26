/**
 * Read-only access to the Honkai: Star Rail Wiki (Fandom) MediaWiki API. Anonymous CORS
 * (`origin=*`) works from the browser and the desktop app. Text is CC BY-SA 3.0; images © HoYoverse.
 */
export const WIKI = {
  name: "Honkai: Star Rail Wiki (Fandom)",
  api: "https://honkai-star-rail.fandom.com/api.php",
  page: (title: string) => `https://honkai-star-rail.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
  license: "CC BY-SA 3.0",
  licenseUrl: "https://www.fandom.com/licensing",
} as const;

type Json = Record<string, unknown>;

/** GET the API with continuation, merging `query.pages` by page id. Max `maxRequests` round trips. */
export async function wikiQueryAll(params: Record<string, string>, maxRequests = 30, fetchFn: typeof fetch = fetch): Promise<Record<string, Json>> {
  const pages: Record<string, Json> = {};
  let cont: Record<string, string> = {};
  for (let i = 0; i < maxRequests; i++) {
    const qs = new URLSearchParams({ action: "query", format: "json", origin: "*", formatversion: "1", ...params, ...cont });
    const res = await fetchFn(`${WIKI.api}?${qs}`);
    if (!res.ok) throw new Error(`The wiki answered ${res.status}.`);
    const body = (await res.json()) as { query?: { pages?: Record<string, Json> }; continue?: Record<string, string>; error?: { info?: string } };
    if (body.error) throw new Error(body.error.info ?? "Wiki error");
    for (const [id, p] of Object.entries(body.query?.pages ?? {})) {
      const prev = pages[id];
      if (!prev) { pages[id] = p; continue; }
      // Categories arrive in chunks across continuations: append them.
      const cats = [...((prev.categories as Json[]) ?? []), ...((p.categories as Json[]) ?? [])];
      pages[id] = { ...prev, ...p, ...(cats.length ? { categories: cats } : {}) };
    }
    if (!body.continue) return pages;
    cont = body.continue;
  }
  return pages;
}

/** Plain wikitext of one page. */
export async function wikiText(title: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const qs = new URLSearchParams({ action: "parse", page: title, prop: "wikitext", format: "json", origin: "*", redirects: "1" });
  const res = await fetchFn(`${WIKI.api}?${qs}`);
  if (!res.ok) throw new Error(`The wiki answered ${res.status}.`);
  const body = (await res.json()) as { parse?: { wikitext?: { "*": string } }; error?: { info?: string } };
  if (!body.parse) throw new Error(body.error?.info ?? `No page “${title}”.`);
  return body.parse.wikitext?.["*"] ?? "";
}
