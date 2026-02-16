#!/usr/bin/env node
/**
 * Remplace le fond blanc de logo-eco.png par de la transparence.
 * Les pixels dont R,G,B >= SEUIL sont rendus transparents (alpha = 0).
 * Écrase public/logo-eco.png par la version avec alpha.
 */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const inputPath = join(root, "public", "logo-eco.png");
const outputPath = join(root, "public", "logo-eco.png");

const SEUIL = 245; // pixels avec R,G,B >= 245 considérés comme blancs → alpha 0

async function main() {
  const input = readFileSync(inputPath);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const channels = 4;
  const buf = Buffer.from(data);

  for (let i = 0; i < buf.length; i += channels) {
    const r = buf[i];
    const g = buf[i + 1];
    const b = buf[i + 2];
    if (r >= SEUIL && g >= SEUIL && b >= SEUIL) {
      buf[i + 3] = 0;
    }
  }

  await sharp(buf, { raw: { width, height, channels } })
    .png()
    .toFile(outputPath);

  console.log("OK: public/logo-eco.png remplacé par la version transparente.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
