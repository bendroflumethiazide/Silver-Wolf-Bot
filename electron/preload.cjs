/** Minimal, explicit bridge for the Settings page. Secrets can be set but never read back. */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("astralDesktop", {
  status: () => ipcRenderer.invoke("desktop:status"),
  setSecrets: (values) => ipcRenderer.invoke("desktop:setSecrets", values),
  openDataFolder: () => ipcRenderer.invoke("desktop:openDataFolder"),
});
