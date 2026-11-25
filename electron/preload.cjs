/** Minimal, explicit bridge for the Settings page. Secrets can be set but never read back. */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("astralDesktop", {
  status: () => ipcRenderer.invoke("desktop:status"),
  setSecrets: (values) => ipcRenderer.invoke("desktop:setSecrets", values),
  openDataFolder: () => ipcRenderer.invoke("desktop:openDataFolder"),
  checkUpdate: () => ipcRenderer.invoke("desktop:checkUpdate"),
  installUpdate: () => ipcRenderer.invoke("desktop:installUpdate"),
  openReleasePage: () => ipcRenderer.invoke("desktop:openReleasePage"),
  onUpdateProgress: (cb) => {
    const fn = (_e, p) => cb({ received: Number(p.received) || 0, total: Number(p.total) || 0 });
    ipcRenderer.on("desktop:updateProgress", fn);
    return () => ipcRenderer.removeListener("desktop:updateProgress", fn);
  },
});
