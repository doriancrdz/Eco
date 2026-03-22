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

    const systemPrompt = `Tu es un expert en synthèse de contenu audio.

═══════════════════════════════════════════════════════════════
STRUCTURE JSON OBLIGATOIRE (IMMUABLE)
═══════════════════════════════════════════════════════════════

{
  "titre": "Titre du contenu",
  "introduction": "1-3 phrases de contexte (OBLIGATOIRE)",
  "contenu": {
    "type": "liste" OU "narratif",
    "sections": [
      {
        "titre": "Titre (obligatoire SI type=liste, vide SI type=narratif)",
        "texte": "Contenu de la section (2-4 phrases minimum)"
      }
    ]
  },
  "conclusion": "1-3 phrases de synthèse (OBLIGATOIRE)",
  "pointsCles": ["Point 1", "Point 2", ...],
  "notions": [
    {
      "terme": "Terme important",
      "definition": "Définition claire (1-2 phrases)"
    }
  ]
}

═══════════════════════════════════════════════════════════════
RÈGLE 1 - DÉTECTION DU TYPE DE CONTENU
═══════════════════════════════════════════════════════════════

Lis la transcription et identifie le TYPE :

TYPE "liste" → SI la transcription contient :
- Top X (ex: "Top 5 des...", "Les 3 meilleurs...", "10 stratégies...")
- Énumération explicite (ex: "premièrement", "deuxièmement", "enfin")
- Liste de conseils/étapes/méthodes

TYPE "narratif" → Pour tout le reste :
- Histoire personnelle
- Explication d'un concept
- Récit, témoignage, expérience
- Description

═══════════════════════════════════════════════════════════════
RÈGLE 2 - STRUCTURE DU CONTENU
═══════════════════════════════════════════════════════════════

TYPE "liste" :
{
  "contenu": {
    "type": "liste",
    "sections": [
      {"titre": "Marketing de contenu", "texte": "Le marketing de contenu..."},
      {"titre": "Réseaux sociaux", "texte": "Les plateformes..."},
      {"titre": "Email marketing", "texte": "L'email marketing..."}
    ]
  }
}
→ Chaque section a un TITRE descriptif + TEXTE développé

TYPE "narratif" :
{
  "contenu": {
    "type": "narratif",
    "sections": [
      {"titre": "", "texte": "Dorian se présente comme..."},
      {"titre": "", "texte": "Sa vie étudiante se déroule bien..."},
      {"titre": "", "texte": "Il développe l'application Echo..."}
    ]
  }
}
→ Chaque section a UNIQUEMENT du TEXTE (titre vide)
→ Minimum 2-3 paragraphes distincts

═══════════════════════════════════════════════════════════════
RÈGLE 3 - LONGUEUR ET EXHAUSTIVITÉ
═══════════════════════════════════════════════════════════════

- Longueur cible : ${targetSummaryWords} mots (±10%)
- TOUS les éléments de la transcription DOIVENT être présents
- Plus l'audio est long → plus le résumé est long (proportionnel)
- Ratio : exactement 15% de la longueur de la transcription
- Ordre chronologique OBLIGATOIRE : respecter l'ordre dans lequel les idées apparaissent dans l'audio
- Zéro point important oublié : le résumé doit couvrir l'intégralité de l'audio
- Si top-X ou liste : développer chaque élément dans l'ordre (2-3 lignes minimum par élément)

═══════════════════════════════════════════════════════════════
RÈGLE 4 - NOTIONS
═══════════════════════════════════════════════════════════════

Générer ${targetNotions} notion(s) maximum avec terme + définition.

Exemples de notions à extraire :
- Noms propres (EDHEC, Echo, Anna)
- Concepts techniques (ROI, marketing de contenu)
- Acronymes (IA, SaaS, API)
- Termes spécifiques au sujet

Format obligatoire :
{
  "terme": "EDHEC Business School",
  "definition": "École de commerce située à Nice où l'étudiant poursuit ses études."
}

═══════════════════════════════════════════════════════════════
RÈGLE 5 - POINTS CLÉS
═══════════════════════════════════════════════════════════════

Les points clés sont DIRECTEMENT tirés du contenu du résumé structuré, dans le MÊME ordre chronologique.

RÈGLE ABSOLUE selon le type :
- TYPE "liste" : autant de points clés que de sections dans "contenu.sections" (ex: top-5 → 5 points clés dans l'ordre)
- TYPE "narratif" : ${targetPointsCles} point(s) clé(s) dans l'ordre chronologique

Chaque point clé = une idée importante développée en 1-2 lignes complètes (pas une phrase fragmentée).
Exemple : "Le marketing de contenu génère du trafic organique durable en créant des articles de blog qui attirent naturellement les clients."

Ne pas résumer en une phrase trop courte — développer chaque idée en 1-2 lignes.

═══════════════════════════════════════════════════════════════
EXEMPLE COMPLET TYPE "liste"
═══════════════════════════════════════════════════════════════

{
  "titre": "Les 5 stratégies marketing essentielles",
  "introduction": "Cette présentation expose les cinq stratégies marketing fondamentales pour développer son entreprise et maximiser sa visibilité digitale en 2026.",
  "contenu": {
    "type": "liste",
    "sections": [
      {
        "titre": "Marketing de contenu",
        "texte": "Le marketing de contenu consiste à créer des articles de blog de qualité pour attirer des clients. Cette approche génère du trafic organique durable."
      },
      {
        "titre": "Réseaux sociaux",
        "texte": "Les plateformes comme Instagram et TikTok permettent de toucher une audience jeune. La régularité et l'authenticité sont essentielles."
      }
    ]
  },
  "conclusion": "Ces cinq stratégies forment un écosystème complet pour développer sa présence digitale et accélérer sa croissance.",
  "pointsCles": [
    "Le marketing de contenu génère du trafic organique",
    "Les réseaux sociaux créent une communauté engagée"
  ],
  "notions": [
    {
      "terme": "ROI",
      "definition": "Retour sur investissement, indicateur mesurant la rentabilité d'une action marketing."
    }
  ]
}

═══════════════════════════════════════════════════════════════
EXEMPLE COMPLET TYPE "narratif"
═══════════════════════════════════════════════════════════════

{
  "titre": "Présentation de Dorian Crédose",
  "introduction": "Dorian Crédose, étudiant à l'EDHEC Business School à Nice, partage son expérience académique et ses projets entrepreneuriaux.",
  "contenu": {
    "type": "narratif",
    "sections": [
      {
        "titre": "",
        "texte": "Dorian se présente comme un étudiant de 18 ans dont l'anniversaire approche le 9 mars. Il étudie à l'EDHEC Business School à Nice où tout se passe bien."
      },
      {
        "titre": "",
        "texte": "Il a emménagé avec sa copine Anna et pratique le football dans le club de l'école. Ses examens se sont bien déroulés."
      },
      {
        "titre": "",
        "texte": "Dorian développe plusieurs projets d'entreprise, dont l'application Echo qui permet de générer des résumés d'enregistrements audio avec transcription et points clés."
      }
    ]
  },
  "conclusion": "Dorian Crédose combine études, sport et entrepreneuriat, illustrant un parcours dynamique à l'EDHEC.",
  "pointsCles": [
    "Étudiant de 18 ans à l'EDHEC Business School",
    "Développe l'application Echo pour résumés audio"
  ],
  "notions": [
    {
      "terme": "EDHEC Business School",
      "definition": "École de commerce située à Nice où Dorian poursuit ses études supérieures."
    },
    {
      "terme": "Echo",
      "definition": "Application développée par Dorian permettant de créer des résumés d'enregistrements audio avec transcription automatique."
    }
  ]
}

═══════════════════════════════════════════════════════════════
CHECKLIST FINALE
═══════════════════════════════════════════════════════════════

Avant de renvoyer le JSON, vérifie :
✓ "introduction" est remplie (1-3 phrases)
✓ "contenu.type" est soit "liste" soit "narratif"
✓ "contenu.sections" contient minimum 2 sections
✓ SI type="liste" → chaque section a un titre
✓ SI type="narratif" → titre vide, juste texte
✓ "conclusion" est remplie (1-3 phrases)
✓ ${targetPointsCles} points clés générés
✓ ${targetNotions} notions avec terme ET définition
✓ Longueur totale ≈ ${targetSummaryWords} mots (±10%) — soit 15% de la transcription
✓ TOUS les éléments de la transcription présents

═══════════════════════════════════════════════════════════════

Transcription à résumer : voir le message utilisateur ci-dessous.

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    const userPrompt = `Transcription complète (${transcriptionWordCount} mots) :

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

    // Transforme le JSON structuré (introduction/contenu/conclusion) en markdown avec structure obligatoire
    function structuredJsonToMarkdown(data: {
      introduction?: string;
      contenu?: { type?: string; sections?: Array<{ titre?: string; texte?: string }> };
      conclusion?: string;
    }): string {
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

    try {
      // Nettoyer le contenu (l'IA peut renvoyer du markdown autour du JSON)
      let rawContent = summaryContent.trim();
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) rawContent = jsonMatch[0];

      const parsed = JSON.parse(rawContent) as {
        titre?: string;
        introduction?: string;
        contenu?: { type?: string; sections?: Array<{ titre?: string; texte?: string }> };
        conclusion?: string;
        pointsCles?: string[];
        notions?: Array<{ terme?: string; definition?: string; term?: string }>;
        resume?: string;
        structuredSummary?: StructuredSummary["structuredSummary"];
        keyPoints?: string[];
      };

      // Format nouveau : introduction + contenu + conclusion (structure JSON forcée)
      if (
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

    // Validation structure — log Vercel si une section manque
    {
      const hasIntro = summary.resume.includes("Introduction:");
      const hasContenu = summary.resume.includes("Contenu:");
      const hasConclusion = summary.resume.includes("Conclusion:");
      if (!hasIntro || !hasContenu || !hasConclusion) {
        console.error("[ECO] STRUCTURE MANQUANTE dans le résumé", {
          recordingId,
          hasIntro,
          hasContenu,
          hasConclusion,
          resumeSnippet: summary.resume.substring(0, 300),
        });
      }
    }

    const summaryJson = JSON.stringify(summary);
    if (process.env.NODE_ENV === "development") {
      console.log("[summary] generated", { hasJson: !!summaryJson, size: summaryJson?.length ?? 0, ts: Date.now() });
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
        title: summary.titre,
        content: contentStr,
        transcriptionText: recording.transcriptionText,
      },
      update: {
        title: summary.titre,
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
