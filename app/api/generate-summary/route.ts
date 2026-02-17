export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * PHASE B: Génération du résumé (asynchrone, non bloquante)
 * Prend un recordingId et génère le résumé structuré
 */
export async function POST(req: NextRequest) {
  const perfStart = performance.now();
  const timings: Record<string, number> = {};

  try {
    // 1. Authentification
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

    // 2. Récupérer recordingId depuis le body
    const body = await req.json();
    const { recordingId } = body;

    if (!recordingId || typeof recordingId !== "string") {
      return NextResponse.json(
        { error: "recordingId requis" },
        { status: 400 }
      );
    }

    // 3. Récupérer le Recording et vérifier qu'il appartient à l'utilisateur
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
        status: "TRANSCRIBED", // Doit être TRANSCRIBED pour générer le résumé
      },
    });
    timings.dbRead = performance.now() - dbReadStart;

    if (!recording) {
      return NextResponse.json(
        { error: "Recording introuvable ou déjà traité" },
        { status: 404 }
      );
    }

    if (!recording.transcriptionText) {
      return NextResponse.json(
        { error: "Transcription manquante" },
        { status: 400 }
      );
    }

    // 4. Générer le résumé avec GPT-4o-mini
    console.log("[generate-summary] Appel à GPT-4o-mini pour résumé...", {
      recordingId,
      transcriptionLength: recording.transcriptionText.length,
    });

    const summaryStart = performance.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant IA qui structure la connaissance. Réponds UNIQUEMENT avec du JSON valide, sans texte avant ou après.",
        },
        {
          role: "user",
          content: `Tu es un assistant IA qui structure la connaissance.
À partir de cette transcription d'enregistrement audio, génère un résumé structuré au format JSON strict suivant :

{
  "titre": "Titre court et percutant (max 60 caractères)",
  "resume": "Résumé global en 2-3 phrases maximum",
  "pointsCles": [
    "Point clé 1 (phrase complète)",
    "Point clé 2 (phrase complète)",
    "Point clé 3 (phrase complète)"
  ],
  "notions": ["Notion 1", "Notion 2", "Notion 3"]
}

IMPORTANT :
- Réponds UNIQUEMENT avec le JSON, sans texte avant ou après
- Les points clés doivent être des phrases complètes et actionnables
- Les notions sont des mots-clés ou concepts principaux (3 à 5 maximum)
- Le titre doit être engageant et informatif

Transcription :
"""${recording.transcriptionText}"""`,
        },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const summaryContent =
      completion.choices[0]?.message?.content ??
      '{"titre": "Résumé indisponible", "resume": "Une erreur est survenue lors de la génération.", "pointsCles": [], "notions": []}';

    timings.gptSummary = performance.now() - summaryStart;

    let summary;
    try {
      summary = JSON.parse(summaryContent);
      console.log("[generate-summary] Résumé parsé avec succès", {
        hasTitre: !!summary.titre,
        hasResume: !!summary.resume,
        pointsClesCount: summary.pointsCles?.length || 0,
        notionsCount: summary.notions?.length || 0,
        durationMs: timings.gptSummary.toFixed(2),
      });
    } catch (parseError) {
      console.error("[generate-summary] Erreur parsing JSON summary:", parseError);
      summary = {
        titre: "Résumé",
        resume: recording.transcriptionText.substring(0, 200) + "...",
        pointsCles: [],
        notions: [],
      };
    }

    // 5. Mettre à jour le Recording avec le résumé (status = DONE)
    const dbUpdateStart = performance.now();
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: "DONE",
        summaryJson: JSON.stringify(summary),
      },
    });
    timings.dbUpdate = performance.now() - dbUpdateStart;

    timings.total = performance.now() - perfStart;
    console.log("[generate-summary] ⏱️ TIMINGS PHASE B:", {
      auth: `${timings.auth?.toFixed(2)}ms`,
      dbRead: `${timings.dbRead?.toFixed(2)}ms`,
      gptSummary: `${timings.gptSummary?.toFixed(2)}ms`,
      dbUpdate: `${timings.dbUpdate?.toFixed(2)}ms`,
      total: `${timings.total.toFixed(2)}ms`,
    });
    console.log("[generate-summary] ✅ PHASE B terminée");

    return NextResponse.json(
      {
        recordingId,
        summary,
        status: "DONE",
        timings: process.env.NODE_ENV === "development" ? timings : undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[generate-summary] Erreur:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue lors de la génération du résumé.",
      },
      { status: 500 }
    );
  }
}
