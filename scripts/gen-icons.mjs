// Gera os PNGs do PWA a partir dos SVGs em scripts/icon-source*.svg.
// Reproducível: corre `node scripts/gen-icons.mjs` após editar os SVGs.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, "..");
const outDir = path.join(repo, "client/public/icons");
mkdirSync(outDir, { recursive: true });

const TASKS = [
  { src: "icon-source.svg",          out: "icon-192.png",      size: 192 },
  { src: "icon-source.svg",          out: "icon-512.png",      size: 512 },
  { src: "icon-source-maskable.svg", out: "icon-maskable.png", size: 512 }
];

for (const t of TASKS) {
  const svg = readFileSync(path.join(__dirname, t.src), "utf8");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: t.size } }).render().asPng();
  writeFileSync(path.join(outDir, t.out), png);
  console.log(`✓ ${t.out} (${t.size}×${t.size}, ${png.length} bytes)`);
}
