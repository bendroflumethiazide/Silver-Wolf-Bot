// Extract per-character build metadata from Fribbels' HSR Optimizer (MIT licence) into
// src/data/fribbels-builds.json: substat weights, recommended main stats per slot, recommended
// relic and ornament sets, best teammates and default Light Cone.
//
// Usage: node scripts/import-fribbels.mjs <path to a checkout of github.com/fribbels/hsr-optimizer>
// Only src/lib/constants and src/lib/conditionals/{character,lightcone} are read.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repo = process.argv[2];
if (!repo || !fs.existsSync(path.join(repo, "src/lib/constants/constants.ts"))) {
  console.error("Usage: node scripts/import-fribbels.mjs <path-to-hsr-optimizer-checkout>");
  process.exit(1);
}
const out = path.resolve(import.meta.dirname, "..", "src", "data", "fribbels-builds.json");
const read = (p) => fs.readFileSync(p, "utf8");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".ts") ? [path.join(dir, e.name)] : []));

/** `export const Name = { KEY: 'value', ... }` → { KEY: value } */
function constObject(src, name) {
  const start = src.indexOf(`export const ${name} = {`);
  if (start < 0) throw new Error(`${name} not found`);
  const body = block(src, src.indexOf("{", start));
  const map = {};
  for (const m of body.matchAll(/^\s*(\w+):\s*'((?:[^'\\]|\\.)*)'/gm)) map[m[1]] = m[2].replace(/\\'/g, "'");
  return map;
}

/** Text of the balanced {...} or [...] starting at index i. */
function block(src, i) {
  const open = src[i];
  const close = open === "{" ? "}" : open === "[" ? "]" : open === "(" ? ")" : null;
  if (!close) throw new Error(`no block at ${i}`);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (ch === "'" || ch === '"' || ch === "`") { // skip strings
      const q = ch;
      for (j++; j < src.length && src[j] !== q; j++) if (src[j] === "\\") j++;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error("unbalanced block");
}

/** The {...} / [...] value of `key:` inside text (first occurrence), or "". */
function field(text, key) {
  const m = new RegExp(`(^|[\\s,{])${key}:\\s*([\\[{])`, "m").exec(text);
  return m ? block(text, m.index + m[0].length - 1) : "";
}

const constants = read(path.join(repo, "src/lib/constants/constants.ts"));
const STATS = constObject(constants, "Stats");
const SETS = constObject(constants, "Sets");
const PART = { Body: "BODY", Feet: "FOOT", PlanarSphere: "NECK", LinkRope: "OBJECT", Head: "HEAD", Hands: "HAND" };

// Light Cone class name → id
const lcIds = {};
for (const f of walk(path.join(repo, "src/lib/conditionals/lightcone"))) {
  for (const m of read(f).matchAll(/export const (\w+): LightConeConfig = \{\s*id: '(\d+)'/g)) lcIds[m[1]] = m[2];
}

// Character class name → id (first pass), then the build data (second pass)
const files = walk(path.join(repo, "src/lib/conditionals/character"));
const charIds = {};
for (const f of files) for (const m of read(f).matchAll(/export const (\w+): CharacterConfig = \{\s*id: '([^']+)'/g)) charIds[m[1]] = m[2];

const stat = (k) => STATS[k] ?? null;
const statsIn = (text) => [...text.matchAll(/Stats\.(\w+)/g)].map((m) => stat(m[1])).filter(Boolean);
const setName = (k) => SETS[k] ?? null;
const lcRef = (ref) => {
  if (!ref) return null;
  const [cls, prop] = ref.split(".");
  if (prop === "id") return lcIds[cls] ?? null;
  return null;
};

const characters = {};
const skipped = [];
for (const f of files) {
  const src = read(f);
  const head = /export const (\w+): CharacterConfig = \{\s*id: '([^']+)'/.exec(src);
  if (!head) continue;
  const id = head[2];
  if (!/^\d+$/.test(id)) { skipped.push(`${head[1]} (${id}: variant)`); continue; }
  const sIdx = src.search(/const scoring = \(\): ScoringMetadata => \(/);
  if (sIdx < 0) { skipped.push(`${head[1]} (no scoring block)`); continue; }
  const scoring = block(src, src.indexOf("(", src.indexOf("=>", sIdx)));
  const statsBlock = field(scoring, "stats");
  const weights = {};
  for (const m of statsBlock.matchAll(/\[Stats\.(\w+)\]:\s*([\d.]+)/g)) if (stat(m[1]) && Number(m[2]) > 0) weights[stat(m[1])] = Number(m[2]);
  const mains = {};
  const partsBlock = field(scoring, "parts");
  for (const m of partsBlock.matchAll(/\[Parts\.(\w+)\]:\s*\[/g)) {
    const list = block(partsBlock, m.index + m[0].length - 1);
    if (PART[m[1]]) mains[PART[m[1]]] = [...new Set(statsIn(list))];
  }
  const simIdx = src.search(/const simulation = \(\): SimulationMetadata => \(/);
  const sim = simIdx >= 0 ? block(src, src.indexOf("(", src.indexOf("=>", simIdx))) : "";
  const relicSets = [];
  for (const m of field(sim, "relicSets").matchAll(/\[\s*Sets\.(\w+),\s*Sets\.(\w+)\s*\]/g)) {
    const a = setName(m[1]), b = setName(m[2]);
    if (a && b) relicSets.push(a === b ? [a] : [a, b]);
  }
  const ornamentSets = [...field(sim, "ornamentSets").matchAll(/Sets\.(\w+)/g)].map((m) => setName(m[1])).filter(Boolean);
  const teammates = [];
  for (const m of field(sim, "teammates").matchAll(/characterId:\s*(\w+)\.id,\s*lightCone:\s*([\w.]+),/g)) {
    // Variant configs (e.g. "1217b1") are the same character in the game data.
    const tid = charIds[m[1]]?.replace(/b\d+$/, "");
    if (!tid) continue;
    const lcCls = m[2].endsWith(".defaultLightCone") ? null : m[2];
    teammates.push({ id: tid, lightCone: lcRef(lcCls) });
  }
  const substats = [...new Set(statsIn(field(sim, "substats")))];
  const defaultLc = lcRef(/defaultLightCone:\s*([\w.]+)/.exec(src)?.[1]);
  characters[id] = {
    name: head[1],
    weights,
    mainStats: mains,
    ...(substats.length ? { substats } : {}),
    ...(relicSets.length ? { relicSets } : {}),
    ...(ornamentSets.length ? { ornamentSets: [...new Set(ornamentSets)] } : {}),
    ...(teammates.length ? { teammates } : {}),
    ...(defaultLc ? { defaultLightCone: defaultLc } : {}),
  };
}

// Teammates that use their own default Light Cone: fill it in from that character's entry.
for (const c of Object.values(characters)) for (const t of c.teammates ?? []) if (!t.lightCone) t.lightCone = characters[t.id]?.defaultLightCone ?? null;

let commit = "unknown";
try { commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim(); } catch {}
const data = {
  source: "https://github.com/fribbels/hsr-optimizer",
  commit,
  license: "MIT License, Copyright (c) 2024 Fribbels",
  generated: new Date().toISOString().slice(0, 10),
  characters: Object.fromEntries(Object.entries(characters).sort(([a], [b]) => a.localeCompare(b))),
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(data, null, 1)}\n`);
console.log(`${Object.keys(characters).length} characters → ${path.relative(process.cwd(), out)} (skipped ${skipped.length}: ${skipped.slice(0, 6).join(", ")}${skipped.length > 6 ? "…" : ""})`);
