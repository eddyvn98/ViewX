/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, Menu, Tray, shell, ipcMain, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const APP_NAME = "Vivutrade Desktop Native";
const APP_USER_MODEL_ID = "vn.vivutrade.desktop.native.v2";
const DEFAULT_SETTINGS = {
  desktopUrl: "https://vivutrade.io.vn/vi/chart",
  nodeWsUrl: "wss://api.vivutrade.io.vn",
  accessToken: "",
  autoStartBridge: true,
};

let mainWindow = null;
let tray = null;
let settings = { ...DEFAULT_SETTINGS };
let bridgeProcess = null;
let bridgeStatus = "idle";
let isQuitting = false;
let bridgeBooting = false;
const managedWindows = new Set();
const tokenSyncTimers = new Map();
let authSnifferInstalled = false;
const desktopStatusSubscribers = new Set();
const WINDOW_CONTROLS_SAFE_CSS = `
  :root {
    --vt-native-top-safe: 40px;
    --vt-native-right-safe: 150px;
  }
  body {
    padding-top: var(--vt-native-top-safe) !important;
  }
  header,
  [class*="header"],
  [class*="Header"],
  [class*="topbar"],
  [class*="TopBar"],
  [class*="toolbar"],
  [class*="Toolbar"] {
    padding-right: var(--vt-native-right-safe) !important;
  }
`;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function resolveDevBridgeSourceDir() {
  const candidates = [
    path.join(__dirname, "bridge-dist"),
    path.join(__dirname, "build-resources", "bridge"),
    path.join(__dirname, "..", "public", "downloads", "desktop-native", "win-unpacked", "resources", "bridge"),
    path.join(__dirname, "..", "public", "downloads", "installer", "assets", "bridge", "dist"),
    path.join(__dirname, "..", "public", "downloads", "installer", "assets", "bridge"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

function resolvePaths() {
  const userData = app.getPath("userData");
  const logsDir = path.join(userData, "logs");
  const settingsPath = path.join(userData, "settings.json");
  const venvDir = path.join(userData, "bridge-venv");
  const bridgeRuntimeDir = path.join(userData, "bridge-runtime");
  const bridgeSourceDir = app.isPackaged
    ? path.join(process.resourcesPath, "bridge")
    : resolveDevBridgeSourceDir();

  return {
    userData,
    logsDir,
    settingsPath,
    venvDir,
    bridgeRuntimeDir,
    bridgeSourceDir,
    bridgeOutLog: path.join(logsDir, "bridge-native.out.log"),
    bridgeErrLog: path.join(logsDir, "bridge-native.err.log"),
    appLog: path.join(logsDir, "desktop-native.log"),
  };
}

function logLine(message) {
  const p = resolvePaths();
  fs.mkdirSync(p.logsDir, { recursive: true });
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(p.appLog, line, "utf8");
}

function getDesktopStatusPayload() {
  return {
    isNativeDesktop: true,
    bridgeStatus,
    hasAccessToken: Boolean(settings.accessToken),
    autoStartBridge: Boolean(settings.autoStartBridge),
    desktopUrl: settings.desktopUrl || DEFAULT_SETTINGS.desktopUrl,
    nodeWsUrl: settings.nodeWsUrl || DEFAULT_SETTINGS.nodeWsUrl,
    logsDir: resolvePaths().logsDir,
    settingsPath: resolvePaths().settingsPath,
  };
}

function broadcastDesktopStatus() {
  const payload = getDesktopStatusPayload();
  for (const win of desktopStatusSubscribers) {
    try {
      if (!win || win.isDestroyed()) continue;
      win.webContents.send("desktop:status", payload);
    } catch {
      // ignore renderer failures
    }
  }
}

function loadSettings() {
  const p = resolvePaths();
  let repoAccessToken = "";
  let repoNodeWsUrl = "";
  let localInstallerAccessToken = "";
  let localInstallerWsUrl = "";
  if (!app.isPackaged) {
    try {
      const envPath = path.join(__dirname, "..", ".env");
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
        for (const line of lines) {
          if (line.startsWith("ACCESS_TOKEN=")) repoAccessToken = line.slice("ACCESS_TOKEN=".length).trim();
          if (line.startsWith("NODE_WS_URL=")) repoNodeWsUrl = line.slice("NODE_WS_URL=".length).trim();
        }
      }
    } catch {
      // ignore
    }
  }
  try {
    const installerEnvPath = path.join(process.env.LOCALAPPDATA || "", "VivutradeProInstaller", "assets", ".env");
    if (installerEnvPath && fs.existsSync(installerEnvPath)) {
      const lines = fs.readFileSync(installerEnvPath, "utf8").split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith("ACCESS_TOKEN=")) localInstallerAccessToken = line.slice("ACCESS_TOKEN=".length).trim();
        if (line.startsWith("NODE_WS_URL=")) localInstallerWsUrl = line.slice("NODE_WS_URL=".length).trim();
      }
    }
  } catch {
    // ignore
  }
  const envDefaults = {
    desktopUrl: process.env.VIVUTRADE_DESKTOP_URL || DEFAULT_SETTINGS.desktopUrl,
    nodeWsUrl:
      process.env.VIVUTRADE_NODE_WS_URL ||
      process.env.NODE_WS_URL ||
      repoNodeWsUrl ||
      localInstallerWsUrl ||
      DEFAULT_SETTINGS.nodeWsUrl,
    accessToken:
      process.env.VIVUTRADE_ACCESS_TOKEN ||
      process.env.ACCESS_TOKEN ||
      repoAccessToken ||
      localInstallerAccessToken ||
      "",
  };

  fs.mkdirSync(p.userData, { recursive: true });
  if (!fs.existsSync(p.settingsPath)) {
    settings = { ...DEFAULT_SETTINGS, ...envDefaults };
    fs.writeFileSync(p.settingsPath, JSON.stringify(settings, null, 2), "utf8");
    return;
  }
  try {
    const raw = fs.readFileSync(p.settingsPath, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    settings = { ...DEFAULT_SETTINGS, ...envDefaults, ...parsed };
  } catch {
    settings = { ...DEFAULT_SETTINGS, ...envDefaults };
  }

  // Auto-heal wrong local WS endpoint when desktop is running on production domain.
  const isProdDesktop =
    typeof settings.desktopUrl === "string" &&
    /https?:\/\/(www\.)?vivutrade\.io\.vn/i.test(settings.desktopUrl);
  const isLocalWs =
    typeof settings.nodeWsUrl === "string" &&
    /^ws:\/\/(127\.0\.0\.1|localhost):\d+/i.test(settings.nodeWsUrl);
  if (isProdDesktop && isLocalWs) {
    settings.nodeWsUrl = "wss://api.vivutrade.io.vn";
    persistSettings();
    logLine("nodeWsUrl auto-healed to production endpoint");
  }
}

function persistSettings() {
  const p = resolvePaths();
  fs.mkdirSync(p.userData, { recursive: true });
  fs.writeFileSync(p.settingsPath, JSON.stringify(settings, null, 2), "utf8");
  broadcastDesktopStatus();
}

function normalizeToken(token) {
  if (!token || typeof token !== "string") return "";
  return token.trim().replace(/^Bearer\s+/i, "");
}

function scoreToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return 0;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const type = String(payload.type || payload.tokenType || payload.typ || "").toLowerCase();
    if (type === "access") return 100;
    if (type === "refresh") return 10;
    return 50;
  } catch {
    return 1;
  }
}

