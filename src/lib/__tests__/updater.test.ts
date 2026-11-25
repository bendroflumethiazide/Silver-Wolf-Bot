import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const u = require("../../../electron/updater.cjs") as {
  isNewer: (a: string, b: string) => boolean;
  parseRelease: (r: unknown) => { version: string; url: string; setup: { name: string; url: string; sha256: string | null } | null };
  downloadVerified: (f: typeof fetch, setup: unknown, dir: string, onProgress?: (p: { received: number; total: number }) => void) => Promise<string>;
};

const body = Buffer.from("pretend installer bytes");
const sha = createHash("sha256").update(body).digest("hex");
const base = "https://github.com/bendroflumethiazide/Silver-Wolf-Bot/releases";
const release = (over: Record<string, unknown> = {}) => ({
  tag_name: "v1.1.0", html_url: `${base}/tag/v1.1.0`, body: "notes",
  assets: [{ name: "Silver-Wolf-Bot-Setup-1.1.0.exe", size: body.length, digest: `sha256:${sha}`, browser_download_url: `${base}/download/v1.1.0/Silver-Wolf-Bot-Setup-1.1.0.exe` }],
  ...over,
});
const fakeFetch = (bytes: Buffer) => (async () => new Response(new Uint8Array(bytes), { status: 200, headers: { "content-length": String(bytes.length) } })) as unknown as typeof fetch;

describe("updater", () => {
  it("compares versions numerically", () => {
    expect(u.isNewer("1.0.10", "1.0.9")).toBe(true);
    expect(u.isNewer("v1.1.0", "1.0.2")).toBe(true);
    expect(u.isNewer("1.0.2", "1.0.2")).toBe(false);
    expect(u.isNewer("0.9.9", "1.0.0")).toBe(false);
  });
  it("reads the release and only trusts this repo's URLs", () => {
    const r = u.parseRelease(release());
    expect(r.version).toBe("1.1.0");
    expect(r.setup?.sha256).toBe(sha);
    const evil = u.parseRelease(release({ html_url: "https://evil.example/x", assets: [{ ...release().assets[0], browser_download_url: "https://evil.example/a.exe" }] }));
    expect(evil.url).toBe(base);
    expect(evil.setup).toBeNull();
    expect(() => u.parseRelease({ tag_name: "latest" })).toThrow();
  });
  it("downloads and verifies the checksum, deleting a bad file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "swb-"));
    const setup = u.parseRelease(release()).setup;
    const seen: number[] = [];
    const file = await u.downloadVerified(fakeFetch(body), setup, dir, (p) => seen.push(p.received));
    expect(readFileSync(file).equals(body)).toBe(true);
    expect(seen.at(-1)).toBe(body.length);
    await expect(u.downloadVerified(fakeFetch(Buffer.from("tampered")), setup, dir)).rejects.toThrow(/checksum/);
    expect(existsSync(file)).toBe(false);
  });
  it("refuses an installer without a checksum", async () => {
    const r = u.parseRelease(release({ assets: [{ ...release().assets[0], digest: null }] }));
    await expect(u.downloadVerified(fakeFetch(body), r.setup, mkdtempSync(join(tmpdir(), "swb-")))).rejects.toThrow(/checksum/);
  });
});
