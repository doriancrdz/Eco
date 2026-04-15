export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { summaryLimiter } from "@/lib/ratelimit";
import { waitUntil } from "@vercel/functions";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Modèle configurable (priorité vitesse) — ex: gpt-4o-mini, gpt-3.5-turbo
const AI_SUMMARY_MODEL = process.env.AI_SUMMARY_MODEL || "gpt-4o-mini";

/**
 * Format JSON strict attendu (limites courtes pour latence)
 */
interface StructuredSummary {
  structuredSummary: {
    title: string;
    sections: Array<{ heading: string; content: string }>;
  };
  keyPoints: string[];
  notions: Array<{ term: string; definition: string }>;
}

/**
 * Normalise le JSON vers le format Eco (rétrocompatibilité affichage)
 */
function toLegacyFormat(raw: StructuredSummary) {
  const ss = raw.structuredSummary;
  const title = ss?.title || "Résumé";
  const resume = ss?.sections?.map((s) => s.content).join(" ") || "";
  const pointsCles = raw.keyPoints || [];
  const notions = (raw.notions || []).map((n) =>
    typeof n === "string" ? n : `${n.term}: ${n.definition}`
  );
  return { titre: title, resume, pointsCles, notions };
}

/**
 * PHASE B: Génération du résumé (asynchrone, anti double-run)
 * - 1 seul appel OpenAI, JSON strict, limites courtes
 * - Si aiStatus === DONE → retour immédiat (pas de regen)
 * - Si aiStatus === GENERATING → 202 (ne pas relancer)
 */
