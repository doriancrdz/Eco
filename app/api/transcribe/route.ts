export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { getOrCreateUserWithQuota, getAvailableMinutes, canUseMinutes, debitMinutes } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // 1. Authentification Clerk obligatoire
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Clé API OpenAI manquante côté serveur." },
        { status: 500 }
      );
    }

    // 2. Récupérer le fichier audio depuis FormData (clé "audio")
    const formData = await req.formData();
    const audioFile = formData.get("audio");
    const durationSecondsStr = formData.get("durationSeconds");

    console.log("[transcribe] FormData reçu", {
      hasAudioFile: !!audioFile,
      audioFileType: audioFile && typeof audioFile === "object" && "type" in audioFile ? (audioFile as File).type : typeof audioFile,
      audioFileSize: audioFile && typeof audioFile === "object" && "size" in audioFile ? (audioFile as File).size : null,
      durationSecondsStr,
    });

    if (!audioFile || !(audioFile instanceof File)) {
      console.error("[transcribe] Fichier audio invalide", {
        audioFileType: typeof audioFile,
        audioFileValue: audioFile ? String(audioFile).substring(0, 100) : null,
      });
      return NextResponse.json(
        { error: "Aucun fichier audio valide fourni." },
        { status: 400 }
      );
    }

    if (audioFile.size === 0) {
      console.error("[transcribe] Fichier audio vide");
      return NextResponse.json(
        { error: "Le fichier audio est vide." },
        { status: 400 }
      );
    }

    // 3. Calculer la durée de l'audio en minutes
    if (!durationSecondsStr || typeof durationSecondsStr !== "string") {
      return NextResponse.json(
        { error: "Durée de l'enregistrement manquante ou invalide." },
        { status: 400 }
      );
    }

    const durationSeconds = parseFloat(durationSecondsStr);
    if (isNaN(durationSeconds) || durationSeconds < 0) {
      return NextResponse.json(
        { error: "Durée de l'enregistrement invalide." },
        { status: 400 }
      );
    }

    const minutesNeeded = Math.ceil(durationSeconds / 60);

    // Vérifier la limite de 30 minutes par enregistrement
    if (minutesNeeded > 30) {
      return NextResponse.json(
        {
          error: `Enregistrement trop long (${minutesNeeded} min). La limite est de 30 minutes par enregistrement.`,
        },
        { status: 400 }
      );
    }

    // 4. Vérifier le quota utilisateur
    const user = await getOrCreateUserWithQuota(userId);
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeSubscriptionId: true, subscriptionStatus: true },
    });

    // Gating : accès suspendu si paiement échoué (subscription non active)
    if (fullUser && !canUseMinutes(fullUser)) {
      return NextResponse.json(
        { error: "Paiement échoué — accès suspendu" },
        { status: 402 }
      );
    }

    const availableMinutes = getAvailableMinutes(
      user.plan,
      user.minutesUsedMonth,
      user.extraMinutesMonth
    );

    // 6. Si quota insuffisant → retourner 403
    if (minutesNeeded > availableMinutes) {
      return NextResponse.json(
        {
          error: "Quota insuffisant",
          available: availableMinutes,
          needed: minutesNeeded,
        },
        { status: 403 }
      );
    }

    // 9. Débiter les minutes AVANT l'appel OpenAI
    const debitSuccess = await debitMinutes(user.id, minutesNeeded);
    if (!debitSuccess) {
      // Re-vérifier au cas où le quota aurait changé entre-temps
      const updatedUser = await getOrCreateUserWithQuota(userId);
      const updatedAvailable = getAvailableMinutes(
        updatedUser.plan,
        updatedUser.minutesUsedMonth,
        updatedUser.extraMinutesMonth
      );
      return NextResponse.json(
        {
          error: "Quota insuffisant",
          available: updatedAvailable,
          needed: minutesNeeded,
        },
        { status: 403 }
      );
    }

    // Stocker les valeurs pour rollback si nécessaire
    const beforeDebitMinutesUsed = user.minutesUsedMonth;
    const beforeDebitExtraMinutes = user.extraMinutesMonth;

    try {
      console.log("[transcribe] Appel à OpenAI Whisper...", {
        fileSize: audioFile.size,
        fileType: audioFile.type,
        fileName: audioFile.name,
      });

      // 7. Appeler OpenAI Whisper pour transcription
      const transcriptionResponse = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "fr",
      });

      const transcription = transcriptionResponse.text;
      console.log("[transcribe] Transcription réussie", {
        transcriptionLength: transcription.length,
      });

      // 8. Appeler gpt-4o-mini pour générer résumé structuré (format JSON strict)
      console.log("[transcribe] Appel à GPT-4o-mini pour résumé...");
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
"""${transcription}"""`,
          },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      });

      const summaryContent =
        completion.choices[0]?.message?.content ??
        '{"titre": "Résumé indisponible", "resume": "Une erreur est survenue lors de la génération.", "pointsCles": [], "notions": []}';

      let summary;
      try {
        summary = JSON.parse(summaryContent);
        console.log("[transcribe] Résumé parsé avec succès", {
          hasTitre: !!summary.titre,
          hasResume: !!summary.resume,
          pointsClesCount: summary.pointsCles?.length || 0,
          notionsCount: summary.notions?.length || 0,
        });
      } catch (parseError) {
        console.error("[transcribe] Erreur parsing JSON summary:", parseError);
        console.error("[transcribe] Contenu reçu:", summaryContent.substring(0, 500));
        // Fallback si le JSON est invalide
        summary = {
          titre: "Résumé",
          resume: transcription.substring(0, 200) + "...",
          pointsCles: [],
          notions: [],
        };
      }

      // 10. Retourner JSON avec transcription + résumé
      console.log("[transcribe] Succès complet, retour de la réponse");
      return NextResponse.json(
        {
          transcription,
          summary,
        },
        { status: 200 }
      );
    } catch (openaiError) {
      console.error("[transcribe] Erreur API OpenAI:", openaiError);
      console.error("[transcribe] Détails de l'erreur OpenAI:", {
        message: openaiError instanceof Error ? openaiError.message : String(openaiError),
        name: openaiError instanceof Error ? openaiError.name : typeof openaiError,
        stack: openaiError instanceof Error ? openaiError.stack : undefined,
      });

      // Rollback : remettre les valeurs d'avant le débit si OpenAI a échoué
      if (debitSuccess) {
        try {
          console.log("[transcribe] Rollback des minutes...");
          await prisma.user.update({
            where: { id: user.id },
            data: {
              minutesUsedMonth: beforeDebitMinutesUsed,
              extraMinutesMonth: beforeDebitExtraMinutes,
            },
          });
          console.log("[transcribe] Rollback réussi");
        } catch (rollbackError) {
          console.error("[transcribe] Erreur lors du rollback des minutes:", rollbackError);
        }
      }

      const errorMessage =
        openaiError instanceof Error
          ? `Erreur OpenAI: ${openaiError.message}`
          : "Erreur inconnue lors de l'appel OpenAI";

      return NextResponse.json(
        {
          error:
            "Impossible de générer la transcription ou le résumé. Les minutes n'ont pas été débitées. Veuillez réessayer ultérieurement.",
          details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Erreur générale:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Une erreur est survenue lors du traitement de l'enregistrement.",
      },
      { status: 500 }
    );
  }
}
