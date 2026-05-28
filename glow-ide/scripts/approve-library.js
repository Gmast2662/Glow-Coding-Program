#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║          GLOW IDE — Community Library Approver           ║
 * ║                                                          ║
 * ║  Run from glow-ide/:                                     ║
 * ║  node scripts/approve-library.js \                       ║
 * ║    --name "string-utils" \                               ║
 * ║    --display "String Utils" \                            ║
 * ║    --author "Bob" \                                      ║
 * ║    --description "..." \                                 ║
 * ║    --version "1.0.0" \                                   ║
 * ║    --code "func upper() { ... }"                         ║
 * ║                                                          ║
 * ║  Saves to ../community/{id}/ (glow-project/community)    ║
 * ║  All 6 fields are required.                              ║
 * ╚══════════════════════════════════════════════════════════╝
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ─── Colours (no deps) ───────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};
const ok = (s) => `${C.green}✔${C.reset}  ${s}`;
const warn = (s) => `${C.yellow}⚠${C.reset}  ${s}`;
const err = (s) => `${C.red}✖${C.reset}  ${s}`;
const info = (s) => `${C.cyan}→${C.reset}  ${s}`;
const dim = (s) => `${C.gray}${s}${C.reset}`;

// ─── Paths ────────────────────────────────────────────────────────────────────
// Script lives at glow-ide/scripts/approve-library.js
// Need to go up from glow-ide/ to glow-project/ root to find community/
const SCRIPT_DIR = __dirname;                                 // glow-ide/scripts/
const IDE_DIR = path.resolve(SCRIPT_DIR, "..");            // glow-ide/
const ROOT_DIR = path.resolve(IDE_DIR, "..");               // glow-project/
const COMMUNITY_DIR = path.join(ROOT_DIR, "community");
const REGISTRY_FILE = path.join(COMMUNITY_DIR, "community-index.json");

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    return { version: 1, updated: "", libraries: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
  } catch (e) {
    console.error(err(`Failed to parse registry: ${e.message}`));
    process.exit(1);
  }
}