export async function POST(req: NextRequest) {
  const perfStart = performance.now();
  const timings: Record<string, number> = {};
  let recordingIdForError: string | undefined;
  const traceId = req.headers.get("x-eco-trace") ?? null;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Clé API OpenAI manquante côté serveur." },
        { status: 500 }
      );
    }

    // Lire le body en premier (nécessaire pour l'auth interne)
    const body = await req.json();
    const { recordingId, internalUserId } = body;
    recordingIdForError = typeof recordingId === "string" ? recordingId : undefined;

    if (!recordingId || typeof recordingId !== "string") {
      return NextResponse.json({ error: "recordingId requis" }, { status: 400 });
    }

    // Auth : soit via Clerk (appel navigateur), soit via HMAC interne (appel transcribe/background)
    let resolvedUserId: string | null = null;
    const internalKeyHeader = req.headers.get("x-internal-key");

    if (internalKeyHeader && typeof internalUserId === "string") {
      const { createHmac, timingSafeEqual } = await import("crypto");
      // Préférer INTERNAL_HMAC_SECRET dédié ; fallback OPENAI_API_KEY pour rétrocompatibilité
      const hmacSecret = process.env.INTERNAL_HMAC_SECRET ?? process.env.OPENAI_API_KEY ?? "internal";
      const expectedKey = createHmac("sha256", hmacSecret)
        .update(`${recordingId}:${internalUserId}`)
        .digest("hex");
      try {
        const match = timingSafeEqual(
          Buffer.from(internalKeyHeader, "hex"),
          Buffer.from(expectedKey, "hex")
        );
        if (match) resolvedUserId = internalUserId;
      } catch {
        // Buffers de longueur différente → clé invalide
      }
    }

    if (!resolvedUserId) {
      // Appel navigateur : vérifier Clerk session
      const authStart = performance.now();
      const { userId } = await auth();
      timings.auth = performance.now() - authStart;
      resolvedUserId = userId ?? null;
    }

    if (!resolvedUserId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Rate limiting résumés IA : 5 par heure par utilisateur
    const { success } = await summaryLimiter.limit(resolvedUserId);
    if (!success) {
      return NextResponse.json(
        { error: "Trop de résumés générés. Réessayez dans 1 heure." },
        { status: 429 }
      );
    }

    const userId = resolvedUserId;

    const dbReadStart = performance.now();
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const recording = await prisma.recording.findFirst({
      where: {
        id: recordingId,
        userId: user.id,
      },
    });
    timings.dbRead = performance.now() - dbReadStart;

    if (!recording) {
      return NextResponse.json(
        { error: "Recording introuvable" },
        { status: 404 }
      );
    }

    recordingIdForError = recordingId;
    if (process.env.NODE_ENV === "development") {
      console.log("[summary] start", { traceId, recordingId, userId: user.id, ts: Date.now() });
    }

    // DONE (ou ancien format) → retour direct, pas de regen
    if (recording.aiStatus === "DONE" || (recording.status === "DONE" && recording.summaryJson)) {
      timings.total = performance.now() - perfStart;
      if (process.env.NODE_ENV === "development") {
        console.log("[generate-summary] ⏱️ RETOUR CACHE (DONE)", {
          recordingId,
          totalMs: timings.total.toFixed(2),
        });
      }
      let summary;
      try {
        summary = JSON.parse(recording.summaryJson!);
      } catch {
        summary = { titre: "Résumé", resume: "", pointsCles: [], notions: [] };
      }
      return NextResponse.json({
        recordingId,
        summary,
        status: "DONE",
        fromCache: true,
        timings: process.env.NODE_ENV === "development" ? timings : undefined,
      });
    }

    // GENERATING → 202, ne pas relancer
    if (recording.aiStatus === "GENERATING") {
      timings.total = performance.now() - perfStart;
      if (process.env.NODE_ENV === "development") {
        console.log("[generate-summary] 202 ALREADY GENERATING", { recordingId });
      }
      return NextResponse.json(
        {
          recordingId,
          status: "GENERATING",
          message: "Génération déjà en cours",
        },
        { status: 202 }
      );
    }

    if (!recording.transcriptionText || recording.transcriptionText.trim() === "") {
      if (process.env.NODE_ENV === "development") {
        console.log("[summary] TRANSCRIPTION_MISSING", { traceId, recordingId });
      }
      return NextResponse.json(
        { error: "TRANSCRIPTION_MISSING", code: "TRANSCRIPTION_MISSING" },
        { status: 400 }
      );
    }

    // LOCK: passer en GENERATING
    const lockStart = performance.now();
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        aiStatus: "GENERATING",
        aiStartedAt: new Date(),
      },
    });
    timings.dbLock = performance.now() - lockStart;

    const textToSend = recording.transcriptionText;
    const textLength = textToSend.length;
    // Couvrir jusqu'à 60 min d'audio (~39 000 chars) — GPT-4o-mini supporte 128k tokens
    const maxChars = 80000;
    const truncated = textLength > maxChars ? textToSend.slice(0, maxChars) + "\n[...]" : textToSend;

    // Nombre de mots de la transcription — RÈGLES DÉFINITIVES STRICTES
    const transcriptionWordCount = textToSend.trim().split(/\s+/).filter(Boolean).length;
    // RÈGLE 1 : RÉSUMÉ = EXACTEMENT 15% DE LA TRANSCRIPTION
    const targetSummaryWords = Math.round(transcriptionWordCount * 0.15);
    const minSummaryWords = targetSummaryWords - 10;
    const maxSummaryWords = targetSummaryWords + 10;
    // RÈGLE 2 : POINTS CLÉS = 1 TOUS LES 800 MOTS (MINIMUM 1)
    const targetPointsCles = Math.max(1, Math.round(transcriptionWordCount / 800));
    // RÈGLE 3 : NOTIONS = 1 TOUS LES 550 MOTS (MINIMUM 1)
    const targetNotions = Math.max(1, Math.round(transcriptionWordCount / 550));

    const estimatedTokens = targetSummaryWords * 1.5 + targetPointsCles * 35 * 1.5 + targetNotions * 60 * 1.5;
    const maxTokens = Math.max(3000, Math.ceil(estimatedTokens + 1000));
    if (process.env.NODE_ENV === "development") {
      console.log("[generate-summary] max_tokens:", maxTokens);
      console.log("[generate-summary] Calcul STRICT DÉFINITIF:", {
      transcriptionWords: transcriptionWordCount,
      summaryTarget: `${targetSummaryWords} mots (16%)`,
      summaryRange: `${minSummaryWords}-${maxSummaryWords}`,
      pointsClesTarget: targetPointsCles,
      notionsTarget: targetNotions,
    });
      console.log("[generate-summary] Appel OpenAI", {
      recordingId,
      model: AI_SUMMARY_MODEL,
      transcriptionLength: textLength,
      sentLength: truncated.length,
      maxTokens,
    });
    }

    const systemPrompt = `Tu es un expert en synthèse de contenu audio, spécialisé dans la prise de notes académiques.

═══════════════════════════════════════════════════════════════
STRUCTURE JSON OBLIGATOIRE (IMMUABLE)
═══════════════════════════════════════════════════════════════

{
  "titre": "Titre descriptif du cours",
  "sections": [
    {
      "titre": "Titre thématique descriptif de cette section",
      "texte": "Contenu de la section en prose fluide OU en liste à puces si le contenu s'y prête"
    }
  ],
  "pointsCles": ["Point 1", "Point 2", ...],
  "notions": [
    {
      "terme": "Terme important",
      "definition": "Définition claire (1-2 phrases)"
    }
  ]
}

═══════════════════════════════════════════════════════════════
RÈGLE 1 — TITRES DE SECTIONS (CRITIQUE)
═══════════════════════════════════════════════════════════════

Les titres de sections DOIVENT être descriptifs et thématiques, tirés du contenu réel du cours.

BONS titres (à imiter) :
- "La crise financière de 1787"
- "Les mécanismes de la photosynthèse"
- "Calcul de la VAN et du TRI"
- "Relations complexes autour de Kitty"
- "Les trois théories de la motivation"
- "Impact de la mondialisation sur l'emploi"

MAUVAIS titres (INTERDITS — aucune exception) :
- "Introduction", "Développement", "Conclusion"
- "Partie 1", "Partie 2", "Contexte"
- "Contenu principal", "Synthèse", "Pour résumer"
- "Vue d'ensemble", "Présentation du sujet"
- Tout titre générique qui ne décrit pas le contenu réel

INTERDICTION FORMELLE : les mots "Introduction", "Contenu", "Conclusion", "Développement", "Partie", "Synthèse" sont INTERDITS dans les titres de sections.

═══════════════════════════════════════════════════════════════
RÈGLE 2 — NOMBRE DE SECTIONS
═══════════════════════════════════════════════════════════════

Le nombre de sections doit s'adapter au volume du contenu :
- Cours court (< 500 mots de transcription) : 2-3 sections
- Cours moyen (500-2000 mots) : 3-5 sections
- Cours long (> 2000 mots) : 4-8 sections
- Jamais moins de 2 sections, jamais plus de 8 sections

Chaque section couvre un thème distinct et cohérent du cours.

═══════════════════════════════════════════════════════════════
RÈGLE 3 — FORMAT DU TEXTE DE CHAQUE SECTION
═══════════════════════════════════════════════════════════════

Choisir le format selon la nature du contenu de la section :

FORMAT LISTE (puces "-") → si la section contient :
- Une énumération d'éléments distincts
- Des étapes séquentielles
- Des exemples ou types à lister
- Un top-X ou classement

FORMAT PROSE → pour tout le reste :
- Explication d'un concept
- Démonstration, raisonnement
- Récit, témoignage, analyse

Exemple FORMAT LISTE :
"texte": "- Marketing de contenu : créer des articles de blog pour attirer des clients organiquement\n- Réseaux sociaux : utiliser Instagram et TikTok pour toucher une audience jeune\n- Email marketing : fidéliser les clients avec des newsletters personnalisées"

Exemple FORMAT PROSE :
"texte": "La photosynthèse est le processus par lequel les plantes convertissent la lumière solaire en énergie chimique. Ce mécanisme se déroule dans les chloroplastes et produit du glucose à partir de CO₂ et d'eau."

═══════════════════════════════════════════════════════════════
RÈGLE 4 — LONGUEUR ET EXHAUSTIVITÉ
═══════════════════════════════════════════════════════════════

- Longueur cible totale (toutes sections réunies) : ${targetSummaryWords} mots (±10%)
- Répartir les mots proportionnellement entre les sections selon leur importance
- TOUS les éléments de la transcription DOIVENT être présents
- Ordre chronologique / logique strict, comme dans le cours original
- Zéro point important oublié
- Plus l'audio est long → plus le résumé est détaillé (proportionnel)

═══════════════════════════════════════════════════════════════
RÈGLE 5 — NOTIONS
═══════════════════════════════════════════════════════════════

Générer ${targetNotions} notion(s) avec terme + définition.

Exemples de notions à extraire :
- Noms propres (EDHEC, ChatGPT, Anna)
- Concepts techniques (ROI, photosynthèse, VAN)
- Acronymes (IA, SaaS, TRI)
- Termes spécifiques au domaine

Format obligatoire :
{
  "terme": "VAN (Valeur Actuelle Nette)",
  "definition": "Indicateur financier mesurant la valeur présente des flux futurs d'un investissement, actualisés au coût du capital."
}

═══════════════════════════════════════════════════════════════
RÈGLE 6 — POINTS CLÉS
═══════════════════════════════════════════════════════════════

Générer ${targetPointsCles} point(s) clé(s) dans l'ordre chronologique du cours.

Chaque point clé = une idée importante développée en 1-2 lignes complètes (pas une phrase trop courte).
Exemple : "Le marketing de contenu génère du trafic organique durable en créant des articles de blog qui attirent naturellement les clients sans dépenser en publicité."

═══════════════════════════════════════════════════════════════
EXEMPLE COMPLET
═══════════════════════════════════════════════════════════════

{
  "titre": "Les stratégies marketing digitales en 2026",
  "sections": [
    {
      "titre": "Marketing de contenu et SEO",
      "texte": "Le marketing de contenu consiste à créer des articles, vidéos et podcasts pour attirer naturellement des clients. Cette approche génère du trafic organique durable sans dépenser en publicité payante. Le SEO amplifie cette stratégie en optimisant la visibilité sur Google."
    },
    {
      "titre": "Les plateformes sociales à privilégier",
      "texte": "- Instagram : idéal pour les marques visuelles et le lifestyle, audience 18-35 ans\n- TikTok : format vidéo court, fort potentiel viral, audience très jeune\n- LinkedIn : B2B uniquement, contenu professionnel et thought leadership\n- YouTube : contenu long format, meilleure rétention et référencement"
    },
    {
      "titre": "Mesure de performance et ROI",
      "texte": "Chaque campagne doit être évaluée selon des KPIs précis : taux de conversion, coût d'acquisition client (CAC) et retour sur investissement (ROI). L'analyse des données permet d'optimiser les budgets en temps réel et de concentrer les ressources sur les canaux les plus rentables."
    }
  ],
  "pointsCles": [
    "Le marketing de contenu génère du trafic organique durable en créant des ressources qui attirent naturellement les prospects sur le long terme.",
    "Les réseaux sociaux doivent être choisis selon l'audience cible et le type de contenu produit, pas selon leur popularité générale.",
    "La mesure systématique du ROI permet de réallouer les budgets vers les canaux les plus performants et d'éliminer les dépenses inefficaces."
  ],
  "notions": [
    {
      "terme": "SEO (Search Engine Optimization)",
      "definition": "Ensemble des techniques visant à améliorer le positionnement d'un site web dans les résultats des moteurs de recherche comme Google."
    },
    {
      "terme": "ROI (Return On Investment)",
      "definition": "Indicateur mesurant la rentabilité d'un investissement en comparant les gains générés au coût engagé."
    }
  ]
}

═══════════════════════════════════════════════════════════════
CHECKLIST FINALE
═══════════════════════════════════════════════════════════════

Avant de renvoyer le JSON, vérifie :
✓ Chaque titre de section est descriptif et thématique (zéro "Introduction", "Conclusion", etc.)
✓ Nombre de sections entre 2 et 8, adapté au volume du cours
✓ Texte en prose ou en liste selon la nature du contenu de chaque section
✓ ${targetPointsCles} points clés générés dans l'ordre chronologique
✓ ${targetNotions} notions avec terme ET définition
✓ Longueur totale ≈ ${targetSummaryWords} mots (±10%)
✓ TOUS les éléments de la transcription présents
✓ Ordre chronologique / logique respecté

═══════════════════════════════════════════════════════════════

Transcription à résumer : voir le message utilisateur ci-dessous.

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    // Safety guard : pdfContext + transcription ne doit pas dépasser ~100 000 tokens
    // 100 000 tokens × 4 chars/token = 400 000 chars
    const MAX_TOTAL_CONTEXT_CHARS = 400_000;
    let pdfContextSafe = recording.pdfContext ?? "";
    if (pdfContextSafe) {
      const totalChars = pdfContextSafe.length + truncated.length;
      if (totalChars > MAX_TOTAL_CONTEXT_CHARS) {
        const allowedPdfChars = Math.max(0, MAX_TOTAL_CONTEXT_CHARS - truncated.length);
        console.warn(`[ECO] pdfContext tronqué recordingId=${recordingId} original=${pdfContextSafe.length} tronquéÀ=${allowedPdfChars}`);
        pdfContextSafe = pdfContextSafe.slice(0, allowedPdfChars);
      }
    }

    const pdfContextBlock = pdfContextSafe
      ? `CONTEXTE DU COURS (ne pas résumer ce document) :
