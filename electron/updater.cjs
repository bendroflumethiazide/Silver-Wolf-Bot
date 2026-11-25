/**
 * Update check + one-click install from this app's GitHub Releases.
 * Pure helpers are exported for tests; network/disk work takes injected functions.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const REPO = "bendroflumethiazide/Silver-Wolf-Bot";
const API_LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases`;

/** "1.2.10" > "1.2.9" → true. Ignores a leading "v". */
function isNewer(latest, current) {
  const a = String(latest).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const b = String(current).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); }
  return false;
}

const safeReleaseUrl = (u) => typeof u === "string" && u.startsWith(`https://github.com/${REPO}/releases/`);
const safeAssetUrl = (u) => typeof u === "string" && u.startsWith(`https://github.com/${REPO}/releases/download/`);

/** Reads GitHub's "latest release" JSON into what the app needs; rejects anything unexpected. */
function parseRelease(r) {
  const version = String((r && r.tag_name) || "").replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("The latest release has an unexpected version tag.");
  const want = `Silver-Wolf-Bot-Setup-${version}.exe`;
  const a = (r.assets || []).find((x) => x && x.name === want);
  const digest = a && /^sha256:[0-9a-f]{64}$/.test(String(a.digest || "")) ? String(a.digest).slice(7) : null;
  return {
    version,
    notes: String(r.body || "").slice(0, 4000),
    url: safeReleaseUrl(r.html_url) ? r.html_url : RELEASES_PAGE,
    setup: a && safeAssetUrl(a.browser_download_url) ? { name: want, size: Number(a.size) || 0, url: a.browser_download_url, sha256: digest } : null,
  };
}

async function fetchLatest(fetchFn) {
  const res = await fetchFn(API_LATEST, { headers: { Accept: "application/vnd.github+json", "User-Agent": "SilverWolfBot-Updater" } });
  if (res.status === 404) throw new Error("No releases published yet.");
  if (!res.ok) throw new Error(`GitHub answered ${res.status}. Try again later.`);
  return parseRelease(await res.json());
}

/** Streams the installer to dir, hashing as it goes; deletes it if the SHA-256 doesn't match. */
async function downloadVerified(fetchFn, setup, dir, onProgress) {
  if (!setup || !safeAssetUrl(setup.url)) throw new Error("No installer in the latest release.");
  if (!setup.sha256) throw new Error("The release has no checksum, so the download can't be verified. Use the releases page instead.");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, setup.name);
  const res = await fetchFn(setup.url, { headers: { "User-Agent": "SilverWolfBot-Updater" } });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}).`);
  const total = Number(res.headers.get("content-length")) || setup.size || 0;
  const hash = crypto.createHash("sha256");
  const out = fs.createWriteStream(file);
  let received = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      received += value.length;
      if (!out.write(Buffer.from(value))) await new Promise((r) => out.once("drain", r));
      onProgress && onProgress({ received, total });
    }
  } finally {
    await new Promise((r) => out.end(r));
  }
  const got = hash.digest("hex");
  if (got !== setup.sha256) { fs.rmSync(file, { force: true }); throw new Error("The download didn't match its checksum, so it was deleted. Try again."); }
  return file;
}

module.exports = { REPO, RELEASES_PAGE, isNewer, parseRelease, fetchLatest, downloadVerified, safeReleaseUrl };