function saveRegistry(registry) {
  registry.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 4) + "\n", "utf8");
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Validation ──────────────────────────────────────────────────────────────
function validateCode(code) {
  const errors = [];
  const warnings = [];

  if (!code || code.trim().length === 0) {
    errors.push("Code is empty.");
    return { errors, warnings };
  }

  // Must contain at least one func declaration
  const funcMatches = code.match(/\bfunc\s+\w+\s*\(/g) || [];
  if (funcMatches.length === 0) {
    errors.push('No "func" declarations found. Glow libraries must export functions.');
  }

  // Warn about suspicious patterns
  if (/require\s*\(/.test(code)) warnings.push('Contains require().');
  if (/process\./.test(code)) warnings.push('Contains process.*.');
  if (/eval\s*\(/.test(code)) warnings.push('Contains eval().');
  if (/import\s+/.test(code)) warnings.push('Contains ES imports.');

  return { errors, warnings };
}

function extractFuncNames(code) {
  const matches = code.match(/\bfunc\s+(\w+)\s*\(/g) || [];
  return matches.map(m => m.replace(/func\s+/, "").replace(/\s*\(.*/, ""));
}

// ─── Parse CLI args (handles multi-word values) ──────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const obj = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const values = [];
      i++;

      // Collect all values until next flag or end
      while (i < args.length && !args[i].startsWith("--")) {
        values.push(args[i]);
        i++;
      }

      // Join with spaces (handles multi-word values)
      if (values.length > 0) {
        obj[key] = values.join(" ");
      }

      // Back up one since the loop will increment
      i--;
    }
  }

  return obj;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log(`\n${C.bold}${C.cyan}Glow Library Approver${C.reset}`);
  console.log(dim(`Root: ${ROOT_DIR}\n`));

  ensureDir(COMMUNITY_DIR);

  const args = parseArgs();
  const { name, display, author, description, version, code } = args;

  // ── Validate arguments ──────────────────────────────────────────────────────
  const missing = [];
  if (!name) missing.push("--name");
  if (!display) missing.push("--display");
  if (!author) missing.push("--author");
  if (!description) missing.push("--description");
  if (!version) missing.push("--version");
  if (!code) missing.push("--code");

  if (missing.length > 0) {
    console.log(err("Missing required arguments:"));
    missing.forEach(arg => console.log(`     ${arg}`));
    console.log(dim("\nUsage:"));
    console.log(dim('  node scripts/approve-library.js \\'));
    console.log(dim('    --name "lib-id" \\'));
    console.log(dim('    --display "Display Name" \\'));
    console.log(dim('    --author "Author Name" \\'));
    console.log(dim('    --description "..." \\'));
    console.log(dim('    --version "1.0.0" \\'));
    console.log(dim('    --code "func foo() { ... }"\n'));
    process.exit(1);
  }

  // Normalize name to slug
  const id = slugify(name);

  if (!id || id.length === 0) {
    console.log(err(`Name "${name}" cannot be converted to a valid ID.`));
    process.exit(1);
  }

  console.log(`${C.bold}── ${id} ──────────────────────────────────────${C.reset}`);

  // ── Validate code ──────────────────────────────────────────────────────────
  const { errors: codeErrors, warnings: codeWarnings } = validateCode(code);

  if (codeWarnings.length > 0) {
    codeWarnings.forEach(w => console.log(warn(w)));
  }

  if (codeErrors.length > 0) {
    console.log(err("Code validation failed:"));
    codeErrors.forEach(e => console.log(`     ${C.red}•${C.reset} ${e}`));
    process.exit(1);
  }

  const funcs = extractFuncNames(code);
  console.log(ok(`Code valid (${funcs.length} function${funcs.length === 1 ? "" : "s"})`));
  console.log(dim(`     ${funcs.join(", ")}`));

  // ── Validate version ────────────────────────────────────────────────────────
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) {
    console.log(warn(`Version "${version}" doesn't match X.Y or X.Y.Z (auto-normalized)`));
  }

  // ── Load registry ───────────────────────────────────────────────────────────
  const registry = loadRegistry();

  // Check for duplicate ID and remove old entry/folder
  const existing = registry.libraries.find(l => l.id === id);
  if (existing) {
    console.log(info(`Library "${id}" already exists — updating.`));
    registry.libraries = registry.libraries.filter(l => l.id !== id);

    // Remove old folder if it exists
    const oldLibDir = path.join(COMMUNITY_DIR, id);
    if (fs.existsSync(oldLibDir)) {
      fs.rmSync(oldLibDir, { recursive: true, force: true });
      console.log(ok(`Removed old folder: community/${id}/`));
    }
  }

  // ── Create library folder ───────────────────────────────────────────────────
  const libDir = path.join(COMMUNITY_DIR, id);
  ensureDir(libDir);

  // ── Build registry entry ────────────────────────────────────────────────────
  const entry = {
    id,
    file: id,
    display,
    type: "community",
    version,
    author,
    desc: description,
    funcs,
    approved: new Date().toISOString().slice(0, 10),
  };

  registry.libraries.push(entry);
  console.log(ok("Registry entry created"));

  // ── Save .js file to community/{id}/ ────────────────────────────────────────
  const jsPath = path.join(libDir, `${id}.js`);
  fs.writeFileSync(jsPath, code + "\n", "utf8");
  console.log(ok(`Saved → community/${id}/${id}.js`));

  // ── Save metadata for reference ────────────────────────────────────────────
  const metaPath = path.join(libDir, `meta.json`);
  fs.writeFileSync(
    metaPath,
    JSON.stringify({
      author,
      description,
      version,
      approved: entry.approved,
    }, null, 2) + "\n",
    "utf8"
  );
  console.log(ok(`Saved → community/${id}/meta.json`));

  // ── Update registry ────────────────────────────────────────────────────────
  saveRegistry(registry);
  console.log(ok("Updated community-index.json"));

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}── Summary ──────────────────────────────────────────${C.reset}`);
  console.log(ok(`${display} v${version} by ${author}`));
  console.log(dim(`ID: ${id}`));
  console.log(dim(`Folder: community/${id}/`));
  console.log("");
  console.log(dim("Next steps:"));
  console.log(dim(`  1. Review community/${id}/${id}.js`));
  console.log(dim("  2. Bump patch version in ../glow-config.js"));
  console.log(dim('  3. npm run release\n'));
}

main();