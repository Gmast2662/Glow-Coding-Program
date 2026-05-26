# Glow IDE

Desktop IDE for the Glow programming language.

---

## Quick Start (development / no installer)

```
cd glow-language-new
npm install
npm run build
cd ../glow-ide
npm install
npm start
```

---

## Building the Windows Installer (.exe)

### Prerequisites
- Node.js (LTS) — https://nodejs.org
- Python 3 — https://python.org (for native modules)
- Visual Studio Build Tools or Visual C++ Redistributable
- NSIS — https://nsis.sourceforge.io/Download (add to PATH)

### Steps

```
cd glow-ide
npm install
npm run build
```

The installer appears at:  `glow-ide/dist-installer/Glow Setup 1.0.0.exe`

### What the installer does
1. Shows a welcome screen
2. Lets user choose install location (default: C:\Program Files\Glow)
3. Lets user choose sketchbook folder (default: C:\Glow-Sketchbook)
4. Lets user choose: add to PATH / desktop shortcut / start menu shortcut
5. Installs the app and creates glow-preferences.json next to the .exe

---

## Configuring Glow (libraries, examples, docs, version)

Edit `glow-ide/glow-config.js` — this is the one file to change everything:

- **version** — bump this before publishing
- **libraries** — add entries to appear in Library → Browse Libraries
- **examples** — add entries to appear in Help → Load Example
- **docs** — add/edit sections in Help → Language Reference
- **about** — app name, description
- **updates.owner / updates.repo** — your GitHub username and repo name

---

## Publishing an Update

### Setup (one time)
1. Create a GitHub repo
2. Set `updates.owner` and `updates.repo` in `glow-config.js`
3. Get a GitHub personal access token (https://github.com/settings/tokens, needs `repo` scope)
4. Set it as an environment variable:
   - Windows:  `set GITHUB_TOKEN=your_token`
   - Mac/Linux: `export GITHUB_TOKEN=your_token`
5. Push your project to GitHub: `git init && git remote add origin https://github.com/YOU/REPO.git && git push`

### Publishing
```
cd glow-ide
node scripts/publish.js
```

It asks: patch / minor / major?

| Type | What it means | What users see |
|------|---------------|----------------|
| **patch** | Changed examples, libraries, or docs only | Auto-updated silently within an hour |
| **minor** | New features, no reinstall | Notification banner + download link |
| **major** | Breaking change, new installer needed | Prominent notice to download installer |

---

## Folder Structure

```
glow-language-new/      ← The language interpreter
  dist/glow.js          ← Must exist (npm run build)
  libs/                 ← .glow library files
  src/                  ← TypeScript source

glow-ide/               ← The IDE
  glow-config.js        ← ★ Edit this to configure everything
  src/
    main.js             ← Electron main process
    preload.js          ← IPC bridge
    updater.js          ← Auto-update logic
    semver-mini.js      ← Version comparison
    renderer/
      index.html        ← UI structure
      style.css         ← All styles + themes
      app.js            ← All UI logic
  assets/               ← Icons
  installer/            ← NSIS customisation
  scripts/
    publish.js          ← Run to release an update
```

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Run    | F5 |
| Stop   | F6 |
| New file | Ctrl+N |
| Open file | Ctrl+O |
| Save | Ctrl+S |
| Save As | Ctrl+Shift+S |
| Toggle comment | Ctrl+/ |
| Autocomplete | Start typing / Tab to accept |
| Close modal | Escape |
