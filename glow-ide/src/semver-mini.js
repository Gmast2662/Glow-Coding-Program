"use strict";

// Minimal semver compare — no external dependency
// Returns: -1 if a < b, 0 if equal, 1 if a > b

function parse(v) {
  return String(v).replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0);
}

function compare(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

module.exports = { compare, parse };
