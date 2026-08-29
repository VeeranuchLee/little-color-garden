#!/usr/bin/env node
"use strict";

// Integrity check for the Pixel Mosaic mode's palette + card system.
//
// The owner's constraint: every challenge card uses only colors available in
// the 30-color palette — no hidden extra colors, no shade a card needs that the
// child cannot pick. Cards are authored *in palette indices*, so this holds by
// construction; this script proves it anyway, because a promise only a comment
// makes is a promise the next edit can silently break.
//
// Run: node tools/check-pixel-cards.js   (from coloring-app/, any Node >= 12)

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const appDir = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(appDir, "pixel-cards.js"), "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const data = sandbox.window.PIXEL_CARDS;
if (!data) {
  console.error("FAIL: pixel-cards.js did not define window.PIXEL_CARDS");
  process.exit(1);
}

const problems = [];
const palette = data.palette;
const cards = data.cards;
const W = data.boardWidth;
const H = data.boardHeight;
const validCell = new Set([".", ...Array.from({ length: 36 }, (_, i) => i.toString(36))]);

// --- palette ---
if (palette.length !== 36) problems.push(`palette has ${palette.length} colors, expected 36`);
palette.forEach((color, index) => {
  if (!/^#[0-9a-f]{6}$/i.test(color.value)) problems.push(`palette ${index} has non-hex value ${color.value}`);
  if (typeof color.name !== "string" || !color.name) problems.push(`palette ${index} has no name`);
});
const values = new Set(palette.map((color) => color.value.toLowerCase()));
if (values.size !== palette.length) problems.push("palette contains duplicate color values");

// --- board + cards ---
if (W !== 20 || H !== 15) problems.push(`board is ${W}x${H}, expected 20x15`);
const ids = new Set();
cards.forEach((card) => {
  const label = card.id || "(no id)";
  if (ids.has(card.id)) problems.push(`duplicate card id ${card.id}`);
  ids.add(card.id);
  if (!Array.isArray(card.rows) || card.rows.length !== H) {
    problems.push(`${label}: has ${card.rows ? card.rows.length : 0} rows, expected ${H}`);
    return;
  }
  const used = new Set();
  card.rows.forEach((row, rowIndex) => {
    if (row.length !== W) problems.push(`${label} row ${rowIndex}: ${row.length} cells, expected ${W}`);
    for (const ch of row) {
      if (!validCell.has(ch)) problems.push(`${label} row ${rowIndex}: unknown cell "${ch}"`);
      else if (ch !== ".") {
        const index = parseInt(ch, 36);
        used.add(index);
        if (index >= palette.length) problems.push(`${label} row ${rowIndex}: index ${index} outside the palette`);
      }
    }
  });
  if (used.size < 2) problems.push(`${label}: uses fewer than 2 colors — likely a stub`);
  const swatches = [...used].sort((a, b) => a - b).map((i) => `${i.toString(36)}=${palette[i] && palette[i].name}`).join(" ");
  console.log(`${card.id.padEnd(12)} ${String(card.rows.join("").replace(/\./g, "").length).padStart(3)} cells  colors: ${swatches}`);
});

if (problems.length) {
  console.error(`\nFAIL: ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(`\nOK: ${palette.length} colors, ${cards.length} cards, every cell a palette index or empty.`);
