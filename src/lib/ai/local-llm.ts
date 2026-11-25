"use client";

/**
 * Silver Wolf's built-in AI: a small open model (Qwen3 1.7B) running on this PC's GPU through WebGPU,
 * via WebLLM in a Web Worker. Downloaded once (about 1 GB) into the app's browser storage, then works
 * offline. Nothing you type leaves your PC in this mode.
 */
import type { ChatCompletionMessageParam, MLCEngineInterface } from "@mlc-ai/web-llm";
import { create } from "zustand";
import { LOCAL_MODELS } from "./brain";

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
      const model = override && prebuiltAppConfig.model_list.some((m) => m.model_id === override) ? override
        : adapter.features.has("shader-f16") ? LOCAL_MODELS.f16 : LOCAL_MODELS.f32;
      useLocalAi.setState({ model });
      set({ state: "idle", cached: await hasModelInCache(model).catch(() => false) });
    } catch (e) {
      set({ state: "unsupported", reason: e instanceof Error ? e.message : String(e) });
    }
  })();
  return probed;
}

/** Download (first time) and load the model. Safe to call repeatedly; returns null if it can't run. */
export function ensureLocalAi(): Promise<MLCEngineInterface | null> {
  if (engine) return Promise.resolve(engine);
  if (loading) return loading;
  loading = (async () => {
    await probeLocalAi();
    const { status, model } = useLocalAi.getState();
    if (status.state === "unsupported" || !model) return null;
    try {
      const webllm = await import("@mlc-ai/web-llm");
      set({ state: "downloading", progress: 0, text: "Starting…" });
      const worker = new Worker(new URL("./llm.worker.ts", import.meta.url), { type: "module" });
      engine = await webllm.CreateWebWorkerMLCEngine(worker, model, {
        initProgressCallback: (r) => set({ state: "downloading", progress: Math.max(0, Math.min(1, r.progress)), text: r.text }),
      });
      set({ state: "ready" });
      return engine;
    } catch (e) {
      engine = null;
      set({ state: "error", message: e instanceof Error ? e.message : String(e) });
      return null;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Stream a reply. Calls onText with the full text so far. */
export async function generateLocal(messages: ChatCompletionMessageParam[], onText: (text: string) => void): Promise<string> {
  const eng = await ensureLocalAi();
  if (!eng) throw new Error("Built-in AI isn't available on this PC.");
  const stream = await eng.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.8,
    top_p: 0.9,
    max_tokens: 180,
    extra_body: { enable_thinking: false },
  });
  let acc = "";
  for await (const chunk of stream) {
    acc += chunk.choices[0]?.delta?.content ?? "";
    onText(acc);
  }
  return acc;
}

/** Free the disk space. The model downloads again next time it's needed. */
export async function deleteLocalAi(): Promise<void> {
  const { model } = useLocalAi.getState();
  try { await engine?.unload(); } catch {}
  engine = null;
  if (model) {
    const { deleteModelAllInfoInCache } = await import("@mlc-ai/web-llm");
    await deleteModelAllInfoInCache(model).catch(() => {});
  }
  set({ state: "idle", cached: false });
}