Le document suivant est fourni uniquement comme contexte de référence.
Il t'aide à comprendre le vocabulaire, les notions et le cadre du cours.
Tu dois résumer UNIQUEMENT ce qui a été dit dans l'audio.
Utilise ce document pour mieux identifier et définir les notions importantes mentionnées dans l'audio, enrichir le quiz avec des questions pertinentes, et préciser les points clés.

${pdfContextSafe}

---
`
      : "";

    const userPrompt = `${pdfContextBlock}Transcription complète (${transcriptionWordCount} mots) :

${truncated}`;

    console.log(`[ECO] generate-summary start recordingId=${recordingId} words=${transcriptionWordCount} ts=${Date.now()}`);
    const gptStart = performance.now();
    const completion = await openai.chat.completions.create({
      model: AI_SUMMARY_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: maxTokens,
    });

    timings.gptSummary = performance.now() - gptStart;
    console.log(`[ECO] generate-summary GPT done recordingId=${recordingId} gptMs=${timings.gptSummary.toFixed(0)} ts=${Date.now()}`);

    const summaryContent =
      completion.choices[0]?.message?.content ??
      '{"titre":"Résumé","introduction":"","contenu":{"type":"narratif","sections":[]},"conclusion":"","pointsCles":[],"notions":[]}';

    let summary: { titre: string; resume: string; pointsCles: string[]; notions: Array<{ terme: string; definition: string }> | string[] };

    // Transforme le JSON structuré en markdown.
    // Nouveau format (sections thématiques) → titres en **gras**, séparés par 2 sauts de ligne.
    // Ancien format (introduction/contenu/conclusion) → conservé tel quel pour rétrocompatibilité.
    function structuredJsonToMarkdown(data: {
      // Nouveau format
      sections?: Array<{ titre?: string; texte?: string }>;
      // Ancien format
      introduction?: string;
      contenu?: { type?: string; sections?: Array<{ titre?: string; texte?: string }> };
      conclusion?: string;
    }): string {
      // NOUVEAU FORMAT : sections thématiques avec titres en gras
      if (data.sections && Array.isArray(data.sections)) {
        const parts: string[] = [];
        for (const section of data.sections) {
          const titre = (section.titre ?? "").trim();
          const texte = (section.texte ?? "").trim();
          if (!texte) continue;
          parts.push(titre ? `**${titre}**\n${texte}` : texte);
        }
        return parts.join("\n\n\n");
      }

      // ANCIEN FORMAT : introduction + contenu + conclusion (rétrocompatibilité)
      const intro = (data.introduction ?? "").trim();
      const concl = (data.conclusion ?? "").trim();
      const sections = data.contenu?.sections ?? [];
      const typeContenu = (data.contenu?.type ?? "narratif").toLowerCase();

      // Titres simples (sans gras, sans soulignement), 2 lignes vides entre sections
      let resumeMarkdown = `Introduction:\n${intro}\n\n\nContenu:\n`;

      if (typeContenu === "liste") {
        // Numérotation 1., 2., 3. pour les listes
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          const titre = (section.titre ?? "").trim();
          const texte = (section.texte ?? "").trim();
          resumeMarkdown += `${i + 1}. ${titre}\n${texte}\n\n`;
        }
      } else {
        // Paragraphes simples pour le narratif (1 ligne vide entre chaque)
        for (const section of sections) {
          const texte = (section.texte ?? "").trim();
          if (texte) resumeMarkdown += `${texte}\n\n`;
        }
      }

      resumeMarkdown += `\n\nConclusion:\n${concl}`;
      return resumeMarkdown;
    }

    // Normaliser les notions : terme + definition (obligatoire pour le nouveau format)
    function normalizeNotions(notions: unknown): Array<{ terme: string; definition: string }> {
      if (!Array.isArray(notions)) return [];
      return notions.map((n) => {
        if (typeof n === "string") {
          return { terme: n, definition: "" };
        }
        if (typeof n === "object" && n !== null && ("terme" in n || "term" in n)) {
          const term = "terme" in n ? (n as { terme?: string }).terme : (n as { term?: string }).term;
          const def = "definition" in n ? (n as { definition?: string }).definition : "";
          return {
            terme: typeof term === "string" ? term : "",
            definition: typeof def === "string" ? def : "",
          };
        }
        return { terme: String(n), definition: "" };
      });
    }

    /**
     * Dérive un titre lisible depuis le JSON résumé.
     * 1. Prend le "titre" généré par GPT si non générique
     * 2. Fallback : 6 premiers mots significatifs de l'introduction
     * 3. Nettoyage : guillemets supprimés, max 60 chars, coupe au dernier mot entier
     */
    function deriveSmartTitle(titre: string, resume: string): string {
      const MAX = 60;
      const GENERIC = new Set(["résumé", "résumé du cours", "resume", "summary", ""]);
      const STOPWORDS = new Set(["le","la","les","de","du","des","un","une","et","en","à","au","aux","l","d","ce","se","sa","son","ses","mon","ton","ma","ta","je","tu","il","elle","on","nous","vous","ils","elles","qui","que","quoi","dont","où","par","pour","sur","sous","dans","avec","sans","mais","ou","car","ni","or","donc"]);

      // 1. Nettoyer le titre IA
      let candidate = titre
        .replace(/["""''«»‹›`]/g, "")
        .trim();

      // 2. Si générique ou vide → extraire depuis l'introduction
      if (GENERIC.has(candidate.toLowerCase())) {
        const introMatch = resume.match(/Introduction:\n([\s\S]*?)(?:\n\n|\n\s*\n|$)/);
        const introText = introMatch ? introMatch[1].trim() : resume.substring(0, 200);

        const words = introText.split(/\s+/);
        const significant = words
          .map(w => w.replace(/[.,;:!?«»"""''\-–—()\[\]]/g, "").trim())
          .filter(w => w.length > 2 && !STOPWORDS.has(w.toLowerCase()));

        candidate = significant.slice(0, 6).join(" ");
      }

      if (!candidate) return "Résumé";

      // 3. Tronquer à MAX chars sur un mot entier
      if (candidate.length <= MAX) return candidate;
      const cut = candidate.slice(0, MAX);
      const lastSpace = cut.lastIndexOf(" ");
      return lastSpace > 10 ? cut.slice(0, lastSpace) : cut;
    }

    try {
      // Nettoyer le contenu (l'IA peut renvoyer du markdown autour du JSON)
      let rawContent = summaryContent.trim();
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) rawContent = jsonMatch[0];

      const parsed = JSON.parse(rawContent) as {
        titre?: string;
        sections?: Array<{ titre?: string; texte?: string }>;
        introduction?: string;
        contenu?: { type?: string; sections?: Array<{ titre?: string; texte?: string }> };
        conclusion?: string;
        pointsCles?: string[];
        notions?: Array<{ terme?: string; definition?: string; term?: string }>;
        resume?: string;
        structuredSummary?: StructuredSummary["structuredSummary"];
        keyPoints?: string[];
      };

      // NOUVEAU FORMAT : sections thématiques (titres descriptifs, sans Introduction/Contenu/Conclusion)
      if (parsed.sections && Array.isArray(parsed.sections)) {
        const resumeMarkdown = structuredJsonToMarkdown(parsed);
        const notionsNorm = normalizeNotions(parsed.notions);
        summary = {
          titre: typeof parsed.titre === "string" ? parsed.titre : "Résumé",
          resume: resumeMarkdown,
          pointsCles: Array.isArray(parsed.pointsCles) ? parsed.pointsCles : [],
          notions: notionsNorm,
        };
      } else if (
      // Ancien format : introduction + contenu + conclusion (structure JSON forcée)
        parsed.introduction != null &&
        parsed.contenu != null &&
        Array.isArray(parsed.contenu.sections) &&
        parsed.conclusion != null
      ) {
        const resumeMarkdown = structuredJsonToMarkdown(parsed);
        const notionsNorm = normalizeNotions(parsed.notions);
        summary = {
          titre: typeof parsed.titre === "string" ? parsed.titre : "Résumé",
          resume: resumeMarkdown,
          pointsCles: Array.isArray(parsed.pointsCles) ? parsed.pointsCles : [],
          notions: notionsNorm,
        };
      } else if (parsed.titre && parsed.resume !== undefined) {
        // Ancien format (titre + resume texte libre) — rétrocompatibilité
        summary = {
          titre: parsed.titre || "Résumé",
          resume: parsed.resume || "",
          pointsCles: Array.isArray(parsed.pointsCles) ? parsed.pointsCles : [],
          notions: normalizeNotions(parsed.notions),
        };
      } else if (parsed.structuredSummary) {
        const rawSummary: StructuredSummary = {
          structuredSummary: parsed.structuredSummary,
          keyPoints: parsed.keyPoints || [],
          notions:
            (parsed.notions as Array<{ term?: string; definition?: string }>)?.map((n) =>
              typeof n === "string" ? { term: n, definition: "" } : { term: n?.term ?? "", definition: n?.definition ?? "" }
            ) ?? [],
        };
        const legacySummary = toLegacyFormat(rawSummary);
        summary = {
          titre: legacySummary.titre,
          resume: legacySummary.resume,
          pointsCles: legacySummary.pointsCles,
          notions: normalizeNotions(legacySummary.notions),
        };
      } else {
        summary = {
          titre: "Résumé",
          resume: textToSend.substring(0, 200) + "...",
          pointsCles: [],
          notions: [],
        };
      }

      const resumeWordCount = summary.resume?.trim().split(/\s+/).filter(Boolean).length ?? 0;
      const pointsClesCount = summary.pointsCles?.length ?? 0;
      const notionsCount = summary.notions?.length ?? 0;
      if (process.env.NODE_ENV === "development") {
        console.log("[generate-summary] Résultat:", {
          resumeWords: resumeWordCount,
          resumeTarget: targetSummaryWords,
          resumeOK: Math.abs(resumeWordCount - targetSummaryWords) <= 10,
          pointsCles: pointsClesCount,
          pointsClesTarget: targetPointsCles,
          pointsClesOK: pointsClesCount === targetPointsCles,
          notions: notionsCount,
          notionsTarget: targetNotions,
          notionsOK: notionsCount === targetNotions,
        });
        if (Math.abs(resumeWordCount - targetSummaryWords) > 10) {
          console.warn("⚠️ [generate-summary] RÉSUMÉ HORS CIBLE !", { obtenu: resumeWordCount, cible: targetSummaryWords });
        }
        if (pointsClesCount !== targetPointsCles) {
          console.warn("⚠️ [generate-summary] POINTS CLÉS INCORRECTS !", { obtenu: pointsClesCount, cible: targetPointsCles });
        }
        if (notionsCount !== targetNotions) {
          console.warn("⚠️ [generate-summary] NOTIONS INCORRECTES !", { obtenu: notionsCount, cible: targetNotions });
        }
        console.log("[generate-summary] Résumé parsé", {
          hasTitre: !!summary.titre,
          resumeLength: summary.resume?.length || 0,
          gptMs: timings.gptSummary.toFixed(2),
        });
      }
    } catch (parseError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[generate-summary] Erreur parsing JSON:", parseError);
      }
      summary = {
        titre: "Résumé",
        resume: textToSend.substring(0, 200) + "...",
        pointsCles: [],
        notions: [],
      };
    }

    // Validation structure — log Vercel si le résumé est invalide
    {
      const isLegacyFormat = summary.resume.includes("Introduction:");
      if (isLegacyFormat) {
        // Ancien format : vérifier les trois sections obligatoires
        const hasIntro = true; // déjà confirmé ci-dessus
        const hasContenu = summary.resume.includes("Contenu:");
        const hasConclusion = summary.resume.includes("Conclusion:");
        if (!hasContenu || !hasConclusion) {
          console.warn("[ECO] STRUCTURE MANQUANTE (ancien format)", {
            recordingId,
            hasContenu,
            hasConclusion,
            resumeSnippet: summary.resume.substring(0, 300),
          });
        }
      } else {
        // Nouveau format sections[] : vérifier qu'il y a au moins 2 sections en gras
        const boldCount = (summary.resume.match(/\*\*[^*]+\*\*/g) ?? []).length;
        if (!summary.resume.trim() || boldCount < 2) {
          console.warn("[ECO] STRUCTURE INSUFFISANTE (nouveau format)", {
            recordingId,
            boldSectionsFound: boldCount,
            resumeSnippet: summary.resume.substring(0, 300),
          });
        }
      }
    }

    const summaryJson = JSON.stringify(summary);
    if (process.env.NODE_ENV === "development") {
      console.log("[summary] generated", { hasJson: !!summaryJson, size: summaryJson?.length ?? 0, ts: Date.now() });
    }

    // Extraire un titre intelligent depuis le résumé IA
    const smartTitle = deriveSmartTitle(summary.titre, summary.resume);
    if (process.env.NODE_ENV === "development") {
      console.log("[summary] smartTitle", { raw: summary.titre, derived: smartTitle });
    }

    const dbUpdateStart = performance.now();
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: "DONE",
        aiStatus: "DONE",
        aiFinishedAt: new Date(),
        aiError: null,
        summaryJson,
      },
    });
    if (process.env.NODE_ENV === "development") {
      console.log("[summary] recording updated", { recordingId, ts: Date.now() });
    }

    // Sync Eco — sans quiz (quiz généré en arrière-plan après la réponse)
    const contentStr = summaryJson;
    const updatedEco = await prisma.eco.upsert({
      where: { id: recordingId },
      create: {
        id: recordingId,
        userId: user.id,
        title: smartTitle,
        content: contentStr,
        transcriptionText: recording.transcriptionText,
      },
      update: {
        title: smartTitle,
        content: contentStr,
      },
      select: { id: true, content: true, title: true },
    });
    const contentLen = updatedEco?.content?.length ?? 0;
    timings.dbUpdate = performance.now() - dbUpdateStart;
    timings.total = performance.now() - perfStart;
    console.log(`[ECO] generate-summary DONE recordingId=${recordingId} totalMs=${timings.total.toFixed(0)} gptMs=${timings.gptSummary?.toFixed(0)} ts=${Date.now()}`);
    if (process.env.NODE_ENV === "development") {
      console.log("[summary] end", {
        traceId,
        recordingId,
        contentLen,
        ts: Date.now(),
      });
      console.log("[generate-summary] ⏱️ TIMINGS:", {
        auth: `${timings.auth?.toFixed(2)}ms`,
        dbRead: `${timings.dbRead?.toFixed(2)}ms`,
        dbLock: `${timings.dbLock?.toFixed(2)}ms`,
        gptSummary: `${timings.gptSummary?.toFixed(2)}ms`,
        dbUpdate: `${timings.dbUpdate?.toFixed(2)}ms`,
        total: `${timings.total?.toFixed(2)}ms`,
        model: AI_SUMMARY_MODEL,
      });
    }

    // Génération du quiz en arrière-plan (timeout strict 20s — n'affecte pas le temps de réponse)
    const durationMinutes =
      recording.durationMs != null
        ? recording.durationMs / 1000 / 60
        : recording.durationSeconds != null
        ? recording.durationSeconds / 60
        : transcriptionWordCount / 150;
    const numQuestions =
      durationMinutes < 5 ? 3 : durationMinutes < 15 ? 5 : durationMinutes < 30 ? 8 : 12;
    const numMcq = Math.round(numQuestions * 0.6);
    const numOpen = numQuestions - numMcq;

    waitUntil(
      (async () => {
        const quizController = new AbortController();
        const quizTimeout = setTimeout(() => quizController.abort(), 20000);
        try {
          const quizSystemPrompt = `Tu es un expert en création de quiz pédagogiques.

Génère exactement ${numQuestions} questions de quiz à partir de la transcription fournie.

Format JSON strict :
{
  "quiz": [
    {
      "type": "mcq",
      "question": "Question ici ?",
      "options": ["A. Option A", "B. Option B", "C. Option C", "D. Option D"],
      "answer": "A"
    },
    {
      "type": "open",
      "question": "Question ouverte ici ?",
      "answer": "Réponse modèle : ..."
    }
  ]
}

Règles :
- Exactement ${numQuestions} questions : ${numMcq} QCM et ${numOpen} questions ouvertes
- QCM : 4 options (A, B, C, D), une seule bonne réponse, distracteurs plausibles
- La bonne réponse répartie aléatoirement entre A, B, C, D (pas toujours A)
- Questions ouvertes : courtes et directes, réponse commençant par "Réponse modèle : "
- Toutes les questions en français
- Tirées des points les plus importants de la transcription

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

          const quizCompletion = await openai.chat.completions.create({
            model: AI_SUMMARY_MODEL,
            messages: [
              { role: "system", content: quizSystemPrompt },
              { role: "user", content: `Transcription (${transcriptionWordCount} mots) :\n\n${truncated}` },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 2500,
          }, { signal: quizController.signal });

          let rawQuiz = (quizCompletion.choices[0]?.message?.content ?? "").trim();
          const jsonMatch = rawQuiz.match(/\{[\s\S]*\}/);
          if (jsonMatch) rawQuiz = jsonMatch[0];
          const parsedQuiz = JSON.parse(rawQuiz);
          if (Array.isArray(parsedQuiz.quiz) && parsedQuiz.quiz.length > 0) {
            await prisma.eco.update({
              where: { id: recordingId },
              data: { quiz: parsedQuiz.quiz },
            });
            if (process.env.NODE_ENV === "development") {
              console.log("[quiz] saved", { recordingId, count: parsedQuiz.quiz.length });
            }
          }
        } catch (err) {
          console.error("[quiz] background generation failed", { recordingId, err });
        } finally {
          clearTimeout(quizTimeout);
        }
      })()
    );

    return NextResponse.json({
      recordingId,
      summary,
      status: "DONE",
      timings: process.env.NODE_ENV === "development" ? timings : undefined,
    });
  } catch (error) {
    const err = error as { message?: string; stack?: string };
    // Log détaillé côté serveur
    console.error("[generate-summary] Error:", {
      message: err?.message,
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
      recordingIdForError,
    });

    // En cas d'erreur, remettre aiStatus en FAILED si on a le recordingId
    try {
      if (recordingIdForError) {
        await prisma.recording.update({
          where: { id: recordingIdForError },
          data: {
            aiStatus: "FAILED",
            aiFinishedAt: new Date(),
            aiError: err?.message ?? "Erreur lors de la génération du résumé",
          },
        });
      }
    } catch (dbErr) {
      console.error("[generate-summary] Erreur update FAILED:", dbErr);
    }

    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
