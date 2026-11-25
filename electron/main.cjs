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
const net = require("node:net");
const path = require("node:path");

const PORT = Number(process.env.SILVER_WOLF_PORT || 47923);
const HOST = "127.0.0.1";
const ORIGIN = `http://${HOST}:${PORT}`;
const isDev = !app.isPackaged;
const isAppUrl = (u) => { try { return new URL(u).origin === ORIGIN; } catch { return false; } };
const isWebUrl = (u) => { try { return ["http:", "https:"].includes(new URL(u).protocol); } catch { return false; } };

let server = null;
let win = null;
let splash = null;
let log = null;
let serverExit = null; // set when the server process ends: { code, signal, error }

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

const logFile = () => path.join(app.getPath("userData"), "server.log");

function openLog() {
  if (log) return log;
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  // Start fresh when the log grows past 1 MB.
  try { if (fs.statSync(logFile()).size > 1e6) fs.rmSync(logFile()); } catch {}
  log = fs.createWriteStream(logFile(), { flags: "a" });
  return log;
}
const note = (msg) => openLog().write(`[${new Date().toISOString()}] ${msg}\n`);

function logTail(lines = 12) {
  try { return fs.readFileSync(logFile(), "utf8").trimEnd().split(/\r?\n/).slice(-lines).join("\n"); } catch { return ""; }
}

/** True when something accepts TCP connections on the app port. Next only listens once it's ready. */
function portOpen(timeout = 1000) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: HOST, port: PORT });
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setTimeout(timeout, () => done(false));
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
  });
}

function startServer() {
  const dir = serverDir();
  const entry = path.join(dir, "server.js");
  if (!fs.existsSync(entry)) throw new Error(`App server not found at ${entry}. Reinstall the app.`);
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
  note(`starting v${app.getVersion()} server: ${process.execPath} ${entry}`);
  serverExit = null;
  server = spawn(process.execPath, [entry], { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  server.stdout.on("data", (d) => openLog().write(d));
  server.stderr.on("data", (d) => openLog().write(d));
  server.on("error", (err) => { serverExit = { error: err.message }; note(`server failed to launch: ${err.message}`); });
  server.on("exit", (code, signal) => { serverExit = { code, signal }; note(`server exited (code ${code}, signal ${signal})`); });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server || server.exitCode !== null || serverExit) return resolve();
    server.once("exit", () => resolve());
    server.kill();
    setTimeout(resolve, 3000);
  });
}

/** Waits until the server listens. Gives up early if it crashes. Windows Defender can make the first launch slow. */
async function waitForServer(ms = 120000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (serverExit) return false;
    if (await portOpen()) { note(`server ready after ${((Date.now() - start) / 1000).toFixed(1)}s`); return true; }
    await new Promise((r) => setTimeout(r, 300));
  }
  note(`server not ready after ${ms / 1000}s`);
  return false;
}

function fail(message) {
  if (splash && !splash.isDestroyed()) splash.destroy();
  const tail = logTail();
  dialog.showErrorBox("Silver Wolf Bot", `${message}\n\nLog: ${logFile()}${tail ? `\n\nLast lines:\n${tail}` : ""}`);
  app.quit();
}

// ---------------------------------------------------------------- window

const SPLASH_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#05050b;color:#e6e6f0;font:14px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;-webkit-app-region:drag}
.box{text-align:center}.t{font-weight:700;letter-spacing:.2em;color:#a78bfa}.s{margin-top:10px;color:#8b8ba7}
.bar{margin:16px auto 0;width:180px;height:3px;background:#1a1a2e;overflow:hidden;border-radius:2px}
.bar i{display:block;width:40%;height:100%;background:#22d3ee;animation:m 1.1s ease-in-out infinite}
@keyframes m{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}</style></head>
<body><div class="box"><div class="t">SILVER WOLF BOT</div><div class="s">Booting up... first launch can take a minute.</div><div class="bar"><i></i></div></div></body></html>`;

function createSplash() {
  splash = new BrowserWindow({
    width: 420, height: 220, frame: false, resizable: false, show: true, backgroundColor: "#05050b",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: { sandbox: true, contextIsolation: true, javascript: false },
  });
  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`);
}

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
  win.once("ready-to-show", () => { win.show(); if (splash && !splash.isDestroyed()) splash.destroy(); splash = null; });

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
  if (await portOpen()) {
    dialog.showErrorBox("Silver Wolf Bot", `Port ${PORT} is already in use, so the app can't start.\n\nIf Silver Wolf Bot crashed earlier, end "Silver Wolf Bot" in Task Manager (Ctrl+Shift+Esc) and try again.`);
    app.quit();
    return;
  }
  createSplash();
  try {
    startServer();
  } catch (err) {
    fail(String(err && err.message ? err.message : err));
    return;
  }
  if (!(await waitForServer())) {
    fail(serverExit ? "The app server stopped while starting." : "The app server didn't start within 2 minutes.");
    return;
  }
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("before-quit", () => { app.isQuitting = true; });
app.on("window-all-closed", async () => { if (splash) return; await stopServer(); app.quit(); });
app.on("will-quit", () => { if (server && server.exitCode === null) server.kill(); });
