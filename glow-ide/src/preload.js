"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("glowAPI", {
  // App info & config
  getAppInfo: () => ipcRenderer.invoke("get-app-info"),
  findInterpreter: () => ipcRenderer.invoke("find-interpreter"),

  // Preferences
  getPreferences: () => ipcRenderer.invoke("get-preferences"),
  savePreferences: (prefs) => ipcRenderer.invoke("save-preferences", prefs),
  getRecentFiles: () => ipcRenderer.invoke("get-recent-files"),
  openRecentFile: (p) => ipcRenderer.invoke("open-recent-file", p),

  // Files
  fileOpen: () => ipcRenderer.invoke("file-open"),
  fileSave: (args) => ipcRenderer.invoke("file-save", args),
  fileSaveAs: (args) => ipcRenderer.invoke("file-save-as", args),
  showUnsavedDialog: (name) => ipcRenderer.invoke("show-unsaved-dialog", name),
  confirmClose: () => ipcRenderer.send("confirm-close"),
  cancelClose: () => ipcRenderer.send("cancel-close"),

  // Run / Stop  (run-source = run without saving first)
  runSource: (args) => ipcRenderer.send("run-source", args),
  runFile: (args) => ipcRenderer.send("run-file", args),
  stopFile: () => ipcRenderer.send("stop-file"),
  sendInput: (text) => ipcRenderer.send("send-input", text),

  // Run event listeners
  onRunOutput: (cb) => ipcRenderer.on("run-output", (_e, d) => cb(d)),
  onRunError: (cb) => ipcRenderer.on("run-error", (_e, d) => cb(d)),
  onRunDone: (cb) => ipcRenderer.on("run-done", (_e, d) => cb(d)),
  onRunInput: (cb) => ipcRenderer.on("run-input", () => cb()),

  // App lifecycle
  onCloseRequested: (cb) => ipcRenderer.on("app-close-requested", cb),

  // Updates
  onUpdateAvailable: (cb) => ipcRenderer.on("update-available", (_e, d) => cb(d)),
  onConfigReloaded: (cb) => ipcRenderer.on("config-reloaded", (_e, d) => cb(d)),
  openDownloadUrl: (url) => ipcRenderer.send("open-download-url", url),

  // Misc
  openExternal: (url) => ipcRenderer.send("open-external", url),
});

ipcRenderer.on("app-config-updated", (event, newConfig) => {
  if (window._onConfigUpdated) {
    window._onConfigUpdated(newConfig);
  }
});
