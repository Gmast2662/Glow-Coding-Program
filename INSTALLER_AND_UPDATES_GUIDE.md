# Glow IDE - Installer & Auto-Update Guide

## Quick Answers to Your Questions

### 1. **Easier way to make the installer?**
**No, unfortunately.** The current setup using `electron-builder` is actually the **easiest and standard way**. Here's why:

- ✅ **electron-builder** is the industry standard for Electron apps
- ✅ It handles Windows `.exe`, Mac `.dmg`, and Linux packages automatically
- ✅ You only run **one command**: `npm run build`
- ✅ Alternative tools (like Squirrel, NSIS manually, etc.) are **much harder**

**What you need installed (one-time):**
```bash
cd glow-project/glow-ide
npm install
```

That's it! The `npm install` downloads electron-builder and everything needed.

---

### 2. **Is the .exe installer universal?**
**Almost, but with limitations:**

✅ **YES**: Anyone can run the `.exe` and install Glow  
✅ **YES**: It works on any Windows 10/11 64-bit machine  
❌ **NO**: It won't work on Mac (you need `.dmg`) or Linux  
❌ **NO**: It won't work on 32-bit Windows (you built for x64 only)

**The installer includes:**
- Your entire IDE (HTML, JS, CSS)
- The Glow language runtime (from `glow-language-new/dist/`)
- All libraries (`libs/` folder)
- It installs to `C:\Users\<name>\AppData\Local\Programs\Glow` by default

---

### 3. **Does GitHub need to be public?**

**For auto-updates: YES, it must be public.**

Here's why:
- Your installer checks GitHub releases for new versions
- GitHub's release API requires authentication for **private repos**
- Embedding your personal GitHub token in the installer is **extremely dangerous** (anyone can extract it and access your GitHub account)