async function syncAccessTokenFromWindow(win) {
  if (!win || win.isDestroyed()) return;
  const fromStorage = await win.webContents
    .executeJavaScript(
      `(() => {
        const out = [];
        const directKeys = ['auth_access_token','accessToken','access_token','authAccessToken','token','authToken','jwt','id_token'];
        const stores = [];
        try { stores.push(localStorage); } catch {}
        try { stores.push(sessionStorage); } catch {}
        for (const store of stores) {
          for (const k of directKeys) {
            try {
              const v = store.getItem(k);
              if (v && typeof v === 'string') out.push(v);
            } catch {}
          }
        }
        const jsonKeys = ['auth','user','session','auth_user','persist:auth','persist:user','persist:root'];
        for (const store of stores) {
          for (const k of jsonKeys) {
            try {
              const raw = store.getItem(k);
              if (!raw) continue;
              const parsed = JSON.parse(raw);
              const queue = [parsed];
              while (queue.length) {
                const cur = queue.shift();
                if (!cur || typeof cur !== 'object') continue;
                for (const [key, value] of Object.entries(cur)) {
                  if (value && typeof value === 'object') queue.push(value);
                  if (typeof value === 'string' && /token|jwt|access/i.test(key)) out.push(value);
                }
              }
            } catch {}
          }
        }
        return out;
      })();`,
      true
    )
    .catch(() => []);

  let cookieCandidates = [];
  try {
    cookieCandidates = await win.webContents.session.cookies.get({});
  } catch {
    cookieCandidates = [];
  }
  const fromCookies = cookieCandidates
    .filter((c) => /token|auth|jwt|access/i.test(c.name || ""))
    .map((c) => c.value)
    .filter(Boolean);

  const candidates = [...fromStorage, ...fromCookies]
    .map(normalizeToken)
    .filter((v) => v.length > 5);
  const sorted = candidates.sort((a, b) => scoreToken(b) - scoreToken(a));
  const nextToken = sorted[0] || "";
  if (!nextToken) return;
  applySyncedAccessToken(nextToken, "web_session");
}

