// Assemble the self-contained server for the desktop app: Next's standalone output plus static
// assets, with symlinks resolved (pnpm uses symlinks, which installers can't carry on Windows).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const standalone = path.join(root, ".next", "standalone");
// Nested one level down on purpose: electron-builder drops a node_modules folder at the root of a
// copied resource directory, but keeps nested ones.
const outRoot = path.join(root, "dist-desktop");
const out = path.join(outRoot, "server");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("No .next/standalone/server.js — run `next build` first.");
  process.exit(1);
}
fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });
fs.cpSync(standalone, out, { recursive: true, dereference: true, verbatimSymlinks: false });
fs.cpSync(path.join(root, ".next", "static"), path.join(out, ".next", "static"), { recursive: true, dereference: true });
if (fs.existsSync(path.join(root, "public"))) fs.cpSync(path.join(root, "public"), path.join(out, "public"), { recursive: true, dereference: true });
// The app doesn't use next/image, so drop the platform-specific image library (Linux binaries
// would be useless on Windows).
for (const dir of ["sharp", "@img"]) fs.rmSync(path.join(out, "node_modules", dir), { recursive: true, force: true });
// Never ship local secrets.
for (const f of fs.readdirSync(out)) if (f.startsWith(".env")) fs.rmSync(path.join(out, f), { force: true });

let size = 0;
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else size += fs.statSync(p).size; } };
walk(out);
console.log(`dist-desktop/server ready (${(size / 1e6).toFixed(1)} MB)`);
