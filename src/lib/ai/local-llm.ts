"use client";

/**
 * Silver Wolf's built-in AI: a small open model (Qwen3 1.7B) running on this device's GPU through WebGPU (Qwen2.5 0.5B on phones),
 * via WebLLM in a Web Worker. Downloaded once (about 1 GB) into the app's browser storage, then works
 * offline. Nothing you type leaves your PC in this mode.
 */
import type { ChatCompletionMessageParam, MLCEngineInterface } from "@mlc-ai/web-llm";
import { create } from "zustand";
import { LOCAL_MODELS, PHONE_MODELS } from "./brain";
import { isMobileDevice } from "../edition";

export type LocalAiState =
  | { state: "checking" }
  | { state: "unsupported"; reason: string }
  | { state: "idle"; cached: boolean }
  | { state: "downloading"; progress: number; text: string }
  | { state: "ready" }
  | { state: "error"; message: string };

interface Store { status: LocalAiState; model: string | null }
export const useLocalAi = create<Store>(() => ({ status: { state: "checking" }, model: null }));
const set = (status: LocalAiState) => useLocalAi.setState({ status });

let engine: MLCEngineInterface | null = null;
let worker: Worker | null = null;
let failures = 0;

// Crash guard: set while the model loads or answers. If the page dies (out of memory: phones), the mark
// survives the reload and the AI stays off until "Try again", instead of crashing in a loop.
const BUSY_KEY = "silverwolf:aiBusy";
const mark = () => { try { localStorage.setItem(BUSY_KEY, String(Date.now())); } catch {} };
const unmark = () => { try { localStorage.removeItem(BUSY_KEY); } catch {} };
const crashedLastTime = () => { try { return !!localStorage.getItem(BUSY_KEY); } catch { return false; } };
export const CRASH_MESSAGE = "Her AI crashed this page last time (not enough memory on this device), so it's switched off. Try again if you like, or delete it to free space.";
let loading: Promise<MLCEngineInterface | null> | null = null;
let probed: Promise<void> | null = null;

/** Does this PC have a WebGPU adapter? Picks the f16 model when supported. Runs once. */
export function probeLocalAi(): Promise<void> {
  if (probed) return probed;
  probed = (async () => {
    try {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter: (o?: object) => Promise<{ features: Set<string> } | null> } }).gpu;
      if (!gpu) return set({ state: "unsupported", reason: "This app window has no WebGPU support." });
      const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter) return set({ state: "unsupported", reason: "No compatible graphics card (WebGPU adapter) found." });
      const { hasModelInCache, prebuiltAppConfig } = await import("@mlc-ai/web-llm");
      // Test hook: CI swaps in a tiny model to check the whole pipeline quickly.
      let override: string | null = null;
      try { override = localStorage.getItem("silverwolf:aiModel"); } catch {}
      const phone = isMobileDevice();
      const family = phone ? PHONE_MODELS : LOCAL_MODELS;
      const model = override && prebuiltAppConfig.model_list.some((m) => m.model_id === override) ? override
        : adapter.features.has("shader-f16") ? family.f16 : family.f32;
      useLocalAi.setState({ model });
      if (phone) {
        // Free the space if the big computer model was downloaded on this phone earlier.
        const { deleteModelAllInfoInCache } = await import("@mlc-ai/web-llm");
        for (const big of Object.values(LOCAL_MODELS)) if (big !== model && (await hasModelInCache(big).catch(() => false))) await deleteModelAllInfoInCache(big).catch(() => {});
      }
      const cached = await hasModelInCache(model).catch(() => false);
      if (crashedLastTime()) {
        failures = 2;
        return set({ state: "error", message: CRASH_MESSAGE });
      }
      set({ state: "idle", cached });
    } catch (e) {
      set({ state: "unsupported", reason: e instanceof Error ? e.message : String(e) });
    }
  })();
  return probed;
}

/**
 * Download (first time) and load the model. Safe to call repeatedly; returns null if it can't run.
 * After two failures in a row it stops retrying by itself; `force` (the Try again button) retries anyway.
 */
export function ensureLocalAi(force = false): Promise<MLCEngineInterface | null> {
  if (engine) return Promise.resolve(engine);
  if (loading) return loading;
  if (!force && failures >= 2) return Promise.resolve(null);
  loading = (async () => {
    await probeLocalAi();
    if (!force && failures >= 2) return null;
    const { status, model } = useLocalAi.getState();
    if (status.state === "unsupported" || !model) return null;
    try {
      const webllm = await import("@mlc-ai/web-llm");
      set({ state: "downloading", progress: 0, text: "Starting…" });
      mark();
      worker = new Worker(new URL("./llm.worker.ts", import.meta.url), { type: "module" });
      engine = await webllm.CreateWebWorkerMLCEngine(worker, model, {
        initProgressCallback: (r) => set({ state: "downloading", progress: Math.max(0, Math.min(1, r.progress)), text: r.text }),
      });
      unmark();
      set({ state: "ready" });
      return engine;
    } catch (e) {
      reset(e);
      return null;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Drop a broken engine (GPU lost, crash) so the next message reloads it from the download cache. */
function reset(e: unknown) {
  unmark();
  failures += 1;
  try { worker?.terminate(); } catch {}
  worker = null;
  engine = null;
  set({ state: "error", message: e instanceof Error ? e.message : String(e) });
}

/** First words must arrive within FIRST_MS; after that, no gap longer than GAP_MS. */
const FIRST_MS = 120_000;
const GAP_MS = 45_000;

function within<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Took too long to answer (graphics card too slow or busy).")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

/** Stream a reply. Calls onText with the full text so far. Throws (and recovers the engine) on stalls or GPU loss. */
export async function generateLocal(messages: ChatCompletionMessageParam[], onText: (text: string) => void): Promise<string> {
  const eng = await ensureLocalAi();
  if (!eng) throw new Error("Built-in AI isn't available on this device.");
  let acc = "";
  mark();
  try {
    const stream = await within(eng.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.8,
      top_p: 0.9,
      max_tokens: 180,
      extra_body: { enable_thinking: false },
    }), FIRST_MS);
    const it = stream[Symbol.asyncIterator]();
    for (let first = true; ; first = false) {
      const r = await within(it.next(), first ? FIRST_MS : GAP_MS);
      if (r.done) break;
      acc += r.value.choices[0]?.delta?.content ?? "";
      onText(acc);
    }
    failures = 0;
    unmark();
    return acc;
  } catch (e) {
    try { await eng.interruptGenerate(); } catch {}
    // A stalled or crashed GPU leaves the engine unusable; start fresh next time.
    reset(e);
    throw e;
  }
}

/** Free the disk space. The model downloads again next time it's needed. */
export async function deleteLocalAi(): Promise<void> {
  const { model } = useLocalAi.getState();
  try { await engine?.unload(); } catch {}
  try { worker?.terminate(); } catch {}
  worker = null;
  engine = null;
  unmark();
  failures = 0;
  if (model) {
    const { deleteModelAllInfoInCache } = await import("@mlc-ai/web-llm");
    await deleteModelAllInfoInCache(model).catch(() => {});
  }
  set({ state: "idle", cached: false });
}
