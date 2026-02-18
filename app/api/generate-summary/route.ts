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

    if (!recording.transcriptionText) {
      return NextResponse.json(
        { error: "Transcription manquante" },
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

    console.log("[generate-summary] Appel OpenAI", {
      recordingId,
      model: AI_SUMMARY_MODEL,
      transcriptionLength: textLength,
      sentLength: truncated.length,
    });

    const gptStart = performance.now();
    const completion = await openai.chat.completions.create({
      model: AI_SUMMARY_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant IA. Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après, sans Markdown.",
        },
        {
          role: "user",
          content: `Génère un résumé structuré à partir de cette transcription. Réponds UNIQUEMENT avec le JSON suivant (pas d'intro, pas de markdown):

{
  "structuredSummary": {
    "title": "Titre court (max 60 caractères)",
    "sections": [
      { "heading": "Section 1", "content": "Contenu 1-2 phrases max" },
      { "heading": "Section 2", "content": "Contenu 1-2 phrases max" }
    ]
  },
  "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "notions": [
    { "term": "Terme 1", "definition": "Définition courte 1 ligne" },
    { "term": "Terme 2", "definition": "Définition courte 1 ligne" }
  ]
}

Contraintes strictes:
- structuredSummary.sections: 3 max
- keyPoints: 5-8 bullets
- notions: 5-10 items, définition 1 ligne max
- Répondre UNIQUEMENT avec le JSON

Transcription:
"""${truncated}"""`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    timings.gptSummary = performance.now() - gptStart;

    const summaryContent =
      completion.choices[0]?.message?.content ??
      '{"structuredSummary":{"title":"Résumé","sections":[]},"keyPoints":[],"notions":[]}';

    let rawSummary: StructuredSummary;
    let summary: { titre: string; resume: string; pointsCles: string[]; notions: string[] };

    try {
      rawSummary = JSON.parse(summaryContent) as StructuredSummary;
      summary = toLegacyFormat(rawSummary);
      console.log("[generate-summary] Résumé parsé", {
        hasTitre: !!summary.titre,
        pointsClesCount: summary.pointsCles?.length || 0,
        notionsCount: summary.notions?.length || 0,
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

    const dbUpdateStart = performance.now();
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: "DONE",
        aiStatus: "DONE",
        aiFinishedAt: new Date(),
        aiError: null,
        summaryJson: JSON.stringify(summary),
      },
    });
    // Sync Eco (id = recordingId)
    await prisma.eco.updateMany({
      where: { id: recordingId, userId: user.id },
      data: {
        title: summary.titre,
        content: JSON.stringify(summary),
      },
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
