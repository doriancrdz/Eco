/**
 * Génère /public/og.png (1200×630)
 * Fond : gradient teal→bleu→lavande (#99f6e4 → #7dd3fc → #a5b4fc)
 * Logo "ECO" centré en blanc, tagline en dessous
 *
 * Usage : node scripts/generate-og.mjs
 */

import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../public/og.png");

const W = 1200;
const H = 630;

// Gradient horizontal via SVG linearGradient
const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#99f6e4"/>
      <stop offset="50%"  stop-color="#7dd3fc"/>
      <stop offset="100%" stop-color="#a5b4fc"/>
    </linearGradient>
  </defs>

  <!-- Fond gradient -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Overlay léger pour profondeur -->
  <rect width="${W}" height="${H}" fill="rgba(0,0,0,0.08)"/>

  <!-- Logo ECO -->
  <text
    x="${W / 2}"
    y="${H / 2 - 40}"
    font-family="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
    font-size="160"
    font-weight="900"
    fill="white"
    text-anchor="middle"
    dominant-baseline="middle"
    letter-spacing="-4"
  >ECO</text>

  <!-- Tagline -->
  <text
    x="${W / 2}"
    y="${H / 2 + 90}"
    font-family="'Arial', 'Helvetica Neue', Arial, sans-serif"
    font-size="36"
    font-weight="400"
    fill="rgba(255,255,255,0.90)"
    text-anchor="middle"
    dominant-baseline="middle"
    letter-spacing="0.5"
  >Tes cours audio, transform&#233;s en notes</text>
</svg>
`.trim();

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(OUT);

console.log(`✓ OG image générée → ${OUT}`);
