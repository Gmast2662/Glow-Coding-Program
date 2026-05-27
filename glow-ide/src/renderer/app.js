// ─────────────────────────────────────────────────────────────────────────────
// Glow IDE — app.js
// Renderer process: editor, file ops, console, run/stop, modals
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  filePath: null,     // current file path (null = untitled)
  fileName: "untitled.glow",
  isDirty: false,    // unsaved changes?
  isRunning: false,    // glow process active?
  glowJs: null,     // path to dist/glow.js
  childProc: null,     // running child process
  waitingInput: false,    // process waiting for input()?
  diagnostics: [],
  completionIndex: 0,
  completions: [],
  settings: {
    theme: "dark",
    autocomplete: true,
    autoclose: true,
    diagnostics: true,
  },
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const editor = $("editor");
const editorHighlight = $("editor-highlight");
const autocompleteBox = $("autocomplete-box");
const diagnosticsPanel = $("diagnostics-panel");
const lineNumbers = $("line-numbers");
const editorScroll = $("editor-scroll");
const consoleOutput = $("console-output");
const consoleInput = $("console-input");
const consoleInputRow = $("console-input-row");
const fileTabName = $("file-tab-name");
const fileTabDirty = $("file-tab-dirty");
const consoleStatus = $("console-status");
const btnRun = $("btn-run");
const btnStop = $("btn-stop");
const modalOverlay = $("modal-overlay");

const KEYWORDS = new Set(["var", "func", "return", "if", "else", "while", "repeat", "for", "in", "import", "true", "false", "and", "or", "not", "exit"]);
const BUILTINS = [
  "print", "input", "toNumber", "toStr", "typeOf", "isNumber", "len", "upper", "lower", "trim", "replace", "format", "contains",
  "floor", "ceil", "round", "abs", "sqrt", "pow", "clamp", "max", "min", "random", "range",
  "fileExists", "readFile", "writeFile", "appendFile", "deleteFile", "exit",
];
let diagnosticsTimer = null;
let autocompleteTimer = null;
let highlightFrame = null;

// ─── Startup ──────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  loadSettings();
  updateLineNumbers();
  refreshEditorDecorations();
  updateTabTitle();

  // ── Load app info + config from main process ──────────────────────────────
  try {
    const info = await window.glowAPI.getAppInfo();
    if (info) {
      window._glowAppInfo = info;  // store globally for About modal etc.
      state.glowJs = info.interpreterPath;

      const versionEl = document.getElementById("version-text");
      if (versionEl && info.version) {
        versionEl.textContent = info.version;
      }

      // Load from config
      if (info.config?.libraries?.length) {
        LIBRARIES.length = 0;
        LIBRARIES.push(...info.config.libraries);
      }
      if (info.config?.examples?.length) {
        EXAMPLES.length = 0;
        EXAMPLES.push(...info.config.examples);
      }
      if (info.config?.docs?.length) {
        DOCS_LIST.length = 0;
        DOCS_LIST.push(...info.config.docs);
      }

      // Load preferences from main
      if (info.prefs?.theme) applyTheme(info.prefs.theme);
      if (info.prefs?.autocomplete !== undefined) state.settings.autocomplete = info.prefs.autocomplete;
      if (info.prefs?.liveErrors !== undefined) state.settings.diagnostics = info.prefs.liveErrors;
      if (info.prefs?.autoClosePairs !== undefined) state.settings.autoclose = info.prefs.autoClosePairs;
    }
  } catch (e) { /* non-fatal */ }

  if (state.glowJs) {
    conLine("✦ Glow IDE ready. Press Run or F5 to run your sketch.", "con-info");
  } else {
    // Fallback to direct findInterpreter
    const result = await window.glowAPI.findInterpreter();
    if (result.found) {
      state.glowJs = result.path;
      conLine("✦ Glow IDE ready. Press Run or F5 to run your sketch.", "con-info");
    } else {
      conLine("⚠ Glow interpreter not found. Place the glow-language folder next to this IDE.", "con-err");
    }
  }

  // Handle window close
  window.glowAPI.onCloseRequested(() => handleClose());

  // ── Update notifications ──────────────────────────────────────────────────
  if (window.glowAPI.onUpdateAvailable) {
    window.glowAPI.onUpdateAvailable(data => showUpdateNotification(data));
  }
  if (window.glowAPI.onConfigReloaded) {
    window.glowAPI.onConfigReloaded(newConfig => {
      // Reload preferences
      window.glowAPI.getPreferences().then(result => {
        if (result.preferences?.theme) applyTheme(result.preferences.theme);
        if (result.preferences?.autocomplete !== undefined) state.settings.autocomplete = result.preferences.autocomplete;
        if (result.preferences?.liveErrors !== undefined) state.settings.diagnostics = result.preferences.liveErrors;
        if (result.preferences?.autoClosePairs !== undefined) state.settings.autoclose = result.preferences.autoClosePairs;
      });

      if (newConfig?.libraries?.length) {
        LIBRARIES.length = 0;
        LIBRARIES.push(...newConfig.libraries);
      }
      if (newConfig?.examples?.length) {
        EXAMPLES.length = 0;
        EXAMPLES.push(...newConfig.examples);
      }
      if (newConfig?.docs?.length) {
        DOCS_LIST.length = 0;
        DOCS_LIST.push(...newConfig.docs);
      }
      renderLibraryList();
      renderExamplesList();
      conLine("✦ Content updated automatically.", "con-success");
    });
  }

  // Init docs content
  renderDocsSection("basics");

  // Load library list
  renderLibraryList();

  // Load examples list
  renderExamplesList();

  // Load recent files
  refreshRecentFiles();
});

// ─── Update Notification ──────────────────────────────────────────────────────
function showUpdateNotification(data) {
  // Show a banner in the console
  conLine("", "con-divider");
  if (data.type === "patch") {
    conLine("✦ Content updated to v" + data.latest + ". New examples and libraries are available.", "con-success");
  } else if (data.type === "minor") {
    conLine("↑ Glow v" + data.latest + " is available (you have v" + data.current + ").", "con-info");
    conLine("  Download the new version from the Help menu.", "con-info");
    // Show banner in UI
    showUpdateBanner(data);
  } else if (data.type === "major") {
    conLine("↑ Glow v" + data.latest + " is available — a new installer is required.", "con-info");
    showUpdateBanner(data);
  }
}

