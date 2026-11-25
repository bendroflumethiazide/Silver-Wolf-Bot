/**
 * Silver Wolf Bot — desktop shell.
 *
 * Runs the bundled Next.js server on 127.0.0.1 (a fixed port, so the browser storage that holds
 * your data stays the same between launches) and shows it in a window. Secrets (Anthropic API key,
 * HoYoLAB cookies) are encrypted with the OS keychain via safeStorage and handed to the server as
 * environment variables. They are never exposed to the web page.
 */
const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, Menu } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.SILVER_WOLF_PORT || 47923);
const HOST = "127.0.0.1";
const ORIGIN = `http://${HOST}:${PORT}`;
const isDev = !app.isPackaged;
const isAppUrl = (u) => { try { return new URL(u).origin === ORIGIN; } catch { return false; } };
const isWebUrl = (u) => { try { return ["http:", "https:"].includes(new URL(u).protocol); } catch { return false; } };

let server = null;
let win = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
}

// ---------------------------------------------------------------- secrets

const secretsFile = () => path.join(app.getPath("userData"), "secrets.json");
const SECRET_KEYS = ["ANTHROPIC_API_KEY", "HOYOLAB_LTUID_V2", "HOYOLAB_LTOKEN_V2"];

function readSecrets() {
  try {
    const raw = JSON.parse(fs.readFileSync(secretsFile(), "utf8"));
    const out = {};
    for (const k of SECRET_KEYS) if (raw[k]) out[k] = safeStorage.decryptString(Buffer.from(raw[k], "base64"));
    return out;
  } catch {
    return {};
  }
}

function writeSecrets(values) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure storage isn't available on this system.");
  const cur = readSecrets();
  const next = { ...cur };
  for (const k of SECRET_KEYS) {
    if (!(k in values)) continue;
    const v = String(values[k] ?? "").trim();
    if (v) next[k] = v; else delete next[k];
  }
  const enc = {};
  for (const [k, v] of Object.entries(next)) enc[k] = safeStorage.encryptString(v).toString("base64");
  fs.mkdirSync(path.dirname(secretsFile()), { recursive: true });
  fs.writeFileSync(secretsFile(), JSON.stringify(enc), { mode: 0o600 });
}

// ---------------------------------------------------------------- server

function serverDir() {
  return isDev ? path.join(__dirname, "..", "dist-desktop", "server") : path.join(process.resourcesPath, "server");
}

function portInUse() {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port: PORT, path: "/", timeout: 1000 }, (res) => { res.resume(); resolve(true); });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

function startServer() {
  const dir = serverDir();
  const entry = path.join(dir, "server.js");
  if (!fs.existsSync(entry)) throw new Error(`App server not found at ${entry}. Run "npm run desktop:prepare" first.`);
  const env = {
    ...process.env,
    ...readSecrets(),
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME: HOST,
    ASTRAL_LOCAL_ONLY: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  server = spawn(process.execPath, [entry], { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  const log = fs.createWriteStream(path.join(app.getPath("userData"), "server.log"), { flags: "a" });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.on("exit", (code) => { if (code && code !== 0 && !app.isQuitting) console.error(`server exited with ${code}`); });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server || server.exitCode !== null) return resolve();
    server.once("exit", () => resolve());
    server.kill();
    setTimeout(resolve, 3000);
  });
}

async function waitForServer(ms = 30000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await portInUse()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

// ---------------------------------------------------------------- window

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: "#05050b",
    title: "Silver Wolf Bot",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
  win.once("ready-to-show", () => win.show());

  // External links (Star Rail Station, guides, sources) open in the user's normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url) && !isAppUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!isAppUrl(url)) { e.preventDefault(); if (isWebUrl(url)) shell.openExternal(url); }
  });
  win.loadURL(ORIGIN);
}

// ---------------------------------------------------------------- IPC (only from our own page)

const fromApp = (e) => isAppUrl(e.senderFrame && e.senderFrame.url);

ipcMain.handle("desktop:status", (e) => {
  if (!fromApp(e)) throw new Error("denied");
  const s = readSecrets();
  return {
    version: app.getVersion(),
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    anthropic: !!s.ANTHROPIC_API_KEY,
    hoyolab: !!(s.HOYOLAB_LTUID_V2 && s.HOYOLAB_LTOKEN_V2),
    dataPath: app.getPath("userData"),
  };
});

ipcMain.handle("desktop:setSecrets", async (e, values) => {
  if (!fromApp(e)) throw new Error("denied");
  if (!values || typeof values !== "object") throw new Error("Invalid values.");
  const clean = {};
  if ("anthropicKey" in values) clean.ANTHROPIC_API_KEY = String(values.anthropicKey ?? "").slice(0, 400);
  if ("hoyolabLtuid" in values) clean.HOYOLAB_LTUID_V2 = String(values.hoyolabLtuid ?? "").replace(/\D/g, "").slice(0, 20);
  if ("hoyolabLtoken" in values) clean.HOYOLAB_LTOKEN_V2 = String(values.hoyolabLtoken ?? "").replace(/[;\s]/g, "").slice(0, 400);
  writeSecrets(clean);
  // Restart the server so it picks up the new environment, then reload the page.
  await stopServer();
  startServer();
  await waitForServer();
  setTimeout(() => win && win.reload(), 100);
  return true;
});

ipcMain.handle("desktop:openDataFolder", (e) => {
  if (!fromApp(e)) throw new Error("denied");
  return shell.openPath(app.getPath("userData"));
});

// ---------------------------------------------------------------- lifecycle

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  // Test-only escape hatch for headless Linux CI without a keyring. Never used on Windows/macOS.
  if (process.platform === "linux" && process.env.SILVER_WOLF_TEST_PLAINTEXT_SECRETS === "1" && safeStorage.setUsePlainTextEncryption) safeStorage.setUsePlainTextEncryption(true);
  if (await portInUse()) {
    dialog.showErrorBox("Silver Wolf Bot", `Port ${PORT} is already in use by another program, so the app can't start. Close that program and try again.`);
    app.quit();
    return;
  }
  try {
    startServer();
  } catch (err) {
    dialog.showErrorBox("Silver Wolf Bot", String(err && err.message ? err.message : err));
    app.quit();
    return;
  }
  if (!(await waitForServer())) {
    dialog.showErrorBox("Silver Wolf Bot", `The app server didn't start. Details are in ${path.join(app.getPath("userData"), "server.log")}.`);
    app.quit();
    return;
  }
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("before-quit", () => { app.isQuitting = true; });
app.on("window-all-closed", async () => { await stopServer(); app.quit(); });
app.on("will-quit", () => { if (server && server.exitCode === null) server.kill(); });
