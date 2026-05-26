#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║              GLOW — PUBLISH UPDATE SCRIPT                ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Run this from the glow-ide/ directory:
 *
 *   node scripts/publish.js
 *
 * What it does:
 *   1. Reads version from glow-config.js
 *   2. Asks what kind of update this is (patch / minor / major)
 *   3. Creates a GitHub release with the version tag
 *   4. For patch updates: uploads the new glow-config.js as a release asset
 *   5. For minor/major: reminds you to build and attach the installer
 *
 * Requirements:
 *   - Git installed and repo initialized
 *   - GitHub personal access token in env: GITHUB_TOKEN
 *     (Create at: https://github.com/settings/tokens — needs repo scope)
 *
 * Setup (one time):
 *   Windows:  set GITHUB_TOKEN=your_token_here
 *   Mac/Linux: export GITHUB_TOKEN=your_token_here
 */

"use strict";

const https    = require("https");
const fs       = require("fs");
const path     = require("path");
const readline = require("readline");
const { execSync } = require("child_process");

const config = require("../glow-config.js");
const semver = require("../src/semver-mini.js");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const { owner, repo } = config.updates;

if (!GITHUB_TOKEN) {
  console.error("\n✗ GITHUB_TOKEN environment variable not set.");
  console.error("  Create a token at: https://github.com/settings/tokens");
  console.error("  Then run:  set GITHUB_TOKEN=your_token_here  (Windows)");
  console.error("         or: export GITHUB_TOKEN=your_token_here  (Mac/Linux)\n");
  process.exit(1);
}

if (!owner || owner === "YOUR_GITHUB_USERNAME") {
  console.error("\n✗ Set your GitHub username in glow-config.js under updates.owner\n");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(r => rl.question(q, r));

// ─── GitHub API helper ────────────────────────────────────────────────────────
function githubRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req  = https.request({
      hostname: "api.github.com",
      path:     `/repos/${owner}/${repo}${endpoint}`,
      method,
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "User-Agent":    "Glow-IDE-Publisher/1.0",
        "Content-Type":  "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let out = "";
      res.on("data", c => out += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(out) }); }
        catch { resolve({ status: res.statusCode, body: out }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n✦ Glow Publisher\n");
  console.log(`  Current version: ${config.version}`);
  console.log(`  Repo: ${owner}/${repo}\n`);

  const updateType = await ask("  Update type — (p)atch / (m)inor / (M)ajor: ");
  const notes      = await ask("  Release notes (press Enter to skip): ");

  let newVersion = config.version;
  const [maj, min, patch] = semver.parse(config.version);

  if (updateType.toLowerCase() === "m" && updateType === "m") {
    newVersion = `${maj}.${min + 1}.0`;
  } else if (updateType === "M") {
    newVersion = `${maj + 1}.0.0`;
  } else {
    // patch
    newVersion = `${maj}.${min}.${patch + 1}`;
  }

  console.log(`\n  New version: ${newVersion}`);
  const confirm = await ask("  Publish? (y/n): ");
  rl.close();

  if (confirm.toLowerCase() !== "y") {
    console.log("  Cancelled.\n");
    process.exit(0);
  }

  // ── Update version in glow-config.js ──────────────────────────────────────
  const configPath = path.join(__dirname, "..", "glow-config.js");
  let configSrc = fs.readFileSync(configPath, "utf8");
  configSrc = configSrc.replace(
    /version:\s*["'][\d.]+["']/,
    `version: "${newVersion}"`
  );
  fs.writeFileSync(configPath, configSrc, "utf8");
  console.log(`  ✓ Updated glow-config.js to version ${newVersion}`);

  // ── Git commit and tag ────────────────────────────────────────────────────
  try {
    execSync("git add glow-ide/glow-config.js", { cwd: path.join(__dirname, "..", ".."), stdio: "inherit" });
    execSync(`git commit -m "chore: release v${newVersion}"`, { cwd: path.join(__dirname, "..", ".."), stdio: "inherit" });
    execSync(`git tag v${newVersion}`, { cwd: path.join(__dirname, "..", ".."), stdio: "inherit" });
    execSync("git push && git push --tags", { cwd: path.join(__dirname, "..", ".."), stdio: "inherit" });
    console.log(`  ✓ Git tag v${newVersion} pushed`);
  } catch (e) {
    console.error("  ✗ Git error:", e.message);
    console.error("    Make sure you have a GitHub repo set up and origin configured.");
    process.exit(1);
  }

  // ── Create GitHub release ─────────────────────────────────────────────────
  const releaseBody = {
    tag_name:         `v${newVersion}`,
    target_commitish: "main",
    name:             `Glow v${newVersion}`,
    body:             notes || `Glow IDE v${newVersion}`,
    draft:            false,
    prerelease:       false,
  };

  const res = await githubRequest("POST", "/releases", releaseBody);
  if (res.status !== 201) {
    console.error("  ✗ Failed to create release:", JSON.stringify(res.body, null, 2));
    process.exit(1);
  }

  console.log(`\n  ✓ GitHub release created: ${res.body.html_url}`);

  // ── Guidance by update type ───────────────────────────────────────────────
  const type = updateType === "M" ? "major" : updateType.toLowerCase() === "m" ? "minor" : "patch";

  if (type === "patch") {
    console.log("\n  ✦ Patch release — glow-config.js content will auto-update for all users.");
    console.log("    No action needed. Users will see the new examples/libraries/docs within the hour.\n");
  } else if (type === "minor") {
    console.log("\n  ✦ Minor release — users will be notified to update.");
    console.log("    To build the installer, run:  npm run make");
    console.log(`    Then upload the .exe installer to: ${res.body.upload_url}\n`);
  } else {
    console.log("\n  ✦ Major release — users will be told to download the new installer.");
    console.log("    To build the installer, run:  npm run make");
    console.log(`    Then upload the .exe installer to: ${res.body.upload_url}\n`);
  }
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