function showUpdateBanner(data) {
  // Create a dismissible banner at the top of the editor pane
  const existing = document.getElementById("update-banner");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.id = "update-banner";
  banner.innerHTML = `
    <span>✦ Glow ${data.latest} is available</span>
    <button id="update-btn-download">Download</button>
    <button id="update-btn-dismiss">✕</button>
  `;
  banner.style.cssText = `
    display:flex; align-items:center; gap:10px; padding:6px 14px;
    background:var(--accent-dim); border-bottom:1px solid var(--accent);
    font-size:12px; color:var(--text-0); flex-shrink:0;
  `;
  banner.querySelector("#update-btn-download").style.cssText =
    "background:var(--accent);color:#fff;border:none;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:12px;";
  banner.querySelector("#update-btn-dismiss").style.cssText =
    "background:none;border:none;color:var(--text-2);cursor:pointer;font-size:14px;margin-left:auto;";

  banner.querySelector("#update-btn-download").addEventListener("click", () => {
    confirmUnsaved().then(ok => {
      if (!ok) return;

      // Show updating bar
      const updating = document.createElement("div");
      updating.id = "updating-bar";
      updating.innerHTML = `
          <span>⟳ Updating to v${data.latest}... Please wait, app will restart.</span>
        `;
      updating.style.cssText = `
          position:fixed; top:0; left:0; right:0; padding:12px; 
          background:var(--accent); color:#fff; text-align:center; 
          font-size:13px; z-index:10000;
        `;
      document.body.appendChild(updating);

      // Tell main process to download and apply update
      window.glowAPI.downloadAndApplyUpdate(data.downloadUrl);
    });
  });

  banner.querySelector("#update-btn-dismiss").addEventListener("click", () => banner.remove());

  const editorPane = document.getElementById("editor-pane");
  if (editorPane) editorPane.prepend(banner);
}

// ─── Apply theme (called from prefs) ─────────────────────────────────────────
function applyTheme(theme) {
  // CSS uses body.theme-X classes (dark is default, no class needed)
  document.body.classList.remove("theme-light", "theme-midnight", "theme-forest");
  if (theme && theme !== "dark") document.body.classList.add("theme-" + theme);
  // keep data-theme in sync too for any CSS that uses it
  document.documentElement.setAttribute("data-theme", theme || "dark");
}

function autoFormatCode() {
  const lines = editor.value.split("\n");
  let formatted = "";
  let indent = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) {
      formatted += "\n";
      continue;
    }

    if (line.startsWith("}") || line.startsWith("else")) indent = Math.max(0, indent - 1);
    formatted += "    ".repeat(indent) + line + "\n";
    if (line.endsWith("{")) indent++;
  }

  editor.value = formatted.trimEnd();
  setDirty(true);
  refreshEditorDecorations();
}

// LIBRARIES / EXAMPLES / DOCS_LIST are the mutable arrays used by render functions.
// They start as the static values defined below and get overridden by glow-config.js.
const DOCS_LIST = [];

// ─── Editor: Line Numbers ─────────────────────────────────────────────────────
function updateLineNumbers() {
  const lines = editor.value.split("\n");
  const activeLine = getActiveLine();
  const errorLines = new Set(state.diagnostics.map(d => d.line));
  lineNumbers.innerHTML = lines
    .map((_, i) => `<span class="${[i === activeLine ? "active" : "", errorLines.has(i) ? "error" : ""].filter(Boolean).join(" ")}">${i + 1}</span>`)
    .join("");
  // Sync scroll
  lineNumbers.scrollTop = editor.scrollTop;
}

function getActiveLine() {
  const text = editor.value.substring(0, editor.selectionStart);
  return text.split("\n").length - 1;
}

editor.addEventListener("input", () => {
  setDirty(true);
  state.diagnostics = [];
  updateDiagnosticsPanel();
  updateLineNumbers();
  scheduleEditorWork();
});

editor.addEventListener("keydown", e => {
  if (handleCompletionKeys(e)) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key === "/") {
    e.preventDefault();
    toggleLineComments();
    return;
  }

  if (ctrl && e.key.toLowerCase() === "t") {
    e.preventDefault();
    autoFormatCode();
    return;
  }

  // Tab → insert 4 spaces
  if (e.key === "Tab") {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.substring(0, start) + "    " + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 4;
    refreshEditorDecorations();
    setDirty(true);
  }
  // Auto-close braces
  const pairs = { "{": "}", "[": "]", "(": ")", "\"": "\"", "'": "'" };
  if (state.settings.autoclose && pairs[e.key]) {
    console.log("Autoclose enabled, inserting pair");
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    if (start === end) {
      e.preventDefault();
      const close = pairs[e.key];
      editor.value = editor.value.substring(0, start) + e.key + close + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 1;
      refreshEditorDecorations();
      setDirty(true);
    }
  }
  if (e.key === "Enter") {
    const pos = editor.selectionStart;
    const before = editor.value.substring(0, pos);
    const lineStart = before.lastIndexOf("\n") + 1;
    const currentLine = before.substring(lineStart);
    const indent = currentLine.match(/^(\s*)/)[1];
    const lastChar = before.trimEnd().slice(-1);

    if (lastChar === "{") {
      e.preventDefault();
      const extra = "    ";
      editor.value = before + "\n" + indent + extra + editor.value.substring(pos);
      editor.selectionStart = editor.selectionEnd = pos + indent.length + extra.length + 1;
      refreshEditorDecorations();
      setDirty(true);
    }
  }
});

editor.addEventListener("keyup", () => { updateLineNumbers(); });
editor.addEventListener("click", () => { updateLineNumbers(); hideAutocomplete(); });
editor.addEventListener("scroll", () => {
  lineNumbers.scrollTop = editor.scrollTop;
  editorHighlight.scrollTop = editor.scrollTop;
  editorHighlight.scrollLeft = editor.scrollLeft;
  hideAutocomplete();
});

// ─── Dirty / Tab Title ────────────────────────────────────────────────────────
function scheduleEditorWork() {
  if (highlightFrame === null) {
    highlightFrame = requestAnimationFrame(() => {
      highlightFrame = null;
      refreshEditorDecorations({ diagnostics: false });
    });
  }
  clearTimeout(diagnosticsTimer);
  clearTimeout(autocompleteTimer);
  diagnosticsTimer = setTimeout(() => refreshEditorDecorations({ diagnostics: true }), 800);
  autocompleteTimer = setTimeout(() => updateAutocomplete(), 1000);
}