function applySyncedAccessToken(token, source = "unknown") {
  const nextToken = normalizeToken(token);
  if (!nextToken) return;
  if (settings.accessToken === nextToken) return;
  const hadToken = Boolean(settings.accessToken);
  settings.accessToken = nextToken;
  persistSettings();
  logLine(`access token synced from ${source} updated=${hadToken ? "yes" : "no"}`);
  restartBridge();
}

function installAuthHeaderSniffer() {
  if (authSnifferInstalled) return;
  const filter = {
    urls: [
      "https://vivutrade.io.vn/*",
      "https://www.vivutrade.io.vn/*",
      "http://localhost:3000/*",
      "http://127.0.0.1:3000/*",
    ],
  };
  try {
    const ses = mainWindow && mainWindow.webContents ? mainWindow.webContents.session : null;
    if (!ses) return;
    ses.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
      try {
        const headers = details.requestHeaders || {};
        const authHeader = headers.Authorization || headers.authorization || "";
        const token = normalizeToken(String(authHeader));
        if (token) applySyncedAccessToken(token, "auth_header");
      } catch {
        // ignore
      }
      callback({ requestHeaders: details.requestHeaders });
    });
    authSnifferInstalled = true;
  } catch (error) {
    logLine(`auth sniffer install failed: ${error.message || error}`);
  }
}

function startTokenSyncLoop(win) {
  if (!win || win.isDestroyed()) return;
  stopTokenSyncLoop(win);
  const winId = typeof win.id === "number" ? win.id : null;
  if (!winId) return;
  const timer = setInterval(() => {
    if (!win || win.isDestroyed()) {
      stopTokenSyncLoop(win);
      return;
    }
    void syncAccessTokenFromWindow(win);
  }, 2500);
  tokenSyncTimers.set(winId, timer);
  void syncAccessTokenFromWindow(win);
}

function stopTokenSyncLoop(win) {
  if (!win) return;
  const winId = typeof win.id === "number" ? win.id : null;
  if (!winId) return;
  const timer = tokenSyncTimers.get(winId);
  if (timer) {
    clearInterval(timer);
    tokenSyncTimers.delete(winId);
  }
}

