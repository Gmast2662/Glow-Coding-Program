# Glow — Release & Update Guide

## How Updates Work (The 3 Types)

Your updater uses version numbers to decide what kind of update to apply.
The format is: **MAJOR . MINOR . PATCH** (e.g. `1.2.3`)

| Type | Example | What happens | User experience |
|------|---------|-------------|-----------------|
| **Patch** | `1.0.0` → `1.0.1` | Only `glow-config.js` is updated (libraries, examples, docs) | Silent — no popup, updates automatically in background |
| **Minor** | `1.0.0` → `1.1.0` | New features added to the app itself | Notification popup: "Update available — download?" |
| **Major** | `1.0.0` → `2.0.0` | Big breaking changes, new installer required | Popup: "New version available — must download installer" |

**The key idea:** small content changes (adding a library, fixing docs, new examples) = patch.
New features in the IDE = minor. Completely rebuilt app = major.

---

## Making a Patch Update (Most Common)

Use this when you're adding/editing **libraries, examples, or docs only**.
Users get it silently — no action needed on their end.

**Steps:**
1. Edit `glow-config.js` — add your library, example, or doc change
2. Change the version from e.g. `1.0.0` → `1.0.1` (bump the last number)
3. Change the version in `package.json` to match
4. Run:
```bash
npm run release
```

That's it. Within an hour, every installed copy of Glow silently updates its config.
**No reinstall needed for anyone.**

---

## Making a Minor Update (New Features)

Use this when you've changed the IDE itself (new menu, new button, bug fix, etc.)
but it's not a complete rebuild.

**Steps:**
1. Make your code changes in `src/`
2. Change the version from e.g. `1.0.0` → `1.1.0` (bump the middle number, reset last to 0)
3. Change the version in `package.json` to match
4. Run:
```bash
npm run release
```

Users will see a notification popup. They click to download the new installer and run it.

---

## Making a Major Update (New Installer Required)

Use this when you've rebuilt large parts of the app, changed how it installs,
or made breaking changes.

**Steps:**
1. Make your changes
2. Change the version from e.g. `1.0.0` → `2.0.0` (bump the first number, reset others to 0)
3. Change the version in `package.json` to match
4. Run:
```bash
npm run release
```

Users see a popup telling them they need to download and install the new version.
They click a link to your GitHub releases page.

---

## Quick Reference — Version Bumping

```
Before          After        Use when
─────────────────────────────────────────────────────────────────
1.0.0     →     1.0.1        Added a library / example / doc fix
1.0.1     →     1.0.2        Another small content change
1.0.2     →     1.1.0        New feature added to the IDE
1.1.0     →     1.1.1        Content change after a minor update
1.1.1     →     2.0.0        Major rebuild / breaking change
```

**Rule:** always bump the same number in both `package.json` and `glow-config.js`.
The release script syncs them automatically — you just need to set the right one in `package.json`.

---

## Adding a Library (Patch Update Example)

Open `glow-config.js` and find the `libraries: [` section. Add your library:

```js
{
  id:      "strings",
  file:    "strings",
  display: "Strings",
  type:    "builtin",
  desc:    "Extra string utilities.",
  funcs:   ["split", "join", "startsWith", "endsWith"],
},
```

Then bump `1.0.0` → `1.0.1` in both files and run `npm run release`.

---

## Adding an Example (Patch Update Example)

Find the `examples: [` section in `glow-config.js` and add:

```js
{
  name: "My Example",
  desc: "What it shows",
  code: 'print("Hello!")\n',
},
```

For multi-line code, use `\n` between lines:
```js
code: 'var x = 5\nprint(x)\n',
```

---

## First-Time Setup

### 1. Set your GitHub token (one-time)
Search **"Environment Variables"** in Windows → User Variables → New:
- Name: `GITHUB_TOKEN`
- Value: your token from https://github.com/settings/tokens (needs `repo` scope only)

Restart your terminal. Verify it's set:
```powershell
echo $env:GITHUB_TOKEN
```

If it's blank, set it just for the current session:
```powershell
$env:GITHUB_TOKEN = "ghp_yourTokenHere"
```

### 2. Set your repo in release.js (one-time)
Open `glow-ide/scripts/release.js` and set:
```js
const REPO_OWNER = "your-github-username";
const REPO_NAME  = "your-repo-name";
```

### 3. Set your repo in glow-config.js (one-time)
```js
updates: {
  enabled: true,
  owner:   "your-github-username",
  repo:    "your-repo-name",
}
```

### 4. Make sure your GitHub repo is public
Auto-updates require a public repo. Private repos won't work.

---

## The Release Command

From inside `glow-project/glow-ide`:
```bash
npm run release
```

This automatically:
- Syncs version from `package.json` → `glow-config.js`
- Builds the Windows installer
- Commits and pushes everything to GitHub
- Creates the GitHub release with the `.exe` attached

**Just build locally (no release):**
```bash
npm run build
# Output: dist-installer/Glow Setup x.x.x.exe
```

---

## Troubleshooting

**"GITHUB_TOKEN not set"**
Close and reopen your terminal after setting the environment variable, or set it inline:
`$env:GITHUB_TOKEN = "ghp_yourToken"`

**Build fails**
Make sure you're in `glow-project/glow-ide`. If it keeps failing, delete `node_modules` and run `npm install` again.

**Users aren't getting patch updates silently**
Check that `updates.owner` and `updates.repo` are set correctly in `glow-config.js`.
Also make sure the GitHub release is published (not a draft) and the repo is public.

**Updater shows wrong version**
Always bump the version in `package.json` first — the release script reads from there.