function refreshEditorDecorations(options = {}) {
  if (options.diagnostics !== false) {
    state.diagnostics = state.settings.diagnostics ? getDiagnostics(editor.value) : [];
  }
  editorHighlight.innerHTML = highlightGlow(editor.value, state.diagnostics);
  updateDiagnosticsPanel();
  updateLineNumbers();
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

function highlightGlow(code, diagnostics = []) {
  const errorLines = new Set(diagnostics.map(d => d.line));
  return code.split("\n").map((line, index) => {
    const commentAt = findCommentIndex(line);
    const before = commentAt >= 0 ? line.slice(0, commentAt) : line;
    const comment = commentAt >= 0 ? line.slice(commentAt) : "";
    let html = highlightCodePart(before);
    if (comment) html += `<span class="syn-comment">${escapeHtml(comment)}</span>`;
    if (errorLines.has(index)) html = `<span class="syn-error">${html || " "}</span>`;
    return html || " ";
  }).join("\n");
}

function findCommentIndex(line) {
  let quote = null;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if ((ch === "\"" || ch === "'") && line[i - 1] !== "\\") quote = quote === ch ? null : (quote || ch);
    if (!quote && ch === "/" && line[i + 1] === "/") return i;
  }
  return -1;
}

function highlightCodePart(text) {
  const tokenRe = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[+\-*\/%=!<>]+)/g;
  let out = "";
  let last = 0;
  let match;
  while ((match = tokenRe.exec(text))) {
    const token = match[0];
    out += escapeHtml(text.slice(last, match.index));
    const nextChar = text.slice(tokenRe.lastIndex).trimStart()[0];
    let cls = "";
    if (/^["']/.test(token)) cls = "syn-string";
    else if (/^\d/.test(token)) cls = "syn-number";
    else if (KEYWORDS.has(token)) cls = "syn-keyword";
    else if (/^[+\-*\/%=!<>]+$/.test(token)) cls = "syn-op";
    else if (nextChar === "(") cls = "syn-func";
    else cls = "syn-var";
    out += `<span class="${cls}">${escapeHtml(token)}</span>`;
    last = tokenRe.lastIndex;
  }
  return out + escapeHtml(text.slice(last));
}

function getDiagnostics(code) {
  const diagnostics = [];
  const lines = code.split("\n");
  let braceBalance = 0;
  lines.forEach((line, index) => {
    const stripped = stripStringsAndComments(line);
    const trimmed = stripped.trim();
    for (const ch of stripped) {
      if (ch === "{") braceBalance++;
      if (ch === "}") braceBalance--;
    }
    if (braceBalance < 0) {
      diagnostics.push({ line: index, message: "Extra closing brace." });
      braceBalance = 0;
    }
    if (!trimmed || trimmed.startsWith("//") || trimmed === "{" || trimmed === "}") return;
    const knownStart = /^(var\b|func\b|return\b|if\b|else\b|while\b|repeat\b|for\b|import\b|exit\b|print\b|[A-Za-z_][A-Za-z0-9_]*\s*(=|\(|\.|\[)|\}?\s*else\b)/.test(trimmed);
    if (!knownStart) diagnostics.push({ line: index, message: "This does not look like valid Glow code." });
    if ((trimmed.startsWith("if") || trimmed.startsWith("while") || trimmed.startsWith("func") || trimmed.startsWith("else")) && !trimmed.includes("{")) {
      diagnostics.push({ line: index, message: "Expected an opening brace." });
    }
  });
  if (braceBalance > 0) diagnostics.push({ line: lines.length - 1, message: "Missing closing brace." });
  return diagnostics.slice(0, 6);
}

function stripStringsAndComments(line) {
  const commentAt = findCommentIndex(line);
  const noComment = commentAt >= 0 ? line.slice(0, commentAt) : line;
  return noComment.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "\"\"");
}

function updateDiagnosticsPanel() {
  if (!state.settings.diagnostics || state.diagnostics.length === 0) {
    diagnosticsPanel.classList.add("hidden");
    diagnosticsPanel.textContent = "";
    return;
  }
  const d = state.diagnostics[0];
  diagnosticsPanel.textContent = `Line ${d.line + 1}: ${d.message}`;
  diagnosticsPanel.classList.remove("hidden");
}

function getUserFunctions() {
  const found = [...editor.value.matchAll(/\bfunc\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map(m => m[1]);
  return [...new Set(found)];
}

function getImportedLibraryFunctions() {
  const imports = [...editor.value.matchAll(/\bimport\s+["']([^"']+)["']/g)].map(m => m[1]);
  if (!imports.length || typeof LIBRARIES === "undefined") return [];
  return LIBRARIES
    .filter(lib => imports.includes(lib.name) || imports.includes(lib.id))
    .flatMap(lib => lib.funcs || []);
}

function getCompletionPrefix() {
  const pos = editor.selectionStart;
  const before = editor.value.slice(0, pos);
  const match = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
  return match ? match[0] : "";
}

function updateAutocomplete(force = false) {
  if (!state.settings.autocomplete || document.activeElement !== editor) return hideAutocomplete();
  const prefix = getCompletionPrefix();
  if (!force && prefix.length === 0) return hideAutocomplete();
  const userFunctions = getUserFunctions();
  const importedFunctions = getImportedLibraryFunctions();
  const candidates = [...new Set([...BUILTINS, ...importedFunctions, ...userFunctions])].sort();
  const lower = prefix.toLowerCase();
  state.completions = candidates
    .filter(name => !prefix || name.toLowerCase().includes(lower))
    .slice(0, 10)
    .map(name => ({
      name,
      kind: userFunctions.includes(name) ? "func" : (importedFunctions.includes(name) ? "library" : "built-in"),
    }));
  state.completionIndex = 0;
  renderAutocomplete();
}

function renderAutocomplete() {
  if (!state.completions.length) return hideAutocomplete();
  autocompleteBox.innerHTML = state.completions.map((item, i) => `
    <div class="autocomplete-item ${i === state.completionIndex ? "active" : ""}" data-index="${i}" role="option">
      <span>${escapeHtml(item.name)}</span><span class="autocomplete-kind">${item.kind}</span>
    </div>
  `).join("");
  const coords = getCaretCoordinates();
  autocompleteBox.style.left = `${coords.left}px`;
  autocompleteBox.style.top = `${coords.top}px`;
  autocompleteBox.classList.remove("hidden");
  autocompleteBox.querySelectorAll(".autocomplete-item").forEach(item => {
    item.addEventListener("mousedown", e => {
      e.preventDefault();
      applyCompletion(Number(item.dataset.index));
    });
  });
}

function hideAutocomplete() {
  autocompleteBox.classList.add("hidden");
}

function handleCompletionKeys(e) {
  if (e.ctrlKey && e.key === " ") {
    e.preventDefault();
    updateAutocomplete(true);
    return true;
  }
  if (autocompleteBox.classList.contains("hidden")) return false;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    state.completionIndex = (state.completionIndex + 1) % state.completions.length;
    renderAutocomplete();
    return true;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    state.completionIndex = (state.completionIndex - 1 + state.completions.length) % state.completions.length;
    renderAutocomplete();
    return true;
  }
  if (e.key === "Tab" || e.key === "Enter") {
    e.preventDefault();
    applyCompletion(state.completionIndex);
    return true;
  }
  if (e.key === "Escape") {
    hideAutocomplete();
    return false;
  }
  return false;
}

function applyCompletion(index) {
  const item = state.completions[index];
  if (!item) return;
  const prefix = getCompletionPrefix();
  const end = editor.selectionStart;
  const start = end - prefix.length;
  editor.value = editor.value.slice(0, start) + item.name + editor.value.slice(editor.selectionEnd);
  editor.selectionStart = editor.selectionEnd = start + item.name.length;
  setDirty(true);
  refreshEditorDecorations();
  hideAutocomplete();
  editor.focus();
}

function getCaretCoordinates() {
  const pos = editor.selectionStart;
  const text = editor.value.slice(0, pos);
  const lines = text.split("\n");
  const line = lines.length - 1;
  const col = lines[lines.length - 1].length;
  const cs = getComputedStyle(editor);
  const lineHeight = parseFloat(cs.lineHeight);
  const charWidth = parseFloat(cs.fontSize) * 0.62;
  return {
    left: 16 + col * charWidth - editor.scrollLeft,
    top: 18 + (line + 1) * lineHeight - editor.scrollTop,
  };
}

function toggleLineComments() {
  const start = Math.min(editor.selectionStart, editor.selectionEnd);
  const end = Math.max(editor.selectionStart, editor.selectionEnd);
  const value = editor.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const adjustedEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const nextBreak = value.indexOf("\n", adjustedEnd);
  const finalEnd = nextBreak === -1 ? value.length : nextBreak;
  const block = value.slice(lineStart, finalEnd);
  const lines = block.split("\n");
  const uncomment = lines.every(line => line.trim() === "" || /^\s*\/\//.test(line));
  const changed = lines.map(line => {
    if (line.trim() === "") return line;
    return uncomment ? line.replace(/^(\s*)\/\/ ?/, "$1") : line.replace(/^(\s*)/, "$1// ");
  }).join("\n");
  editor.value = value.slice(0, lineStart) + changed + value.slice(finalEnd);
  editor.selectionStart = lineStart;
  editor.selectionEnd = lineStart + changed.length;
  setDirty(true);
  refreshEditorDecorations();
}

function setDirty(val) {
  state.isDirty = val;
  fileTabDirty.classList.toggle("hidden", !val);
}

function updateTabTitle() {
  fileTabName.textContent = state.fileName;
  document.title = state.isDirty
    ? `* ${state.fileName} - Glow IDE`
    : `${state.fileName} - Glow IDE`;
}

// ─── File Operations ──────────────────────────────────────────────────────────

async function fileNew() {
  if (!await confirmUnsaved()) return;
  editor.value = "";
  state.filePath = null;
  state.fileName = "untitled.glow";
  setDirty(false);
  updateTabTitle();
  refreshEditorDecorations();
  conLine("─── New file ───", "con-divider");
}

async function fileOpen() {
  if (!await confirmUnsaved()) return;
  const result = await window.glowAPI.fileOpen();
  if (result.canceled || result.error) return;
  loadFileResult(result);
}
async function fileSave() {
  if (!state.filePath) return fileSaveAs();
  const result = await window.glowAPI.fileSave({
    filePath: state.filePath,
    content: editor.value,
  });
  if (result.ok) {
    state.filePath = result.filePath;
    state.fileName = result.filePath.split(/[\\/]/).pop();
    setDirty(false);
    updateTabTitle();
    refreshRecentFiles();
    conLine(`Saved: ${state.fileName}`, "con-success");
  } else {
    conLine(`Save failed: ${result.error}`, "con-err");
  }
}
async function fileSaveAs() {
  const result = await window.glowAPI.fileSaveAs({ content: editor.value, defaultName: state.fileName });
  if (result.canceled) return;
  if (result.ok) {
    state.filePath = result.filePath;
    state.fileName = result.filePath.split(/[\\/]/).pop();
    setDirty(false);
    updateTabTitle();
    refreshRecentFiles();
    conLine(`Saved as: ${state.fileName}`, "con-success");
  } else {
    conLine(`Save failed: ${result.error}`, "con-err");
  }
}
function loadFileResult(result) {
  editor.value = result.content;
  state.filePath = result.filePath;
  state.fileName = result.filePath.split(/[\\/]/).pop();
  setDirty(false);
  updateTabTitle();
  refreshEditorDecorations();
  refreshRecentFiles();
  conLine(`Opened: ${state.fileName}`, "con-divider");
  editor.focus();
}

async function openRecentFile(filePath) {
  if (!await confirmUnsaved()) return;
  const result = await window.glowAPI.openRecentFile(filePath);
  if (result.error) {
    conLine(`Open recent failed: ${result.error}`, "con-err");
    refreshRecentFiles();
    return;
  }
  loadFileResult(result);
}

async function refreshRecentFiles() {
  if (!window.glowAPI.getRecentFiles) return;
  const result = await window.glowAPI.getRecentFiles();
  const menu = $("recent-files-menu");
  if (!menu || !result.ok) return;
  const files = result.recentFiles || [];
  if (!files.length) {
    menu.innerHTML = `<div class="dd-empty">No recent files</div>`;
    return;
  }
  menu.innerHTML = "";
  files.forEach(filePath => {
    const btn = document.createElement("button");
    btn.className = "dd-item recent-item";
    btn.type = "button";
    btn.textContent = filePath.split(/[\\/]/).pop();
    btn.title = filePath;
    btn.addEventListener("click", e => {
      closeAllMenus();
      openRecentFile(filePath);
      e.stopPropagation();
    });
    menu.appendChild(btn);
  });
}
async function fileClose() {
  if (!await confirmUnsaved()) return;
  editor.value = "";
  state.filePath = null;
  state.fileName = "untitled.glow";
  setDirty(false);
  updateTabTitle();
  refreshEditorDecorations();
}

// Returns true if it's safe to proceed (saved or discarded)
async function confirmUnsaved() {
  if (!state.isDirty) return true;
  const response = await window.glowAPI.showUnsavedDialog(state.fileName);
  if (response === 0) { await fileSave(); return true; }  // Save
  if (response === 1) return true;                         // Don't save
  return false;                                            // Cancel
}

// Close the whole app
async function handleClose() {
  if (state.isDirty) {
    window.glowAPI.cancelClose();
    const response = await window.glowAPI.showUnsavedDialog(state.fileName);
    if (response === 0) { await fileSave(); window.glowAPI.confirmClose(); return; }
    if (response === 1) { window.glowAPI.confirmClose(); return; }
    window.glowAPI.cancelClose();
    // Cancel → do nothing, stay open
  } else {
    window.glowAPI.confirmClose();
  }
}

// ─── Run / Stop ───────────────────────────────────────────────────────────────
// We use Electron's shell + Node child_process via IPC.
// The main process spawns the glow interpreter and streams stdout/stderr back.
// We add IPC channels for this in main.js as part of stage 2;
// for now, Run shows a placeholder and sets up the UI state correctly.

async function runSketch() {
  if (state.isRunning) return;
  if (!state.glowJs) {
    conLine("Cannot run - Glow interpreter not found.", "con-err");
    return;
  }

  clearConsole(true);
  setRunning(true);
  conLine(`\n>  Running: ${state.fileName}`, "con-info");
  conLine("-".repeat(44), "con-divider");

  window.glowAPI.runSource({
    glowJs: state.glowJs,
    source: editor.value,
    fileName: state.fileName,
    runCwd: state.filePath ? state.filePath.replace(/[\\/][^\\/]*$/, "") : null,
  });
}
function stopSketch() {
  if (!state.isRunning) return;
  window.glowAPI.stopFile();
  conLine("\n■  Stopped.", "con-err");
  setRunning(false);
}

function setRunning(val) {
  state.isRunning = val;
  btnRun.classList.toggle("hidden", val);
  btnStop.classList.toggle("hidden", !val);
  consoleInputRow.classList.toggle("hidden", !val || !state.waitingInput);
  if (val) {
    consoleStatus.textContent = "● running";
    consoleStatus.style.color = "var(--green)";
  } else {
    consoleStatus.textContent = "";
    state.waitingInput = false;
    consoleInputRow.classList.add("hidden");
  }
}

// ─── Console ──────────────────────────────────────────────────────────────────
function conLine(text, cls = "con-out") {
  const span = document.createElement("span");
  span.className = `con-line ${cls}`;
  span.textContent = text;
  consoleOutput.appendChild(span);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole(keepStatus = false) {
  consoleOutput.innerHTML = "";
  if (!keepStatus) consoleStatus.textContent = "";
}

$("btn-clear-console").addEventListener("click", clearConsole);

// Console input (when program calls input())
consoleInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && state.waitingInput) {
    const val = consoleInput.value;
    conLine(`▸ ${val}`, "con-prompt");
    consoleInput.value = "";
    window.glowAPI.sendInput(val + "\n");
    consoleInputRow.classList.add("hidden");
    state.waitingInput = false;
  }
});

// IPC events from main process (run output)
if (window.glowAPI.onRunOutput) {
  window.glowAPI.onRunOutput((text) => {
    conLine(text, "con-out");
  });
}
if (window.glowAPI.onRunError) {
  window.glowAPI.onRunError((text) => {
    conLine(text, "con-err");
  });
}
if (window.glowAPI.onRunDone) {
  window.glowAPI.onRunDone((code) => {
    conLine("─".repeat(44), "con-divider");
    if (code === 0) {
      conLine("✓ Finished.", "con-success");
    } else {
      conLine(`✗ Exited with code ${code}.`, "con-err");
    }
    setRunning(false);
  });
}
if (window.glowAPI.onRunInput) {
  window.glowAPI.onRunInput(() => {
    state.waitingInput = true;
    consoleInputRow.classList.remove("hidden");
    consoleInput.focus();
  });
}

// ─── Resize Handle ────────────────────────────────────────────────────────────
const resizeHandle = $("resize-handle");
const consolePane = $("console-pane");
const editorPane = $("editor-pane");
let isResizing = false;

resizeHandle.addEventListener("mousedown", e => {
  isResizing = true;
  resizeHandle.classList.add("dragging");
  document.body.style.cursor = "ns-resize";
  e.preventDefault();
});

document.addEventListener("mousemove", e => {
  if (!isResizing) return;
  const workspaceRect = $("workspace").getBoundingClientRect();
  const offsetFromBottom = workspaceRect.bottom - e.clientY;
  const clamped = Math.min(Math.max(offsetFromBottom, 80), window.innerHeight * 0.7);
  consolePane.style.height = clamped + "px";
});

document.addEventListener("mouseup", () => {
  if (!isResizing) return;
  isResizing = false;
  resizeHandle.classList.remove("dragging");
  document.body.style.cursor = "";
});

// ─── Menu Bar ─────────────────────────────────────────────────────────────────
const menuItems = document.querySelectorAll(".menu-item");

function closeAllMenus() {
  menuItems.forEach(m => m.classList.remove("open"));
}

menuItems.forEach(item => {
  item.addEventListener("click", e => {
    const wasOpen = item.classList.contains("open");
    closeAllMenus();
    if (!wasOpen) item.classList.add("open");
    e.stopPropagation();
  });
});

document.addEventListener("click", closeAllMenus);

// Dispatch dropdown actions
document.querySelectorAll(".dd-item[data-action]").forEach(btn => {
  btn.addEventListener("click", e => {
    if (btn.dataset.action === "open-recent-menu") {
      e.stopPropagation();
      return;
    }
    closeAllMenus();
    handleAction(btn.dataset.action);
    e.stopPropagation();
  });
});

// Topbar run/stop buttons
btnRun.addEventListener("click", runSketch);
btnStop.addEventListener("click", stopSketch);

// ─── Action Dispatcher ────────────────────────────────────────────────────────
function handleAction(action) {
  switch (action) {
    // File
    case "new": fileNew(); break;
    case "open": fileOpen(); break;
    case "save": fileSave(); break;
    case "save-as": fileSaveAs(); break;
    case "close-file": fileClose(); break;
    case "format": autoFormatCode(); break;
    // Sketch
    case "run": runSketch(); break;
    case "stop": stopSketch(); break;
    case "clear-console": clearConsole(); break;
    // Settings
    case "settings": openModal("modal-settings"); break;
    // Library
    case "lib-browse": openModal("modal-library"); break;
    case "lib-new": newLibraryFile(); break;
    case "lib-submit": openModal("modal-submit"); break;
    // Help
    case "help-docs": openModal("modal-docs"); break;
    case "help-examples": openModal("modal-examples"); break;
    case "help-about": {
      // Populate About from loaded config
      const nameEl = document.querySelector(".about-name");
      const verEl = document.querySelector(".about-version");
      const descEl = document.querySelector(".about-desc");
      if (nameEl && window._glowAppInfo?.config?.about?.name)
        nameEl.textContent = window._glowAppInfo.config.about.name + " Language";
      if (verEl && window._glowAppInfo?.version)
        verEl.textContent = "IDE v" + window._glowAppInfo.version;
      if (descEl && window._glowAppInfo?.config?.about?.description)
        descEl.textContent = window._glowAppInfo.config.about.description;
      openModal("modal-about");
      break;
    }
  }
}

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key === "n") { e.preventDefault(); fileNew(); }
  if (ctrl && e.key === "o") { e.preventDefault(); fileOpen(); }
  if (ctrl && e.key === "s" && !e.shiftKey) { e.preventDefault(); fileSave(); }
  if (ctrl && e.key === "S") { e.preventDefault(); fileSaveAs(); }
  if (e.key === "F5") { e.preventDefault(); runSketch(); }
  if (e.key === "F6") { e.preventDefault(); stopSketch(); }
  if (e.key === "Escape") {
    if (!modalOverlay.classList.contains("hidden")) closeAllModals();
    else closeAllMenus();
  }
});