function updateTray() {
  if (!tray) return;
  tray.setToolTip(`${APP_NAME} - Bridge: ${bridgeStatus}`);
  const menu = Menu.buildFromTemplate([
    {
      label: "Open App",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { label: "Reload", click: () => mainWindow && mainWindow.webContents.reload() },
    { type: "separator" },
    { label: "Start Bridge", click: () => startBridge() },
    { label: "Stop Bridge", click: () => stopBridge() },
    { label: "Restart Bridge", click: () => restartBridge() },
    { type: "separator" },
    { label: "Open Logs", click: () => shell.openPath(resolvePaths().logsDir) },
    { label: "Open Settings", click: () => shell.openPath(resolvePaths().settingsPath) },
    { label: "Open Pricing", click: () => shell.openExternal("https://vivutrade.io.vn/vi/pricing") },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        stopBridge();
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function copyBridgeSource() {
  const p = resolvePaths();
  if (!fs.existsSync(p.bridgeSourceDir)) {
    const checked = p.bridgeSourceDir
      ? p.bridgeSourceDir
      : resolveDevBridgeSourceDir();
    throw new Error(`Missing bridge source: ${checked}`);
  }
  fs.mkdirSync(p.bridgeRuntimeDir, { recursive: true });
  fs.cpSync(p.bridgeSourceDir, p.bridgeRuntimeDir, {
    recursive: true,
    force: true,
  });
}

function writeBridgeEnv() {
  const p = resolvePaths();
  const envPath = path.join(p.bridgeRuntimeDir, ".env");
  const content = [
    `ACCESS_TOKEN=${settings.accessToken || ""}`,
    `NODE_WS_URL=${settings.nodeWsUrl || DEFAULT_SETTINGS.nodeWsUrl}`,
    "BRIDGE_CLIENT_MODE=service_bridge",
    "",
  ].join("\n");
  fs.writeFileSync(envPath, content, "utf8");
}

async function ensureBridgeDependencies() {
  copyBridgeSource();
  writeBridgeEnv();
}

function startBridgeProcess() {
  const p = resolvePaths();
  const bridgeExe = path.join(p.bridgeRuntimeDir, "mt5_bridge.exe");

  if (!fs.existsSync(bridgeExe)) {
    throw new Error(`Bridge executable not found in runtime dir: ${bridgeExe}`);
  }

  fs.mkdirSync(p.logsDir, { recursive: true });
  const outFd = fs.openSync(p.bridgeOutLog, "a");
  const errFd = fs.openSync(p.bridgeErrLog, "a");

  bridgeProcess = spawn(bridgeExe, [], {
    cwd: p.bridgeRuntimeDir,
    stdio: ["ignore", outFd, errFd],
    windowsHide: true,
    detached: false,
    env: {
      ...process.env,
      ACCESS_TOKEN: settings.accessToken || "",
      NODE_WS_URL: settings.nodeWsUrl || DEFAULT_SETTINGS.nodeWsUrl,
      BRIDGE_CLIENT_MODE: "service_bridge",
    },
  });

  bridgeStatus = "running";
  updateTray();
  broadcastDesktopStatus();
  logLine(`bridge started pid=${bridgeProcess.pid}`);

  bridgeProcess.on("exit", (code) => {
    bridgeProcess = null;
    bridgeStatus = "stopped";
    updateTray();
    broadcastDesktopStatus();
    logLine(`bridge stopped code=${code}`);
    if (!isQuitting && settings.autoStartBridge) {
      setTimeout(() => {
        void startBridge();
      }, 3000);
    }
  });
}

async function startBridge() {
  logLine(`startBridge called auto=${String(settings.autoStartBridge)} hasToken=${settings.accessToken ? "yes" : "no"} booting=${String(bridgeBooting)} running=${bridgeProcess ? "yes" : "no"}`);
  if (bridgeProcess || bridgeBooting) return;
  if (!settings.accessToken) {
    bridgeStatus = "missing_access_token";
    updateTray();
    broadcastDesktopStatus();
    logLine("bridge skipped: missing access token (edit settings.json)");
    return;
  }
  bridgeBooting = true;
  bridgeStatus = "starting";
  updateTray();
  broadcastDesktopStatus();
  try {
    await ensureBridgeDependencies();
    startBridgeProcess();
  } catch (error) {
    bridgeStatus = "error";
    updateTray();
    broadcastDesktopStatus();
    logLine(`bridge error: ${error.message || error}`);
  } finally {
    bridgeBooting = false;
  }
}

function stopBridge() {
  if (!bridgeProcess) return;
  try {
    bridgeProcess.kill();
  } catch {
    // ignore
  }
  bridgeProcess = null;
  bridgeStatus = "stopped";
  updateTray();
  broadcastDesktopStatus();
}

function restartBridge() {
  logLine("restartBridge called");
  stopBridge();
  void startBridge();
}

function createWindow() {
  mainWindow = new BrowserWindow(createNativeWindowOptions());
  setupNativeWindow(mainWindow);
  mainWindow.loadURL(settings.desktopUrl || DEFAULT_SETTINGS.desktopUrl);
}

function createNativeWindowOptions() {
  const iconIcoPath = path.join(__dirname, "assets", "vivutrade-logo.ico");
  const iconPngPath = path.join(__dirname, "assets", "vivutrade-logo.png");
  const iconPath = fs.existsSync(iconIcoPath) ? iconIcoPath : iconPngPath;
  return {
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    title: APP_NAME,
    autoHideMenuBar: true,
    backgroundColor: "#060b12",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#060b12",
      symbolColor: "#d1d5db",
      height: 34,
    },
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };
}

function setupNativeWindow(win) {
  managedWindows.add(win);
  desktopStatusSubscribers.add(win);
  const applyWindowControlsSafeArea = () => {
    win.webContents
      .insertCSS(WINDOW_CONTROLS_SAFE_CSS)
      .catch((error) => logLine(`insertCSS failed: ${error.message || error}`));
  };
  const openInMainWindow = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== "string") return;
    if (rawUrl.startsWith("mailto:") || rawUrl.startsWith("tel:")) {
      void shell.openExternal(rawUrl);
      return;
    }
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      void mainWindow.loadURL(rawUrl);
      return;
    }
    void shell.openExternal(rawUrl);
  };

  win.webContents.setWindowOpenHandler(() => {
    return { action: "allow", overrideBrowserWindowOptions: createNativeWindowOptions() };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!url || typeof url !== "string") return;
    if (url.startsWith("http://") || url.startsWith("https://")) return;
    event.preventDefault();
    openInMainWindow(url);
  });

  win.webContents.on("did-create-window", (childWindow) => {
    setupNativeWindow(childWindow);
  });
  win.webContents.on("did-finish-load", () => {
    applyWindowControlsSafeArea();
    startTokenSyncLoop(win);
  });
  win.webContents.on("did-navigate-in-page", () => void syncAccessTokenFromWindow(win));
  win.webContents.on("did-navigate", () => void syncAccessTokenFromWindow(win));

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on("closed", () => {
    stopTokenSyncLoop(win);
    managedWindows.delete(win);
    desktopStatusSubscribers.delete(win);
    if (win === mainWindow) mainWindow = null;
  });
}

