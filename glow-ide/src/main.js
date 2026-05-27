"use strict";

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, Notification } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const cp = require("child_process");

// ─── Load central config ──────────────────────────────────────────────────────
const configPath = path.join(__dirname, "..", "glow-config.js");
let glowConfig = safeLoadConfig(configPath);

function safeLoadConfig(p) {
  try {
    delete require.cache[require.resolve(p)];
    return require(p);
  } catch (e) {
    console.error("Failed to load glow-config.js:", e.message);
    return { version: "1.0.0", updates: { enabled: false }, libraries: [], examples: [], docs: [], about: {} };
  }
}

// ─── Load updater (gracefully — doesn't crash if GitHub unreachable) ──────────
const { checkForUpdates } = require("./updater");

// ─── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;
let glowProcess = null;
let isDestroying = false;
let closeTimer = null;
let prefs = null;
let prefsPath = null;
let sketchbookPath = null;

// ─── Paths ────────────────────────────────────────────────────────────────────
function getGlowRoot() {
  // In a packaged app:  resources/app/  →  go up to find install root
  // In dev:             glow-ide/src/   →  go up two to project root
  if (app.isPackaged) {
    return path.dirname(app.getPath("exe"));
  }
  return path.resolve(__dirname, "..", "..");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getDefaultSketchbookPath() {
  const drive = path.parse(process.cwd()).root || "C:\\";
  const primary = path.join(drive, "Glow-Sketchbook");
  try { return ensureDir(primary); } catch (_) {
    return ensureDir(path.join(app.getPath("documents"), "Glow-Sketchbook"));
  }
}

// ─── Preferences ─────────────────────────────────────────────────────────────
function defaultPrefs() {
  return {
    version: 1,
    glowVersion: glowConfig.version,
    sketchbookPath: getDefaultSketchbookPath(),
    recentFiles: [],
    theme: "dark",
    autocomplete: true,
    liveErrors: true,
    autoClosePairs: true,
  };
}

function loadPreferences() {
  const root = getGlowRoot();
  ensureDir(root);
  prefsPath = path.join(root, "glow-preferences.json");
  try {
    const raw = JSON.parse(fs.readFileSync(prefsPath, "utf8"));
    prefs = { ...defaultPrefs(), ...raw };
  } catch (_) {
    prefs = defaultPrefs();
  }
  sketchbookPath = ensureDir(prefs.sketchbookPath || getDefaultSketchbookPath());
  prefs.sketchbookPath = sketchbookPath;
  savePreferences();
}

function savePreferences() {
  if (!prefsPath || !prefs) return;
  try { fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), "utf8"); } catch (_) { }
}

function addRecent(filePath) {
  if (!filePath || !prefs) return;
  const norm = path.resolve(filePath);
  prefs.recentFiles = [norm, ...(prefs.recentFiles || []).filter(p => path.resolve(p) !== norm)].slice(0, 10);
  savePreferences();
}

// ─── Sketch helpers ───────────────────────────────────────────────────────────
function toSketchName(name) {
  const base = path.basename(name || "untitled", path.extname(name || ""));
  return (base || "untitled").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "untitled";
}
function isInSketchbook(fp) {
  if (!fp || !sketchbookPath) return false;
  const rel = path.relative(sketchbookPath, path.resolve(fp));
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}
function resolvedSavePath(filePath) {
  if (filePath && path.isAbsolute(filePath)) return filePath;
  const name = toSketchName(filePath || "untitled");
  const dir = ensureDir(path.join(sketchbookPath, name));
  return path.join(dir, `${name}.glow`);
}

// ─── Interpreter discovery ────────────────────────────────────────────────────
function findInterpreterSync() {
  const root = getGlowRoot();
  const candidates = [
    path.join(root, "glow-language-new", "dist", "glow.js"),
    path.join(root, "glow-language", "dist", "glow.js"),
    path.join(root, "resources", "glow", "dist", "glow.js"),   // packaged
    path.join(__dirname, "..", "..", "glow-language-new", "dist", "glow.js"),
    path.join(__dirname, "..", "..", "glow-language", "dist", "glow.js"),
  ];
  return candidates.find(c => fs.existsSync(c)) || null;
}

// ─── Create Window ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    backgroundColor: "#0e0e12",
    frame: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, "..", "assets", "icon.png"),
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.on("close", e => {
    if (isDestroying) return;
    e.preventDefault();
    mainWindow.webContents.send("app-close-requested");
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      isDestroying = true; mainWindow.destroy();
    }, 8000);
  });

  // Schedule update check after window loads
  mainWindow.webContents.once("did-finish-load", () => {
    setTimeout(runUpdateCheck, 3000);
    const { updates } = glowConfig;
    if (updates?.enabled) {
      setInterval(runUpdateCheck, updates.checkIntervalMs || 3600000);
    }
  });
}

