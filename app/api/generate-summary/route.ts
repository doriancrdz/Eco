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

    // Calculer la durée en minutes depuis durationMs ou durationSeconds
    const durationMs = recording.durationMs || (recording.durationSeconds ? recording.durationSeconds * 1000 : null);
    const durationMinutes = durationMs ? durationMs / 60000 : null;
    const durationMinutesRounded = durationMinutes ? Math.round(durationMinutes * 10) / 10 : null;

    const durationMinutes = durationMinutesRounded ?? 0;
    // max_tokens adaptatif : ~1 mot ≈ 1.3 tokens (résumé + points clés + notions)
    const maxTokens =
      durationMinutes < 3
        ? 500
        : durationMinutes < 10
          ? 1500
          : durationMinutes < 30
            ? 3000
            : 5000;

    console.log("[generate-summary] Appel OpenAI", {
      recordingId,
      model: AI_SUMMARY_MODEL,
      transcriptionLength: textLength,
      sentLength: truncated.length,
      durationMinutes: durationMinutesRounded,
      maxTokens,
    });

    const systemPrompt = `Tu es un assistant IA expert en structuration de connaissances.
Durée audio : ${durationMinutesRounded ? durationMinutesRounded.toFixed(1) : "inconnue"} minutes

RÈGLES STRICTES POUR LE RÉSUMÉ :

${
  durationMinutes < 3
    ? `
RÉSUMÉ COURT (< 3 min) :
- Un seul paragraphe concis
- Capture l'essentiel de manière directe
- LONGUEUR CIBLE : 40-80 mots
`
    : durationMinutes < 10
      ? `
RÉSUMÉ STRUCTURÉ (3-10 min) :

**INTRODUCTION** (3-4 phrases) :
- Présente le sujet principal
- Annonce les thématiques clés
- Contextualise l'enregistrement

**DÉVELOPPEMENT** (2-3 paragraphes bien développés) :
- Paragraphe 1 : Première thématique ou partie de l'audio avec détails
- Paragraphe 2 : Deuxième thématique ou partie avec exemples
- Paragraphe 3 : Troisième thématique ou conclusion des points principaux
- N'OMETS AUCUNE information importante
- Inclus les détails, arguments, et exemples clés

**CONCLUSION** (2-3 phrases) :
- Synthétise les points principaux
- Rappelle le message clé

LONGUEUR CIBLE : 150-250 mots
`
      : durationMinutes < 30
        ? `
RÉSUMÉ DÉTAILLÉ (10-30 min) :

**INTRODUCTION** (4-5 phrases) :
- Présente le contexte et le sujet global
- Énumère les principales thématiques abordées
- Explique l'objectif ou l'angle de l'enregistrement

**DÉVELOPPEMENT** (4-6 paragraphes substantiels) :
- Chaque paragraphe traite une thématique ou partie chronologique
- Développe les arguments, exemples, et détails importants
- Suit la progression logique de l'audio
- N'OMETS AUCUNE information importante
- Inclus toutes les nuances et subtilités évoquées

**CONCLUSION** (3-4 phrases) :
- Synthétise l'ensemble des points abordés
- Dégage le message ou l'enseignement principal
- Propose une ouverture ou une perspective finale

LONGUEUR CIBLE : 400-550 mots
`
        : `
RÉSUMÉ COMPLET (30-60 min) :

**INTRODUCTION** (5-6 phrases) :
- Contextualise le sujet de manière approfondie
- Présente l'architecture globale de l'enregistrement
- Annonce les parties ou thématiques principales

**DÉVELOPPEMENT** (6-10 paragraphes développés) :
- Chaque paragraphe correspond à une section ou thématique majeure
- Développe en profondeur les arguments, théories, exemples
- Suit rigoureusement la chronologie ou la logique de l'audio
- Capture TOUTES les informations importantes
- Inclus les détails techniques, les nuances, les débats éventuels
- Relie les différentes parties entre elles

**CONCLUSION** (4-5 phrases) :
- Synthétise l'ensemble du contenu
- Rappelle les points clés de chaque partie
- Dégage les enseignements principaux
- Propose une conclusion générale

LONGUEUR CIBLE : 700-900 mots
`
}

POINTS CLÉS : Minimum ${durationMinutes < 3 ? "5" : durationMinutes < 10 ? "10" : durationMinutes < 30 ? "20" : "30"} points détaillés
NOTIONS : Minimum ${durationMinutes < 3 ? "4" : durationMinutes < 10 ? "8" : durationMinutes < 30 ? "15" : "25"} termes avec définitions

IMPÉRATIF :
- Le résumé doit être PROPORTIONNEL à la durée de l'audio
- N'OMETS JAMAIS d'information importante
- Structure claire avec sauts de ligne entre intro / développement / conclusion
- Phrases complètes et bien rédigées
- RESPECTE STRICTEMENT LA LONGUEUR CIBLE EN MOTS

Format JSON strict :
{
  "titre": "Titre court (max 60 caractères)",
  "resume": "RÉSUMÉ STRUCTURÉ SELON LES RÈGLES CI-DESSUS (avec sauts de ligne entre parties)",
  "pointsCles": ["Point 1 complet", "Point 2 complet", ...],
  "notions": [
    {"terme": "Terme 1", "definition": "Définition courte"},
    {"terme": "Terme 2", "definition": "Définition courte"}
  ]
}`;

    const userPrompt = `Transcription complète (${durationMinutesRounded ? durationMinutesRounded.toFixed(1) : "inconnue"} min) :

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

      console.log("[generate-summary] Résumé parsé", {
        hasTitre: !!summary.titre,
        resumeLength: summary.resume?.length || 0,
        pointsClesCount: summary.pointsCles?.length || 0,
        notionsCount: summary.notions?.length || 0,
        durationMinutes: durationMinutesRounded,
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
