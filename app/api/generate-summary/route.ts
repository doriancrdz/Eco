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

    // Déterminer le niveau de détail selon la durée
    let detailLevel: 'minimal' | 'moyen' | 'détaillé';
    let maxPointsCles: number;
    let maxNotions: number;
    let maxTokens: number;

    if (!durationMinutesRounded || durationMinutesRounded < 2) {
      detailLevel = 'minimal';
      maxPointsCles = 3;
      maxNotions = 2;
      maxTokens = 300;
    } else if (durationMinutesRounded < 10) {
      detailLevel = 'moyen';
      maxPointsCles = 5;
      maxNotions = 4;
      maxTokens = 800;
    } else {
      detailLevel = 'détaillé';
      maxPointsCles = Math.min(15, Math.floor(durationMinutesRounded / 2)); // ~1 point toutes les 2 min
      maxNotions = Math.min(10, Math.floor(durationMinutesRounded / 3)); // ~1 notion toutes les 3 min
      maxTokens = 1500;
    }

    console.log("[generate-summary] Appel OpenAI", {
      recordingId,
      model: AI_SUMMARY_MODEL,
      transcriptionLength: textLength,
      sentLength: truncated.length,
      durationMinutes: durationMinutesRounded,
      detailLevel,
      maxPointsCles,
      maxNotions,
      maxTokens,
    });

    // Construire le prompt système adapté selon la durée
    const systemPrompt = `Tu es un assistant IA expert en structuration de connaissances.
Niveau de détail requis : ${detailLevel}
Durée audio : ${durationMinutesRounded ? durationMinutesRounded.toFixed(1) : 'inconnue'} minutes

RÈGLES STRICTES :
${detailLevel === 'minimal' ? `
- Résumé : 2-3 phrases maximum, très concis
- Points clés : ${maxPointsCles} maximum, phrases courtes
- Notions : ${maxNotions} maximum, mots-clés simples
` : detailLevel === 'moyen' ? `
- Résumé : 1 paragraphe de 4-6 phrases structuré
- Points clés : ${maxPointsCles} phrases complètes et actionnables
- Notions : ${maxNotions} concepts principaux
` : `
- Résumé : Structure complète en 3 parties
  * Introduction (1-2 phrases) : contexte et sujet principal
  * Développement (4-8 phrases) : idées principales détaillées avec transitions
  * Conclusion (1-2 phrases) : synthèse et message clé
- Points clés : ${maxPointsCles} points détaillés couvrant TOUS les aspects importants
- Notions : ${maxNotions} concepts principaux et termes techniques
`}

IMPORTANT :
- N'oublie AUCUN point important de la transcription
- Adapte la longueur du résumé à la richesse du contenu
- Si le contenu est dense, priorise la complétude sur la brièveté
- Si le contenu est simple, reste concis

Réponds UNIQUEMENT avec un JSON strict :
{
  "titre": "Titre court (max 60 caractères)",
  "resume": "Résumé selon le niveau de détail ci-dessus",
  "pointsCles": ["Point 1", "Point 2", ...],
  "notions": ["Notion 1", "Notion 2", ...]
}`;

    const userPrompt = `Transcription de l'enregistrement audio${durationMinutesRounded ? ` (${durationMinutesRounded.toFixed(1)} minutes)` : ''} :

${truncated}`;

    const gptStart = performance.now();
    const completion = await openai.chat.completions.create({
      model: AI_SUMMARY_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.3, // Plus créatif que 0.1 mais reste précis
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
    });

    timings.gptSummary = performance.now() - gptStart;

    const summaryContent =
      completion.choices[0]?.message?.content ??
      '{"titre":"Résumé","resume":"","pointsCles":[],"notions":[]}';

    let summary: { titre: string; resume: string; pointsCles: string[]; notions: string[] };

    try {
      const parsed = JSON.parse(summaryContent) as {
        titre?: string;
        resume?: string;
        pointsCles?: string[];
        notions?: string[];
        // Support du format ancien pour rétrocompatibilité
        structuredSummary?: StructuredSummary['structuredSummary'];
        keyPoints?: string[];
      };

      // Si format nouveau (titre/resume/pointsCles/notions), utiliser directement
      if (parsed.titre && parsed.resume !== undefined) {
        summary = {
          titre: parsed.titre || "Résumé",
          resume: parsed.resume || "",
          pointsCles: Array.isArray(parsed.pointsCles) ? parsed.pointsCles : [],
          notions: Array.isArray(parsed.notions) ? parsed.notions : [],
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
        summary = toLegacyFormat(rawSummary);
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
        detailLevel,
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
