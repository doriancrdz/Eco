export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

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
    const authStart = performance.now();
    const { userId } = await auth();
    timings.auth = performance.now() - authStart;

    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Clé API OpenAI manquante côté serveur." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { recordingId } = body;
    recordingIdForError = typeof recordingId === "string" ? recordingId : undefined;

    if (!recordingId || typeof recordingId !== "string") {
      return NextResponse.json(
        { error: "recordingId requis" },
        { status: 400 }
      );
    }

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
    console.log("[summary] start", { traceId, recordingId, userId: user.id, ts: Date.now() });

    // DONE (ou ancien format) → retour direct, pas de regen
    if (recording.aiStatus === "DONE" || (recording.status === "DONE" && recording.summaryJson)) {
      timings.total = performance.now() - perfStart;
      console.log("[generate-summary] ⏱️ RETOUR CACHE (DONE)", {
        recordingId,
        totalMs: timings.total.toFixed(2),
      });
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
      console.log("[generate-summary] 202 ALREADY GENERATING", { recordingId });
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
      console.log("[summary] TRANSCRIPTION_MISSING", { traceId, recordingId });
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
    // Limiter le contexte si transcription très longue (optionnel)
    const maxChars = 12000;
    const truncated = textLength > maxChars ? textToSend.slice(0, maxChars) + "\n[...]" : textToSend;

    // Nombre de mots de la transcription — RÈGLES DÉFINITIVES STRICTES
    const transcriptionWordCount = textToSend.trim().split(/\s+/).filter(Boolean).length;
    // RÈGLE 1 : RÉSUMÉ = EXACTEMENT 16% DE LA TRANSCRIPTION
    const targetSummaryWords = Math.round(transcriptionWordCount * 0.16);
    const minSummaryWords = targetSummaryWords - 10;
    const maxSummaryWords = targetSummaryWords + 10;
    // RÈGLE 2 : POINTS CLÉS = 1 TOUS LES 800 MOTS
    const targetPointsCles = Math.round(transcriptionWordCount / 800);
    // RÈGLE 3 : NOTIONS = 1 TOUS LES 550 MOTS
    const targetNotions = Math.round(transcriptionWordCount / 550);

    const estimatedTokens = targetSummaryWords * 1.5 + targetPointsCles * 35 * 1.5 + targetNotions * 60 * 1.5;
    const maxTokens = Math.max(3000, Math.ceil(estimatedTokens + 1000));
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

    const systemPrompt = `Tu es un assistant IA expert en structuration de connaissances.

═══════════════════════════════════════════════════════════════
📊 RÈGLES ABSOLUES ET DÉFINITIVES
═══════════════════════════════════════════════════════════════
TRANSCRIPTION : ${transcriptionWordCount} mots

RÉSUMÉ CIBLE EXACTE : ${targetSummaryWords} mots (16% de la transcription)
RÉSUMÉ MINIMUM : ${minSummaryWords} mots
RÉSUMÉ MAXIMUM : ${maxSummaryWords} mots

POINTS CLÉS EXACTS : ${targetPointsCles} points (1 point tous les 800 mots)
NOTIONS EXACTES : ${targetNotions} notions (1 notion tous les 550 mots)

⚠️⚠️⚠️ CES RÈGLES SONT ABSOLUES - AUCUNE EXCEPTION ⚠️⚠️⚠️

SI TON RÉSUMÉ NE FAIT PAS ${targetSummaryWords} MOTS (±10) → TU AS ÉCHOUÉ
SI TU N'AS PAS EXACTEMENT ${targetPointsCles} POINTS CLÉS → TU AS ÉCHOUÉ
SI TU N'AS PAS EXACTEMENT ${targetNotions} NOTIONS → TU AS ÉCHOUÉ

═══════════════════════════════════════════════════════════════
📝 STRUCTURE DU RÉSUMÉ (AVEC SAUTS DE LIGNE)
═══════════════════════════════════════════════════════════════

⚠️ IMPÉRATIF : Ton résumé doit faire EXACTEMENT ${targetSummaryWords} mots.

PARTIE 1 - INTRODUCTION (~${Math.floor(targetSummaryWords * 0.18)} mots)
Commence par des connecteurs : "Dans cet enregistrement,", "Cette présentation aborde...", etc.
- Phrase 1 : Présente le sujet et le contexte
- Phrase 2 : Annonce les thématiques principales
- Phrase 3 : Explique l'objectif

PUIS : **SAUT DE LIGNE (\\n\\n)**

PARTIE 2 - DÉVELOPPEMENT (~${Math.floor(targetSummaryWords * 0.7)} mots)
Divise en 4-8 paragraphes avec connecteurs :
- "Premièrement," / "Tout d'abord,"
- **\\n\\n**
- "Ensuite," / "Par ailleurs,"
- **\\n\\n**
- "De plus," / "En outre,"
- **\\n\\n**
- "Quatrièmement," / "Également,"
- **\\n\\n**
- "Enfin," / "Pour finir,"

Chaque paragraphe développe UNE thématique avec détails, arguments, exemples.

PUIS : **SAUT DE LIGNE (\\n\\n)**

PARTIE 3 - CONCLUSION (~${Math.floor(targetSummaryWords * 0.12)} mots)
Commence par : "En résumé,", "En conclusion,", "Pour conclure,"
- Synthétise les points principaux
- Rappelle le message clé
- Propose éventuellement une ouverture

═══════════════════════════════════════════════════════════════
✅ COMMENT ATTEINDRE EXACTEMENT ${targetSummaryWords} MOTS
═══════════════════════════════════════════════════════════════

ÉTAPE 1 : Écris ton résumé normalement
ÉTAPE 2 : Compte tes mots pendant que tu écris
ÉTAPE 3 : Si tu as moins de ${targetSummaryWords} mots → DÉVELOPPE davantage
ÉTAPE 4 : Si tu as plus de ${targetSummaryWords} mots → SYNTHÉTISE
ÉTAPE 5 : Vise EXACTEMENT ${targetSummaryWords} mots (±5 mots maximum)

═══════════════════════════════════════════════════════════════
📊 POINTS CLÉS ET NOTIONS - RÈGLES STRICTES
═══════════════════════════════════════════════════════════════

POINTS CLÉS : EXACTEMENT ${targetPointsCles} points
- Format : Phrases complètes et détaillées (20-35 mots par point)
- Couvrir les ${targetPointsCles} informations/arguments/conseils les PLUS IMPORTANTS
- Exemple : "L'inflation érode le pouvoir d'achat : un capital de 50 000€ non investi perd environ 2-3% de sa valeur chaque année, soit 1000-1500€"

NOTIONS : EXACTEMENT ${targetNotions} notions
- Format : Terme + définition complète et détaillée (30-60 mots)
- Identifier les ${targetNotions} termes techniques/concepts les PLUS IMPORTANTS
- Exemple : {"terme": "ETF (Exchange Traded Fund)", "definition": "Panier d'actions diversifié qui permet d'investir dans des centaines d'entreprises en un seul achat. Les ETF répliquent la performance d'un indice boursier (comme le S&P 500) et offrent une diversification optimale à faible coût."}

═══════════════════════════════════════════════════════════════
⚠️ VÉRIFICATION FINALE OBLIGATOIRE
═══════════════════════════════════════════════════════════════

AVANT DE GÉNÉRER LE JSON, VÉRIFIE :
☐ Mon résumé fait EXACTEMENT ${targetSummaryWords} mots (±5)
☐ Mon résumé a des SAUTS DE LIGNE entre intro/dév/conclu et entre paragraphes
☐ J'ai EXACTEMENT ${targetPointsCles} points clés
☐ J'ai EXACTEMENT ${targetNotions} notions
☐ Mes points clés sont des phrases complètes de 20-35 mots
☐ Mes notions ont des définitions de 30-60 mots

SI UNE SEULE CASE N'EST PAS COCHÉE → RECOMMENCE ENTIÈREMENT

═══════════════════════════════════════════════════════════════
📋 FORMAT JSON À RETOURNER
═══════════════════════════════════════════════════════════════

{
  "titre": "Titre court (max 60 caractères)",
  "resume": "INTRODUCTION\\n\\nPARAGRAPHE 1\\n\\nPARAGRAPHE 2\\n\\n...\\n\\nCONCLUSION",
  "pointsCles": [
    "Point 1 en phrase complète de 20-35 mots",
    "Point 2 en phrase complète de 20-35 mots",
    ...exactement ${targetPointsCles} points
  ],
  "notions": [
    {"terme": "Terme 1", "definition": "Définition complète de 30-60 mots"},
    {"terme": "Terme 2", "definition": "Définition complète de 30-60 mots"},
    ...exactement ${targetNotions} notions
  ]
}

RAPPEL ULTIME :
- RÉSUMÉ : ${targetSummaryWords} MOTS EXACTEMENT
- POINTS CLÉS : ${targetPointsCles} EXACTEMENT
- NOTIONS : ${targetNotions} EXACTEMENT`;

    const userPrompt = `Transcription complète (${transcriptionWordCount} mots) :

${truncated}`;

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

    const summaryContent =
      completion.choices[0]?.message?.content ??
      '{"titre":"Résumé","resume":"","pointsCles":[],"notions":[]}';

    let summary: { titre: string; resume: string; pointsCles: string[]; notions: Array<{ terme: string; definition: string }> | string[] };

    try {
      const parsed = JSON.parse(summaryContent) as {
        titre?: string;
        resume?: string;
        pointsCles?: string[];
        notions?: Array<{ terme: string; definition: string }> | string[];
        // Support du format ancien pour rétrocompatibilité
        structuredSummary?: StructuredSummary['structuredSummary'];
        keyPoints?: string[];
      };

      // Normaliser les notions : convertir en format { terme, definition }
      const normalizeNotions = (notions: unknown): Array<{ terme: string; definition: string }> => {
        if (!Array.isArray(notions)) return [];
        return notions.map((n) => {
          if (typeof n === "string") {
            // Format ancien : string simple → convertir en objet avec définition vide
            return { terme: n, definition: "" };
          }
          if (typeof n === "object" && n !== null && "terme" in n) {
            // Format nouveau : { terme, definition }
            return {
              terme: typeof n.terme === "string" ? n.terme : "",
              definition: typeof n.definition === "string" ? n.definition : "",
            };
          }
          if (typeof n === "object" && n !== null && "term" in n) {
            // Format alternatif : { term, definition }
            return {
              terme: typeof (n as { term?: string }).term === "string" ? (n as { term: string }).term : "",
              definition: typeof (n as { definition?: string }).definition === "string" ? (n as { definition: string }).definition : "",
            };
          }
          return { terme: String(n), definition: "" };
        });
      };

      // Si format nouveau (titre/resume/pointsCles/notions), utiliser directement
      if (parsed.titre && parsed.resume !== undefined) {
        summary = {
          titre: parsed.titre || "Résumé",
          resume: parsed.resume || "",
          pointsCles: Array.isArray(parsed.pointsCles) ? parsed.pointsCles : [],
          notions: normalizeNotions(parsed.notions),
        };
      } else if (parsed.structuredSummary) {
        // Format ancien (structuredSummary) → convertir
        const rawSummary: StructuredSummary = {
          structuredSummary: parsed.structuredSummary,
          keyPoints: parsed.keyPoints || [],
          notions: parsed.notions?.map((n: unknown) =>
            typeof n === "string" ? { term: n, definition: "" } : (n as { term: string; definition: string })
          ) || [],
        };
        const legacySummary = toLegacyFormat(rawSummary);
        summary = {
          titre: legacySummary.titre,
          resume: legacySummary.resume,
          pointsCles: legacySummary.pointsCles,
          notions: normalizeNotions(legacySummary.notions),
        };
      } else {
        // Fallback
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
    } catch (parseError) {
      console.error("[generate-summary] Erreur parsing JSON:", parseError);
      summary = {
        titre: "Résumé",
        resume: textToSend.substring(0, 200) + "...",
        pointsCles: [],
        notions: [],
      };
    }

    const summaryJson = JSON.stringify(summary);
    console.log("[summary] generated", { hasJson: !!summaryJson, size: summaryJson?.length ?? 0, ts: Date.now() });

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
    console.log("[summary] recording updated", { recordingId, ts: Date.now() });

    // Sync Eco (id = recordingId) : upsert pour être robuste si l'Eco n'existe pas encore
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
    console.log("[summary] end", {
      traceId,
      recordingId,
      contentLen,
      ts: Date.now(),
    });
    timings.dbUpdate = performance.now() - dbUpdateStart;

    timings.total = performance.now() - perfStart;
    console.log("[generate-summary] ⏱️ TIMINGS:", {
      auth: `${timings.auth?.toFixed(2)}ms`,
      dbRead: `${timings.dbRead?.toFixed(2)}ms`,
      dbLock: `${timings.dbLock?.toFixed(2)}ms`,
      gptSummary: `${timings.gptSummary?.toFixed(2)}ms`,
      dbUpdate: `${timings.dbUpdate?.toFixed(2)}ms`,
      total: `${timings.total.toFixed(2)}ms`,
      model: AI_SUMMARY_MODEL,
    });

    return NextResponse.json({
      recordingId,
      summary,
      status: "DONE",
      timings: process.env.NODE_ENV === "development" ? timings : undefined,
    });
  } catch (error) {
    console.error("[generate-summary] Erreur:", error);

    // En cas d'erreur, remettre aiStatus en FAILED si on a le recordingId
    try {
      if (recordingIdForError) {
        await prisma.recording.update({
          where: { id: recordingIdForError },
          data: {
            aiStatus: "FAILED",
            aiFinishedAt: new Date(),
            aiError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    } catch (dbErr) {
      console.error("[generate-summary] Erreur update FAILED:", dbErr);
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue lors de la génération du résumé.",
      },
      { status: 500 }
    );
  }
}