async function runUpdateCheck() {
  try {
    await checkForUpdates({ config: glowConfig, mainWindow, configPath });
  } catch (e) {
    // Silent — don't crash IDE over network issues
  }
}

// ─── IPC: App info ────────────────────────────────────────────────────────────
ipcMain.handle("get-app-info", () => ({
  version: glowConfig.version,
  interpreterPath: findInterpreterSync(),
  sketchbookPath,
  prefsPath,
  config: {
    about: glowConfig.about,
    libraries: glowConfig.libraries,
    examples: glowConfig.examples,
    docs: glowConfig.docs,
  },
  prefs,
}));

ipcMain.handle("get-preferences", () => ({ ok: true, preferences: prefs, sketchbookPath }));

ipcMain.handle("save-preferences", (_e, updates) => {
  prefs = { ...prefs, ...updates };
  savePreferences();
  return { ok: true };
});

ipcMain.handle("get-recent-files", () => {
  const files = (prefs?.recentFiles || []).filter(p => fs.existsSync(p));
  if (prefs) { prefs.recentFiles = files; savePreferences(); }
  return { ok: true, recentFiles: files };
});

ipcMain.handle("open-recent-file", (_e, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return { error: "File no longer exists." };
    const content = fs.readFileSync(filePath, "utf8");
    addRecent(filePath);
    return { ok: true, filePath, content };
  } catch (e) { return { error: e.message }; }
});