// ─── Modals ───────────────────────────────────────────────────────────────────
function openModal(id) {
  closeAllModals();
  modalOverlay.classList.remove("hidden");
  $(id).classList.remove("hidden");
}

function closeAllModals() {
  modalOverlay.classList.add("hidden");
  document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
}

// Close buttons
document.querySelectorAll(".modal-close[data-close]").forEach(btn => {
  btn.addEventListener("click", () => closeAllModals());
});

// Click overlay to close
modalOverlay.addEventListener("click", e => {
  if (e.target === modalOverlay) closeAllModals();
});

// ─── Library Manager ──────────────────────────────────────────────────────────
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("glow-ide-settings") || "{}");
    state.settings = { ...state.settings, ...saved };
  } catch (_) { }
  applySettings();
}

function saveSettings() {
  localStorage.setItem("glow-ide-settings", JSON.stringify(state.settings));
  // Also persist to glow-preferences.json via main process
  if (window.glowAPI?.savePreferences) {
    window.glowAPI.savePreferences({
      theme: state.settings.theme,
      autocomplete: state.settings.autocomplete,
      liveErrors: state.settings.diagnostics,
      autoClosePairs: state.settings.autoclose,
    }).catch(() => { }); // non-fatal
  }
}

function applySettings() {
  document.body.classList.remove("theme-light", "theme-midnight", "theme-forest");
  if (state.settings.theme !== "dark") document.body.classList.add(`theme-${state.settings.theme}`);
  document.querySelectorAll(".theme-choice").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.theme === state.settings.theme);
  });
  const autocomplete = $("setting-autocomplete");
  const autoclose = $("setting-autoclose");
  const diagnostics = $("setting-diagnostics");
  if (autocomplete) autocomplete.checked = state.settings.autocomplete;
  if (autoclose) autoclose.checked = state.settings.autoclose;
  if (diagnostics) diagnostics.checked = state.settings.diagnostics;
  refreshEditorDecorations();
  if (!state.settings.autocomplete) hideAutocomplete();
}

