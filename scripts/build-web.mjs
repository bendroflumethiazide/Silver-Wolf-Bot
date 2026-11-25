// Build the static web edition into ./out (for GitHub Pages or any static host).
// Server-only parts (API routes, the legacy /characters/[id] route) are moved aside during the build.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const aside = path.join(root, ".web-build-aside");
const parts = ["src/app/api", "src/app/characters/[id]"];

fs.rmSync(aside, { recursive: true, force: true });
fs.mkdirSync(aside, { recursive: true });
const moved = [];
try {
  for (const rel of parts) {
    const from = path.join(root, rel);
    if (!fs.existsSync(from)) continue;
    const to = path.join(aside, rel.replace(/[\\/]/g, "__"));
    fs.renameSync(from, to);
    moved.push([from, to]);
  }
  execSync("next build", { stdio: "inherit", cwd: root, env: { ...process.env, NEXT_PUBLIC_WEB_EDITION: "1", NEXT_TELEMETRY_DISABLED: "1" } });
  fs.writeFileSync(path.join(root, "out", ".nojekyll"), "");
  console.log(`web edition ready in ./out${process.env.NEXT_BASE_PATH ? ` (base path ${process.env.NEXT_BASE_PATH})` : ""}`);
} finally {
  for (const [from, to] of moved.reverse()) fs.renameSync(to, from);
  fs.rmSync(aside, { recursive: true, force: true });
}
