const MAX_CHARS_PER_PDF = 50000;

/**
 * Extrait le texte d'un fichier PDF côté client via pdfjs-dist.
 * Jamais uploadé sur un serveur — traitement 100% local.
 * @throws Error si le PDF est protégé, vide ou illisible
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  // Worker via CDN — évite les problèmes de bundling Next.js
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();

  let pdf: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  } catch {
    throw new Error(`PDF illisible ou protégé : ${file.name}`);
  }

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n";

    if (fullText.length >= MAX_CHARS_PER_PDF) {
      fullText = fullText.slice(0, MAX_CHARS_PER_PDF);
      break;
    }
  }

  const text = fullText.trim();
  if (!text) {
    throw new Error(
      `Aucun texte lisible dans ${file.name}. Le PDF est peut-être scanné ou basé sur des images.`
    );
  }

  return text;
}

/**
 * Concatène les textes extraits de plusieurs PDFs dans un bloc de contexte.
 */
export function buildPdfContextBlock(
  pdfs: Array<{ name: string; text: string }>
): string {
  return pdfs
    .map((p, i) => `=== PDF ${i + 1} : ${p.name} ===\n${p.text}\n===`)
    .join("\n\n");
}
