#!/usr/bin/env node
/**
 * glow — the Glow language CLI
 *
 * Usage:
 *   npm run glow myfile.glow          (dev, via tsx)
 *   node dist/glow.js myfile.glow     (after npm run build)
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join, extname, basename } from "path";
import { fileURLToPath } from "url";

import { Lexer, applyKeywordConfig } from "./lexer/Lexer.js";
import { Parser } from "./parser/Parser.js";
import { Interpreter, GlowRuntimeError } from "./runtime/Interpreter.js";
import { Statement } from "./ast/AST.js";

// ─── Find project root (where glow.config.json and package.json live) ────────
// When running via tsx:        __dirname === <project>/src   → go up one
// When running via node dist/: __dirname === <project>/dist  → go up one

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// ─── Load config ─────────────────────────────────────────────────────────────

const configPath = join(projectRoot, "glow.config.json");
let config: any = {};

if (existsSync(configPath)) {
  config = JSON.parse(readFileSync(configPath, "utf8"));
}

if (config.keywords) {
  applyKeywordConfig(config.keywords);
}

const libsDir  = config.libs?.dir ?? "libs";
const langExt  = config.language?.extension ?? ".glow";
const langName = config.language?.name ?? "Glow";

// ─── Parse a .glow file into an AST ──────────────────────────────────────────

function parseFile(filePath: string): Statement[] {
  const source = readFileSync(filePath, "utf8");
  const tokens = new Lexer(source).tokenize();
  return new Parser(tokens).parse();
}

// ─── Resolve an import path ──────────────────────────────────────────────────
//
// Priority:
//   1. Relative to the importing file's directory
//   2. libs/<name>  (project-local community libraries)
//
// The extension is optional in source — Glow adds it automatically.

function resolveImport(importPath: string, fromDir: string): string {
  const withExt = extname(importPath) ? importPath : importPath + langExt;

  const candidates = [
    resolve(fromDir, withExt),
    resolve(projectRoot, libsDir, withExt)
  ];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }

  throw new Error(
    `Cannot find import "${importPath}"\nSearched:\n` +
    candidates.map(c => "  " + c).join("\n")
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

const cliArgs = process.argv.slice(2);

if (cliArgs.length === 0) {
  console.error(`${langName} — usage: glow <file${langExt}>`);
  process.exit(1);
}

const entryFile = resolve(cliArgs[0]);

if (!existsSync(entryFile)) {
  console.error(`File not found: ${entryFile}`);
  process.exit(1);
}

// ─── Parse a file, with clean error output ────────────────────────────────────
function parseFileSafe(filePath: string) {
  try {
    return parseFile(filePath);
  } catch (e: any) {
    const rel = filePath.replace(resolve(".") + "/", "");
    console.error(`\n  Parse error in ${rel}:\n  ${e.message}\n`);
    process.exit(1);
  }
}

const interpreter = new Interpreter();
const imported    = new Set<string>();

interpreter.setImportResolver((importPath: string) => {
  const fromDir  = dirname(entryFile);
  const resolved = resolve(resolveImport(importPath, fromDir));
  if (imported.has(resolved)) return [];
  imported.add(resolved);
  return parseFileSafe(resolved)!;
});

// ─── Run, with clean Glow-style error output ──────────────────────────────────
try {
  interpreter.run(parseFileSafe(entryFile)!);
} catch (e: any) {
  const fileName = basename(entryFile);
  if (e.name === "GlowRuntimeError") {
    // Clean user-facing error from the `error()` built-in or file functions
    console.error(`\n  Error in ${fileName}:\n  ${e.message}\n`);
  } else if (e.message?.startsWith("Undefined variable:")) {
    const name = e.message.replace("Undefined variable: ", "");
    console.error(`\n  Error in ${fileName}:\n  '${name}' is not defined\n`);
  } else if (e.message?.startsWith("Can only call functions")) {
    console.error(`\n  Error in ${fileName}:\n  Tried to call something that isn't a function\n`);
  } else if (e.message?.startsWith("Cannot find import")) {
    console.error(`\n  ${e.message}\n`);
  } else {
    // Anything else — show message without the Node.js stack trace
    console.error(`\n  Error in ${fileName}:\n  ${e.message ?? e}\n`);
  }
  process.exit(1);
}