document.querySelectorAll(".theme-choice").forEach(btn => {
  btn.addEventListener("click", () => {
    state.settings.theme = btn.dataset.theme;
    saveSettings();
    applySettings();
  });
});

[
  ["setting-autocomplete", "autocomplete"],
  ["setting-autoclose", "autoclose"],
  ["setting-diagnostics", "diagnostics"],
].forEach(([id, key]) => {
  const el = $(id);
  if (!el) return;
  el.addEventListener("change", () => {
    state.settings[key] = el.checked;
    saveSettings();
    applySettings();
  });
});

const LIBRARIES = [
  {
    id: "math",
    name: "math",
    display: "Math",
    type: "builtin",
    desc: "Extended math functions. Note: most math is already global — this library adds nothing new since all functions (clamp, abs, pow, etc.) are built-in globals.",
    funcs: ["abs", "max", "min", "clamp", "pow"],
  },
  {
    id: "accounts",
    name: "accounts",
    display: "Accounts",
    type: "builtin",
    desc: "A simple account management system for logins and signups. Stores accounts in memory during runtime.",
    funcs: ["addAccount", "removeAccount", "login", "changePass", "listAccounts", "accountCount", "accountExists", "getEmail"],
  },
  {
    id: "glowui-community",
    name: "glowui",
    display: "GlowUI",
    type: "community",
    desc: "A community library for building simple terminal UIs. Provides helpers for menus, tables, and prompts. (Example community library — not yet available.)",
    funcs: ["menu", "table", "prompt", "confirm", "clear"],
  },
];

