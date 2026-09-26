/**
 * Export PDF d'une fiche, 100 % navigateur : on ouvre une page imprimable
 * et le dialogue d'impression propose « Enregistrer en PDF ».
 * Aucun appel serveur, aucun coût.
 */

export interface FicheExport {
  title: string;
  dateLabel: string;
  resume: string;
  pointsCles: string[];
  notions: Array<{ terme: string; definition: string }>;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Convertit le résumé (Introduction / Contenu / Conclusion, listes) en HTML sûr. */
function resumeToHtml(resume: string): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };

  for (const raw of resume.replace(/\*\*/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (/^(Introduction|Contenu|Conclusion)\s*:\s*$/i.test(line) || /^#{1,4}\s/.test(line)) {
      closeList();
      out.push(`<h2>${esc(line.replace(/^#{1,4}\s*/, "").replace(/\s*:\s*$/, ""))}</h2>`);
      continue;
    }
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const kind = numbered ? "ol" : "ul";
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${esc((bullet ?? numbered)![1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${esc(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

export function exportFicheToPdf(fiche: FicheExport): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;

  const points = fiche.pointsCles.length
    ? `<section><h2>Points clés</h2><ul>${fiche.pointsCles.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>`
    : "";
  const notions = fiche.notions.length
    ? `<section><h2>Notions</h2><dl>${fiche.notions
        .map((n) => `<div class="notion"><dt>${esc(n.terme)}</dt><dd>${esc(n.definition || "—")}</dd></div>`)
        .join("")}</dl></section>`
    : "";

  win.document.write(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(fiche.title)} · ECO</title>
<style>
  @page { size: A4; margin: 18mm 18mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; line-height: 1.6; font-size: 11.5pt; margin: 0 auto; max-width: 720px; padding: 32px 24px; }
  header { border-bottom: 1px solid #ddd; padding-bottom: 14px; margin-bottom: 20px; }
  .meta { font: 9.5pt -apple-system, "Segoe UI", Arial, sans-serif; color: #777; text-transform: capitalize; }
  h1 { font-size: 24pt; line-height: 1.15; margin: 6px 0 0; font-weight: normal; }
  h2 { font: 600 10pt -apple-system, "Segoe UI", Arial, sans-serif; text-transform: uppercase; letter-spacing: .06em; color: #555; margin: 22px 0 8px; break-after: avoid; }
  p { margin: 0 0 9px; }
  ul, ol { margin: 0 0 10px; padding-left: 20px; }
  li { margin: 0 0 5px; }
  section { margin-top: 26px; }
  .notion { display: grid; grid-template-columns: 170px 1fr; gap: 14px; padding: 8px 0; border-top: 1px solid #eee; break-inside: avoid; }
  .notion:first-child { border-top: 0; }
  dt { font-weight: bold; }
  dd { margin: 0; color: #333; }
  footer { margin-top: 36px; font: 8.5pt -apple-system, "Segoe UI", Arial, sans-serif; color: #999; }
</style>
</head>
<body>
  <header>
    <div class="meta">${esc(fiche.dateLabel)}</div>
    <h1>${esc(fiche.title)}</h1>
  </header>
  <main>${resumeToHtml(fiche.resume)}${points}${notions}</main>
  <footer>Fiche générée avec ECO · econewapp.com</footer>
  <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 150); });</script>
</body>
</html>`);
  win.document.close();
  return true;
}
