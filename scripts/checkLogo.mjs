#!/usr/bin/env node
/**
 * Diagnostic: vérifie si logo-eco.png a un canal alpha (RGBA) ou non (RGB).
 * Lit le chunk IHDR du PNG et affiche le color type.
 * color type 0 = grayscale, 2 = RGB, 3 = palette, 4 = grayscale+alpha, 6 = RGBA
 */
import { createReadStream } from "fs";
import { pipeline } from "stream/promises";

const path = "public/logo-eco.png";
const stream = createReadStream(path, { start: 0, end: 32 });
const chunks = [];
for await (const c of stream) chunks.push(c);
const buf = Buffer.concat(chunks);

// PNG: 8 bytes signature, then first chunk (length 4 + type "IHDR" 4 + data 13)
const sig = buf.slice(0, 8);
const ihdrDataStart = 8 + 4 + 4; // after length + "IHDR"
const colorType = buf[ihdrDataStart + 9]; // 10th byte of IHDR

const hasAlpha = colorType === 4 || colorType === 6;
const colorNames = { 0: "grayscale", 2: "RGB", 3: "palette", 4: "grayscale+alpha", 6: "RGBA" };

console.log("PNG signature (8 octets):", sig.toString("hex"));
console.log("IHDR color type:", colorType, `(${colorNames[colorType] || "inconnu"})`);
console.log("Canal alpha (transparence):", hasAlpha ? "OUI (RGBA)" : "NON (RGB) - fond blanc possible dans l'image");
process.exit(hasAlpha ? 0 : 1);