**Options:**
1. ✅ **Make repo public** (safest for auto-updates)
2. ❌ Keep it private (auto-updates won't work, or you risk exposing your token)

---

### 4. **Why do you need a GitHub token?**

You need a token **only for publishing releases**, not for users downloading them.

**When you use the token:**
- Running `npm run publish` to create a new GitHub release
- The script uploads your installer `.exe` to GitHub
- This happens **on your machine only**

**Users don't need your token:**
- They download from the public release page
- The updater checks for new versions (no auth needed for public repos)

**How to create a token:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name: "Glow Release Publisher"
4. Check **only** `repo` scope
5. Copy the token and save it somewhere safe
6. Add it to your environment or the publish script

---

### 5. **Will updates auto-download for everyone?**

**YES!** Here's how it works:

1. You build a new version: `npm run build` (v1.0.1)
2. You publish it: `npm run publish` (uploads to GitHub)
3. **Anyone with Glow installed anywhere** will:
   - See a notification: "Update available: v1.0.1"
   - Click "Download Update"
   - It downloads the new version from GitHub
   - They run the installer to update

**Important notes:**
- ⚠️ Updates are **NOT silent** — users must click to download/install
- ⚠️ Users need internet to check for updates
- ⚠️ The app checks every hour (configurable in `glow-config.js`)
- ✅ It works **across all devices** (as long as they have internet)

---

### 6. **What to push to GitHub?**

**Push the ENTIRE `glow-project` folder**, including:

```
glow-project/
├── glow-ide/                 ← The Electron IDE
│   ├── src/
│   ├── assets/
│   ├── installer/
│   ├── package.json
│   └── ...
├── glow-language-new/        ← The language runtime
│   ├── src/
│   ├── dist/                 ← Compiled JS (needed!)
│   ├── libs/
│   └── package.json
└── glow-config.js            ← Central config
```

**Why both?**
- The `package.json` has this in the build config:
  ```json
  "extraResources": [
    {
      "from": "../glow-language-new",
      "to": "glow/"
    }
  ]
  ```
- This means electron-builder **copies** the language runtime into the installer
- If you only push `glow-ide/`, the build will **fail** (can't find `../glow-language-new`)

**What NOT to push:**
- `node_modules/` (add to `.gitignore`)
- `dist-installer/` (the built `.exe` files — too big)
- Build artifacts

---

## Complete Setup Checklist

### Step 1: Prepare Your Project
```bash
# Create .gitignore if you don't have one
cd glow-project
cat > .gitignore << 'EOF'
node_modules/
dist-installer/
*.log
.DS_Store
Thumbs.db
EOF

# Make sure your language is compiled
cd glow-language-new
npm install
npm run build  # Creates dist/ folder

# Install IDE dependencies
cd ../glow-ide
npm install
```

### Step 2: Create GitHub Repository
1. Go to https://github.com/new
2. Name it: `glow-language` (or whatever you want)
3. **Make it PUBLIC** (for auto-updates to work)
4. Create the repository

### Step 3: Push Your Code
```bash
cd glow-project
git init
git add .
git commit -m "Initial commit: Glow IDE v1.0.0"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/glow-language.git
git push -u origin main
```

### Step 4: Configure Update System
Edit `glow-project/glow-ide/glow-config.js`:
```javascript
module.exports = {
  version: "1.0.0",
  updates: {
    enabled: true,
    repo: "YOUR_USERNAME/glow-language",  // ← Change this!
    checkIntervalMs: 3600000  // 1 hour
  },
  // ... rest of config
};
```

### Step 5: Build Your First Installer
```bash
cd glow-project/glow-ide
npm run build

# Output will be in:
# dist-installer/Glow Setup 1.0.0.exe
```

### Step 6: Create GitHub Release & Upload
**Option A: Manual (easiest for first time)**
1. Go to `https://github.com/YOUR_USERNAME/glow-language/releases/new`
2. Tag: `v1.0.0`
3. Title: `Glow v1.0.0`
4. Drag and drop `Glow Setup 1.0.0.exe` into the uploads area
5. Click "Publish release"

**Option B: Automated (requires token)**
Create `scripts/publish.js`:
```javascript
const { Octokit } = require("@octokit/rest");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.GITHUB_TOKEN; // Set this in your environment
const REPO_OWNER = "YOUR_USERNAME";
const REPO_NAME = "glow-language";
const VERSION = require("../package.json").version;

async function publish() {
  const octokit = new Octokit({ auth: TOKEN });
  
  // Create release
  const release = await octokit.repos.createRelease({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    tag_name: `v${VERSION}`,
    name: `Glow v${VERSION}`,
    draft: false,
    prerelease: false
  });
  
  // Upload installer
  const installerPath = path.join(__dirname, "..", "dist-installer", `Glow Setup ${VERSION}.exe`);
  const installerData = fs.readFileSync(installerPath);
  
  await octokit.repos.uploadReleaseAsset({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    release_id: release.data.id,
    name: `Glow-Setup-${VERSION}.exe`,
    data: installerData
  });
  
  console.log(`✅ Published v${VERSION}`);
}

publish().catch(console.error);
```

Then:
```bash
npm install @octokit/rest
export GITHUB_TOKEN="your_token_here"
npm run publish
```

---

## Testing Auto-Updates

1. Install v1.0.0 on a test machine
2. Create v1.0.1:
   - Update version in `package.json`: `"version": "1.0.1"`
   - Update version in `glow-config.js`: `version: "1.0.1"`
   - Run `npm run build`
   - Publish to GitHub (manual or `npm run publish`)
3. Open the installed v1.0.0 app
4. Within an hour, you should see: "Update available: v1.0.1"

---

## Common Issues & Fixes

### "Build fails - can't find glow-language-new"
**Fix:** Make sure you're building from `glow-ide/` and that `../glow-language-new` exists

### "Update check fails"
**Fix:** 
- Check `glow-config.js` has correct repo: `YOUR_USERNAME/glow-language`
- Make sure GitHub repo is **public**
- Check internet connection

### "Installer works but app crashes on launch"
**Fix:**
- Make sure `glow-language-new/dist/` exists and has compiled JS
- Run `cd glow-language-new && npm run build`

### "Auto-update says 'no updates' but new version exists on GitHub"
**Fix:**
- Check that version in GitHub release tag (e.g. `v1.0.1`) is **higher** than installed version
- Check that release is published (not draft)
- Check network tab in DevTools for API errors

---

## Summary

✅ **Push entire `glow-project/` to GitHub**  
✅ **Make repo public for auto-updates**  
✅ **Use `npm run build` to create installer** (no easier way)  
✅ **The .exe works on any Windows 64-bit machine**  
✅ **GitHub token is only for you to publish, not for users**  
✅ **Updates work globally** — anyone with internet gets notified  
✅ **Updates are NOT automatic** — users click to download/install  

**One-time setup:** 15 minutes  
**Each new release:** 2 minutes (build + publish)
