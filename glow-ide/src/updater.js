"use strict";

/**
 * Glow Auto-Updater
 *
 * How it works:
 *   - Checks GitHub releases API for the latest version tag
 *   - Compares MAJOR.MINOR.PATCH:
 *       MAJOR bump → "Big update" dialog, user must download new installer
 *       MINOR bump → "Update available" notification, downloads new app files
 *       PATCH bump → Silently fetches new glow-config.js content and applies it
 *
 * To publish an update:
 *   1. Edit glow-config.js (bump version, add examples/libraries/docs)
 *   2. Run: node scripts/publish.js  (creates the GitHub release)
 *   3. Everyone's IDE picks it up automatically on next launch or hourly check
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const semver = require("./semver-mini");

const RELEASES_URL = (owner, repo) =>
  `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

const RAW_CONFIG_URL = (owner, repo, tag) =>
  `https://raw.githubusercontent.com/${owner}/${repo}/${tag}/glow-ide/glow-config.js`;

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "Glow-IDE-Updater/1.0" },
      timeout: 8000,
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        resolve(body);
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
  });
}

// ─── Main check function ──────────────────────────────────────────────────────
async function checkForUpdates({ config, mainWindow, configPath }) {
  const { updates, version: currentVersion } = config;
  if (!updates?.enabled || !updates.owner || !updates.repo ||
    updates.owner === "YOUR_GITHUB_USERNAME") {
    return { status: "disabled" };
  }

  let releaseData;
  try {
    const body = await get(RELEASES_URL(updates.owner, updates.repo));
    releaseData = JSON.parse(body);
  } catch (e) {
    return { status: "error", message: e.message };
  }

  const latestTag = releaseData.tag_name || "";
  const latestVersion = latestTag.replace(/^v/, "");
  const notes = releaseData.body || "";

  if (!latestVersion) return { status: "no-version" };

  const cmp = semver.compare(latestVersion, currentVersion);
  if (cmp <= 0) return { status: "up-to-date", version: currentVersion };

  const [latMaj, latMin] = latestVersion.split(".").map(Number);
  const [curMaj, curMin] = currentVersion.split(".").map(Number);

  // ── MAJOR: require new installer ──────────────────────────────────────────
  if (latMaj > curMaj) {
    mainWindow.webContents.send("update-available", {
      type: "major",
      current: currentVersion,
      latest: latestVersion,
      notes,
      downloadUrl: releaseData.html_url,
    });
    return { status: "major", latestVersion };
  }

  // ── MINOR: download new app (notify user) ─────────────────────────────────
  if (latMin > curMin) {
    mainWindow.webContents.send("update-available", {
      type: "minor",
      current: currentVersion,
      latest: latestVersion,
      notes,
      downloadUrl: releaseData.html_url,
    });
    return { status: "minor", latestVersion };
  }

  // ── PATCH: silently update glow-config.js content only ───────────────────
  try {
    const newConfigSrc = await get(RAW_CONFIG_URL(updates.owner, updates.repo, latestTag));

    // Safety check: must look like a valid config export
    if (!newConfigSrc.includes("module.exports") || !newConfigSrc.includes("version")) {
      return { status: "patch-invalid" };
    }

    // Back up old config
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, configPath + ".bak");
    }

    fs.writeFileSync(configPath, newConfigSrc, "utf8");

    // Reload config in renderer (send new content)
    // We re-require by reading the file fresh since require() caches
    const updatedConfig = loadConfigFromFile(configPath);
    mainWindow.webContents.send("config-reloaded", updatedConfig);
    mainWindow.webContents.send("update-available", {
      type: "patch",
      current: currentVersion,
      latest: latestVersion,
      notes,
    });

    return { status: "patch-applied", latestVersion };
  } catch (e) {
    return { status: "patch-error", message: e.message };
  }
}

// Load config safely from a file path (bypasses require cache)
function loadConfigFromFile(configPath) {
  try {
    // Remove from cache so we get fresh version
    delete require.cache[require.resolve(configPath)];
    return require(configPath);
  } catch (e) {
    return null;
  }
}

module.exports = { checkForUpdates, loadConfigFromFile };