function renderLibraryList() {
  const builtin = $("lib-list-builtin");
  const community = $("lib-list-community");
  builtin.innerHTML = "";
  community.innerHTML = "";

  LIBRARIES.forEach(lib => {
    const el = document.createElement("div");
    el.className = "lib-entry";
    el.dataset.libId = lib.id;
    el.innerHTML = `
      <span>${lib.display}</span>
      <span class="lib-badge ${lib.type}">${lib.type === "builtin" ? "built-in" : "community"}</span>
    `;
    el.addEventListener("click", () => selectLibrary(lib.id));
    (lib.type === "builtin" ? builtin : community).appendChild(el);
  });
}

function selectLibrary(id) {
  const lib = LIBRARIES.find(l => l.id === id);
  if (!lib) return;

  document.querySelectorAll(".lib-entry").forEach(e => {
    e.classList.toggle("active", e.dataset.libId === id);
  });

  $("lib-detail-placeholder").classList.add("hidden");
  $("lib-detail-content").classList.remove("hidden");
  $("lib-detail-name").textContent = lib.display;
  $("lib-detail-badge").innerHTML = `<span class="lib-badge ${lib.type}">${lib.type === "builtin" ? "built-in" : "community"}</span>`;
  $("lib-detail-desc").textContent = lib.desc;
  $("lib-detail-funcs").innerHTML = lib.funcs.map(f => `<span class="lib-func-chip">${f}()</span>`).join("");

  $("lib-detail-insert").onclick = () => {
    const line = `import "${lib.file}"\n`;  // ← use .file instead of .name
    const pos = editor.selectionStart;
    editor.value = line + editor.value;
    editor.selectionStart = editor.selectionEnd = pos + line.length;
    setDirty(true);
    refreshEditorDecorations();
    closeAllModals();
    conLine(`✓ Inserted: import "${lib.file}"`, "con-success");
    editor.focus();
  };
}

function newLibraryFile() {
  const template = `// ─────────────────────────────────────────
// mylib.glow — My Glow Library
//
// Usage in your code:
//   import "mylib"
// ─────────────────────────────────────────

// Add your functions here:

func myFunction(arg) {
    return arg
}
`;
  if (state.isDirty) {
    // Open in new state rather than overwriting
    confirmUnsaved().then(ok => {
      if (!ok) return;
      editor.value = template;
      state.filePath = null;
      state.fileName = "mylib.glow";
      setDirty(true);
      updateTabTitle();
      refreshEditorDecorations();
    });
  } else {
    editor.value = template;
    state.filePath = null;
    state.fileName = "mylib.glow";
    setDirty(true);
    updateTabTitle();
    refreshEditorDecorations();
  }
}