// ─── IPC: Files ───────────────────────────────────────────────────────────────
ipcMain.handle("file-open", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Open Glow File",
    defaultPath: sketchbookPath,
    filters: [{ name: "Glow Files", extensions: ["glow"] }, { name: "All Files", extensions: ["*"] }],
    properties: ["openFile"],
  });
  if (res.canceled || !res.filePaths.length) return { canceled: true };
  try {
    const filePath = res.filePaths[0];
    const content = fs.readFileSync(filePath, "utf8");
    addRecent(filePath);
    return { ok: true, filePath, content };
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle("file-save", async (_e, { filePath, content }) => {
  try {
    const target = filePath && path.isAbsolute(filePath) ? filePath : resolvedSavePath(filePath);
    ensureDir(path.dirname(target));
    fs.writeFileSync(target, content, "utf8");
    addRecent(target);
    return { ok: true, filePath: target };
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle("file-save-as", async (_e, { content, defaultName }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: "Save Glow Sketch",
    defaultPath: path.join(sketchbookPath, (toSketchName(defaultName || "untitled")) + ".glow"),
    filters: [{ name: "Glow Files", extensions: ["glow"] }, { name: "All Files", extensions: ["*"] }],
  });
  if (res.canceled) return { canceled: true };
  try {
    ensureDir(path.dirname(res.filePath));
    fs.writeFileSync(res.filePath, content, "utf8");
    addRecent(res.filePath);
    return { ok: true, filePath: res.filePath };
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle("show-unsaved-dialog", async (_e, fileName) => {
  const res = await dialog.showMessageBox(mainWindow, {
    type: "warning", title: "Unsaved Changes",
    message: `"${fileName}" has unsaved changes.`,
    detail: "Do you want to save before closing?",
    buttons: ["Save", "Don't Save", "Cancel"],
    defaultId: 0, cancelId: 2,
  });
  return res.response;
});

ipcMain.on("confirm-close", () => {
  clearTimeout(closeTimer);
  if (glowProcess) { glowProcess.kill(); glowProcess = null; }
  isDestroying = true;
  mainWindow.destroy();
});

ipcMain.on("cancel-close", () => clearTimeout(closeTimer));


ipcMain.on("config-reloaded", (_e, newConfig) => {
  if (newConfig && newConfig.version) {
    glowConfig = newConfig;
    // Broadcast to renderer so UI updates
    mainWindow.webContents.send("app-config-updated", glowConfig);
  }
});

// ─── IPC: Find interpreter ────────────────────────────────────────────────────
ipcMain.handle("find-interpreter", () => {
  const p = findInterpreterSync();
  return p ? { found: true, path: p } : { found: false };
});

// ─── IPC: Run / Stop ──────────────────────────────────────────────────────────
function sendStreamLine(channel, text) {
  if (!mainWindow || mainWindow.isDestroyed() || !text) return;
  mainWindow.webContents.send(channel, text.replace(/\r$/, ""));
}

function startGlowProcess(glowJs, filePath) {
  if (glowProcess) { glowProcess.kill(); glowProcess = null; }

  const cwd = path.dirname(filePath);
  glowProcess = cp.spawn("node", [glowJs, filePath], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
    detached: true,  // ← add this
  });

  function cleanErrorMessage(line) {
    // Remove temp folder path and timestamp: "/path/to/1779850019705-untitled.glow:" → "untitled.glow:"
    line = line.replace(/.*[/\\](\d+-)?(.+?\.glow)/, "$2");
    return line;
  }

  const bindStream = (stream, channel) => {
    let buf = "";
    stream.on("data", chunk => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        const cleaned = cleanErrorMessage(line);
        sendStreamLine(channel, cleaned);
      }
      // Flush if looks like an input prompt (ends with punctuation+space)
      if (buf && /[:?>\]]\s*$/.test(buf)) {
        const cleaned = cleanErrorMessage(buf);
        sendStreamLine(channel, cleaned);
        buf = "";
        mainWindow?.webContents.send("run-input");
      }
    });
    return () => {
      if (buf) {
        const cleaned = cleanErrorMessage(buf);
        sendStreamLine(channel, cleaned);
      } buf = "";
    };
  };

  const flushOut = bindStream(glowProcess.stdout, "run-output");
  const flushErr = bindStream(glowProcess.stderr, "run-error");

  glowProcess.on("close", code => {
    flushOut(); flushErr();
    mainWindow?.webContents.send("run-done", code ?? 0);
    glowProcess = null;
  });
  glowProcess.on("error", err => {
    mainWindow?.webContents.send("run-error", "Failed to start: " + err.message);
    mainWindow?.webContents.send("run-done", 1);
    glowProcess = null;
  });
}

// Run from source (writes to temp file — no save needed)
ipcMain.on("run-source", (_e, { glowJs, source, fileName }) => {
  try {
    const tempDir = ensureDir(path.join(os.tmpdir(), "glow-ide"));
    const safeName = (fileName || "untitled.glow").replace(/[^a-z0-9_.-]/gi, "_");
    const tempFile = path.join(tempDir, Date.now() + "-" + safeName);
    fs.writeFileSync(tempFile, source || "", "utf8");
    startGlowProcess(glowJs, tempFile);
  } catch (e) {
    mainWindow?.webContents.send("run-error", "Failed to prepare run: " + e.message);
    mainWindow?.webContents.send("run-done", 1);
  }
});

// Run from a saved file path
ipcMain.on("run-file", (_e, { glowJs, filePath }) => startGlowProcess(glowJs, filePath));

ipcMain.on("stop-file", () => {
  if (glowProcess) {
    try {
      process.kill(-glowProcess.pid, "SIGKILL");
    } catch (_) {
      glowProcess.kill("SIGKILL");
    }
    glowProcess = null;
  }
});

ipcMain.on("send-input", (_e, text) => { if (glowProcess?.stdin) glowProcess.stdin.write(text); });

ipcMain.on("download-update", async (_e, downloadUrl) => {
  try {
    const https = require('https');
    const fs = require('fs');
    const path = require('path');

    const downloadsPath = app.getPath("downloads");
    const installerPath = path.join(downloadsPath, "Glow-Setup.exe");

    console.log(`Downloading update from: ${downloadUrl}`);

    const file = fs.createWriteStream(installerPath);

    https.get(downloadUrl, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (redirectRes) => {
          redirectRes.pipe(file);
        });
      } else {
        response.pipe(file);
      }
    }).on('error', (err) => {
      fs.unlink(installerPath, () => { });
      mainWindow?.webContents.send("run-error", "Download failed: " + err.message);
    });

    file.on('finish', () => {
      file.close();
      console.log(`Downloaded to: ${installerPath}`);

      // Wait 500ms for file system to finish, then run installer
      setTimeout(() => {
        try {
          cp.spawn(installerPath, ['/S'], { detached: true });

          // Close app after installer starts 
          setTimeout(() => {
            isDestroying = true;
            mainWindow.destroy();
            app.quit();
          }, 1000);
        } catch (err) {
          mainWindow?.webContents.send("run-error", "Failed to run installer: " + err.message);
        }
      }, 500);
    });
  } catch (err) {
    mainWindow?.webContents.send("run-error", "Update failed: " + err.message);
  }
});

// ─── IPC: Update actions ──────────────────────────────────────────────────────
ipcMain.on("open-download-url", (_e, url) => shell.openExternal(url));
ipcMain.on("open-external", (_e, url) => shell.openExternal(url));

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  loadPreferences();
  Menu.setApplicationMenu(null);
  createWindow();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
