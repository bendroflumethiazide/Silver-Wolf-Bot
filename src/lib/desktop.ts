import { create } from "zustand";

/** The desktop app's bridge (electron/preload.cjs). Undefined in a normal browser. */
export interface UpdateInfo { current: string; latest: string; newer: boolean; notes: string; url: string; canInstall: boolean; portable: boolean }
export interface DesktopBridge {
  status: () => Promise<{ version: string; encryptionAvailable: boolean; anthropic: boolean; hoyolab: boolean; dataPath: string }>;
  setSecrets: (v: { anthropicKey?: string; hoyolabLtuid?: string; hoyolabLtoken?: string }) => Promise<boolean>;
  openDataFolder: () => Promise<string>;
  checkUpdate?: () => Promise<UpdateInfo>;
  installUpdate?: () => Promise<boolean>;
  openReleasePage?: () => Promise<void>;
  onUpdateProgress?: (cb: (p: { received: number; total: number }) => void) => () => void;
}
declare global { interface Window { astralDesktop?: DesktopBridge } }

export const desktop = (): DesktopBridge | null => (typeof window !== "undefined" && window.astralDesktop) || null;

/** Shared update state so the banner and Settings show the same thing. */
type Phase = "idle" | "checking" | "downloading" | "installing" | "error";
interface UpdateStore {
  info: UpdateInfo | null; phase: Phase; progress: number; error: string | null; dismissed: boolean;
  check: () => Promise<void>; install: () => Promise<void>; dismiss: () => void;
}
export const useUpdate = create<UpdateStore>((set, get) => ({
  info: null, phase: "idle", progress: 0, error: null, dismissed: false,
  check: async () => {
    const d = desktop();
    if (!d?.checkUpdate || get().phase === "checking") return;
    set({ phase: "checking", error: null });
    try { set({ info: await d.checkUpdate(), phase: "idle" }); } catch (e) { set({ phase: "error", error: e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : String(e) }); }
  },
  install: async () => {
    const d = desktop();
    if (!d) return;
    if (!get().info?.canInstall) { await d.openReleasePage?.(); return; }
    set({ phase: "downloading", progress: 0, error: null });
    const off = d.onUpdateProgress?.((p) => set({ progress: p.total ? p.received / p.total : 0 }));
    try { await d.installUpdate?.(); set({ phase: "installing", progress: 1 }); }
    catch (e) { set({ phase: "error", error: e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : String(e) }); }
    finally { off?.(); }
  },
  dismiss: () => set({ dismissed: true }),
}));