$("btn-submit-lib").addEventListener("click", () => {
  const fields = ["submit-name", "submit-display", "submit-desc", "submit-author", "submit-version"];
  for (const id of fields) {
    if (!$(id).value.trim()) {
      $(id).focus();
      showSubmitError("Please fill out every field before submitting.");
      return;
    }
  }
  const descWords = $("submit-desc").value.trim().split(/\s+/).filter(Boolean).length;
  if (descWords < 8) {
    $("submit-desc").focus();
    showSubmitError("Please write a longer description, at least 8 words.");
    return;
  }
  showSubmitError("");
  conLine(`Library submission recorded: "${$("submit-display").value.trim()}" by ${$("submit-author").value.trim()}`, "con-info");
  conLine("  (Submissions will be reviewed and added to the community list in a future update.)", "con-info");
  closeAllModals();
  $("submit-name").value = "";
  $("submit-display").value = "";
  $("submit-desc").value = "";
  $("submit-author").value = "";
  $("submit-version").value = "";
});

function showSubmitError(message) {
  const el = $("submit-error");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("hidden", !message);
}

// ─── Language Docs ────────────────────────────────────────────────────────────
const DOCS = {
  basics: `
<h2>Basics</h2>
<h3>Variables</h3>
<p>Declare with <code>var</code>. No types needed — Glow figures it out.</p>
<pre><span class="kw">var</span> name = <span class="str">"Alice"</span>
<span class="kw">var</span> score = <span class="num">0</span>
<span class="kw">var</span> active = <span class="kw">true</span></pre>
<h3>Printing</h3>
<pre><span class="kw">print</span>(<span class="str">"Hello, world!"</span>)
<span class="kw">print</span>(score)
<span class="kw">print</span>(<span class="str">"Score: "</span> + score)</pre>
<h3>Comments</h3>
<pre><span class="cmt">// This is a comment</span>
<span class="kw">var</span> x = <span class="num">10</span>  <span class="cmt">// inline comment</span></pre>
<h3>User Input</h3>
<pre><span class="kw">var</span> name = input(<span class="str">"What is your name? "</span>)
<span class="kw">print</span>(<span class="str">"Hello, "</span> + name)</pre>
`,
  control: `
<h2>Control Flow</h2>
<h3>If / Else</h3>
<pre><span class="kw">if</span> (score > <span class="num">10</span>) {
    <span class="kw">print</span>(<span class="str">"You win!"</span>)
} <span class="kw">else if</span> (score > <span class="num">5</span>) {
    <span class="kw">print</span>(<span class="str">"Getting there"</span>)
} <span class="kw">else</span> {
    <span class="kw">print</span>(<span class="str">"Keep trying"</span>)
}</pre>
<h3>While Loop</h3>
<pre><span class="kw">var</span> i = <span class="num">0</span>
<span class="kw">while</span> (i < <span class="num">5</span>) {
    <span class="kw">print</span>(i)
    i = i + <span class="num">1</span>
}</pre>
<h3>Repeat</h3>
<pre><span class="kw">repeat</span> <span class="num">3</span> {
    <span class="kw">print</span>(<span class="str">"hello"</span>)
}</pre>
`,
  functions: `
<h2>Functions</h2>
<h3>Defining a Function</h3>
<pre><span class="kw">func</span> greet(name) {
    <span class="kw">return</span> <span class="str">"Hello, "</span> + name + <span class="str">"!"</span>
}

<span class="kw">print</span>(greet(<span class="str">"Alice"</span>))</pre>
<h3>Multiple Parameters</h3>
<pre><span class="kw">func</span> add(a, b) {
    <span class="kw">return</span> a + b
}

<span class="kw">var</span> result = add(<span class="num">3</span>, <span class="num">4</span>)</pre>
<h3>Functions as Values</h3>
<pre><span class="kw">var</span> nums = [<span class="num">1</span>, <span class="num">2</span>, <span class="num">3</span>, <span class="num">4</span>]
<span class="kw">var</span> doubled = nums.map(<span class="kw">func</span> double(x) {
    <span class="kw">return</span> x * <span class="num">2</span>
})</pre>
`,
  arrays: `
<h2>Arrays & Tables</h2>
<h3>Arrays</h3>
<pre><span class="kw">var</span> nums = [<span class="num">1</span>, <span class="num">2</span>, <span class="num">3</span>]
nums.add(<span class="num">4</span>)
<span class="kw">print</span>(nums.length())
<span class="kw">print</span>(nums.contains(<span class="num">2</span>))
nums.removeAt(<span class="num">0</span>)</pre>
<h3>Range</h3>
<pre><span class="kw">print</span>(range(<span class="num">5</span>))          <span class="cmt">// [0,1,2,3,4]</span>
<span class="kw">print</span>(range(<span class="num">2</span>, <span class="num">8</span>))       <span class="cmt">// [2,3,4,5,6,7]</span>
<span class="kw">print</span>(range(<span class="num">0</span>, <span class="num">10</span>, <span class="num">2</span>))  <span class="cmt">// [0,2,4,6,8]</span></pre>
<h3>Tables (like objects)</h3>
<pre><span class="kw">var</span> player = {
    name: <span class="str">"Alice"</span>,
    score: <span class="num">0</span>
}
<span class="kw">print</span>(player.name)
player.score = player.score + <span class="num">10</span></pre>
`,
  builtins: `
<h2>Built-in Globals</h2>
<h3>Math</h3>
<pre>floor(<span class="num">4.9</span>)      <span class="cmt">// 4</span>
ceil(<span class="num">4.1</span>)       <span class="cmt">// 5</span>
round(<span class="num">4.5</span>)      <span class="cmt">// 5</span>
abs(<span class="num">-7</span>)         <span class="cmt">// 7</span>
sqrt(<span class="num">16</span>)        <span class="cmt">// 4</span>
pow(<span class="num">2</span>, <span class="num">8</span>)       <span class="cmt">// 256</span>
clamp(<span class="num">150</span>, <span class="num">0</span>, <span class="num">100</span>) <span class="cmt">// 100</span>
max(<span class="num">1</span>, <span class="num">5</span>, <span class="num">3</span>)    <span class="cmt">// 5</span>
min(<span class="num">1</span>, <span class="num">5</span>, <span class="num">3</span>)    <span class="cmt">// 1</span>
random(<span class="num">1</span>, <span class="num">10</span>)   <span class="cmt">// random int 1–10</span></pre>
<h3>Strings</h3>
<pre>len(<span class="str">"hello"</span>)           <span class="cmt">// 5</span>
upper(<span class="str">"hello"</span>)         <span class="cmt">// "HELLO"</span>
lower(<span class="str">"HELLO"</span>)         <span class="cmt">// "hello"</span>
trim(<span class="str">"  hi  "</span>)         <span class="cmt">// "hi"</span>
replace(<span class="str">"hi"</span>, <span class="str">"h"</span>, <span class="str">"b"</span>) <span class="cmt">// "bi"</span>
format(<span class="str">"Hi {}!"</span>, name)  <span class="cmt">// "Hi Alice!"</span>
contains(<span class="str">"hello"</span>, <span class="str">"ell"</span>) <span class="cmt">// true</span></pre>
<h3>Types</h3>
<pre>typeOf(<span class="num">42</span>)    <span class="cmt">// "number"</span>
isNumber(x)  <span class="cmt">// true/false</span>
toNumber(<span class="str">"5"</span>) <span class="cmt">// 5</span>
toStr(<span class="num">99</span>)    <span class="cmt">// "99"</span></pre>
`,
  fileio: `
<h2>File I/O</h2>
<h3>Reading & Writing</h3>
<pre><span class="cmt">// Write a file (creates or overwrites)</span>
writeFile(<span class="str">"data.txt"</span>, <span class="str">"hello\\n"</span>)

<span class="cmt">// Append to a file</span>
appendFile(<span class="str">"data.txt"</span>, <span class="str">"world\\n"</span>)

<span class="cmt">// Read a file</span>
<span class="kw">var</span> contents = readFile(<span class="str">"data.txt"</span>)
<span class="kw">print</span>(contents)</pre>
<h3>Checking & Deleting</h3>
<pre><span class="kw">if</span> (fileExists(<span class="str">"data.txt"</span>)) {
    deleteFile(<span class="str">"data.txt"</span>)
    <span class="kw">print</span>(<span class="str">"Deleted."</span>)
}</pre>
<h3>Notes</h3>
<p>File paths are relative to where you run the file from. Use <code>\\n</code> for newlines inside strings.</p>
`,
};