function createTray() {
  const icoPath = path.join(__dirname, "assets", "vivutrade-logo.ico");
  const pngPath = path.join(__dirname, "assets", "vivutrade-logo.png");
  const trayIcon = nativeImage.createFromPath(fs.existsSync(icoPath) ? icoPath : pngPath);
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  updateTray();
}

app.whenReady().then(() => {
  app.setAppUserModelId(APP_USER_MODEL_ID);
  app.setName(APP_NAME);
  loadSettings();
  createWindow();
  installAuthHeaderSniffer();
  createTray();
  if (settings.autoStartBridge) {
    void startBridge();
  }
  broadcastDesktopStatus();
  logLine(`desktop ready packaged=${String(app.isPackaged)} bridgeSource=${resolvePaths().bridgeSourceDir || "missing"}`);
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
  stopBridge();
});

app.on("window-all-closed", () => {
  // Keep tray app alive on Windows.
});

ipcMain.handle("desktop:openExternal", async (_event, url) => {
  if (!url || typeof url !== "string") return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("desktop:getStatus", async () => getDesktopStatusPayload());
ipcMain.handle("desktop:openLogs", async () => shell.openPath(resolvePaths().logsDir));
ipcMain.handle("desktop:openSettings", async () => shell.openPath(resolvePaths().settingsPath));
ipcMain.handle("desktop:restartBridge", async () => {
  restartBridge();
  return getDesktopStatusPayload();
});