document.querySelectorAll(".docs-nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".docs-nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderDocsSection(btn.dataset.section);
  });
});

function renderDocsSection(section) {
  // Try DOCS_LIST (from glow-config.js) first, then fall back to static DOCS object
  const fromList = DOCS_LIST.find(d => d.id === section);
  if (fromList) {
    $("docs-content").innerHTML = fromList.html || "<p>No content.</p>";
  } else {
    $("docs-content").innerHTML = DOCS[section] || "<p>Section coming soon.</p>";
  }
}

// ─── Examples ─────────────────────────────────────────────────────────────────
const EXAMPLES = [
  {
    name: "Hello World",
    desc: "The classic first program",
    code: `// Hello World
var name = input("What is your name? ")
print("Hello, " + name + "!")
`,
  },
  {
    name: "Counter",
    desc: "A simple while loop counter",
    code: `// Counter
var i = 1
while (i <= 10) {
    print(i)
    i = i + 1
}
print("Done!")
`,
  },
  {
    name: "Guessing Game",
    desc: "Pick a number and guess it",
    code: `// Number Guessing Game
var secret = random(1, 100)
var guesses = 0
var won = false

print("I'm thinking of a number between 1 and 100.")

while (!won) {
    var guess = toNumber(input("Your guess: "))
    guesses = guesses + 1

    if (guess < secret) {
        print("Too low!")
    } else if (guess > secret) {
        print("Too high!")
    } else {
        won = true
        print("Correct! You got it in " + guesses + " guesses.")
    }
}
`,
  },
  {
    name: "FizzBuzz",
    desc: "The classic programming test",
    code: `// FizzBuzz
var i = 1
while (i <= 30) {
    if (i / 3 == floor(i / 3) and i / 5 == floor(i / 5)) {
        print("FizzBuzz")
    } else if (i / 3 == floor(i / 3)) {
        print("Fizz")
    } else if (i / 5 == floor(i / 5)) {
        print("Buzz")
    } else {
        print(i)
    }
    i = i + 1
}
`,
  },
  {
    name: "Simple Calculator",
    desc: "Add, subtract, multiply, divide",
    code: `// Simple Calculator
var a = toNumber(input("First number: "))
var op = input("Operator (+, -, *, /): ")
var b = toNumber(input("Second number: "))
var result = 0

if (op == "+") {
    result = a + b
} else if (op == "-") {
    result = a - b
} else if (op == "*") {
    result = a * b
} else if (op == "/") {
    if (b == 0) {
        print("Error: cannot divide by zero")
        exit(1)
    }
    result = a / b
} else {
    print("Unknown operator: " + op)
    exit(1)
}

print(a + " " + op + " " + b + " = " + result)
`,
  },
  {
    name: "File Notes",
    desc: "Save and load notes from a file",
    code: `// File Notes
var file = "notes.txt"

func showNotes() {
    if (fileExists(file)) {
        print("─── Your notes ───")
        print(readFile(file))
    } else {
        print("No notes yet.")
    }
}

var cmd = input("(r)ead / (w)rite / (c)lear: ")

if (cmd == "r") {
    showNotes()
} else if (cmd == "w") {
    var note = input("Note: ")
    appendFile(file, note + "\\n")
    print("Saved!")
} else if (cmd == "c") {
    writeFile(file, "")
    print("Notes cleared.")
} else {
    print("Unknown command.")
}
`,
  },
];

function renderExamplesList() {
  const list = $("examples-list");
  list.innerHTML = "";
  EXAMPLES.forEach(ex => {
    const el = document.createElement("div");
    el.className = "example-item";
    el.innerHTML = `
      <div>
        <div class="example-name">${ex.name}</div>
        <div class="example-desc">${ex.desc}</div>
      </div>
      <span class="example-arrow">→</span>
    `;
    el.addEventListener("click", () => loadExample(ex));
    list.appendChild(el);
  });
}

function loadExample(ex) {
  confirmUnsaved().then(ok => {
    if (!ok) return;
    editor.value = ex.code;
    state.filePath = null;
    state.fileName = ex.name.toLowerCase().replace(/\s+/g, "-") + ".glow";
    setDirty(true);
    updateTabTitle();
    refreshEditorDecorations();
    closeAllModals();
    conLine(`─── Loaded example: ${ex.name} ───`, "con-divider");
    editor.focus();
  });
}

window._onConfigUpdated = (newConfig) => {
  if (newConfig?.libraries?.length) Object.assign(LIBRARIES, newConfig.libraries);
  if (newConfig?.examples?.length) Object.assign(EXAMPLES, newConfig.examples);
  if (newConfig?.docs?.length) Object.assign(DOCS_LIST, newConfig.docs);
  renderLibraryList();
  renderExamplesList();
  conLine("✦ Content updated automatically.", "con-success");
};