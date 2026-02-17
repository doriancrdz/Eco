export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { getOrCreateUserWithQuota, getAvailableMinutes, canUseMinutes, debitMinutes } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * PHASE A: Transcription rapide uniquement
 * Retourne immédiatement après la transcription, sans attendre le résumé
 */
export async function POST(req: NextRequest) {
  const perfStart = performance.now();
  const timings: Record<string, number> = {};
  
  try {
    // 1. Authentification Clerk obligatoire
    const authStart = performance.now();
    const { userId } = await auth();
    timings.auth = performance.now() - authStart;
    
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
    const formDataStart = performance.now();
    const formData = await req.formData();
    const audioFile = formData.get("audio");
    const durationSecondsStr = formData.get("durationSeconds");
    timings.formDataParse = performance.now() - formDataStart;

    console.log("[transcribe] FormData reçu", {
      hasAudioFile: !!audioFile,
      audioFileType: audioFile && typeof audioFile === "object" && "type" in audioFile ? (audioFile as File).type : typeof audioFile,
      audioFileSize: audioFile && typeof audioFile === "object" && "size" in audioFile ? (audioFile as File).size : null,
      durationSecondsStr,
    });

    if (!audioFile || !(audioFile instanceof File)) {
      console.error("[transcribe] Fichier audio invalide");
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
    const quotaStart = performance.now();
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

    // Si quota insuffisant → retourner 403
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

    // 5. Débiter les minutes AVANT l'appel OpenAI
    const debitStart = performance.now();
    const debitSuccess = await debitMinutes(user.id, minutesNeeded);
    if (!debitSuccess) {
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
    timings.quotaCheck = performance.now() - quotaStart;
    timings.debitMinutes = performance.now() - debitStart;

    // Stocker les valeurs pour rollback si nécessaire
    const beforeDebitMinutesUsed = user.minutesUsedMonth;
    const beforeDebitExtraMinutes = user.extraMinutesMonth;

    // 6. Créer un Recording en base avec status PROCESSING
    const dbCreateStart = performance.now();
    const recording = await prisma.recording.create({
      data: {
        userId: user.id,
        status: "PROCESSING",
        audioBlobSize: audioFile.size,
        durationSeconds,
        mimeType: audioFile.type,
      },
    });
    timings.dbCreate = performance.now() - dbCreateStart;

    try {
      const whisperStart = performance.now();
      const transcriptionResponse = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "fr",
      });
      const transcription = transcriptionResponse.text;
      timings.whisperTranscription = performance.now() - whisperStart;

      const dbUpdateStart = performance.now();
      await prisma.recording.update({
        where: { id: recording.id },
        data: {
          status: "TRANSCRIBED",
          transcriptionText: transcription,
          audioBlobSize: audioFile.size,
        },
      });
      timings.dbUpdate = performance.now() - dbUpdateStart;
      timings.total = performance.now() - perfStart;

      console.log("[transcribe] request end", {
        authMs: timings.auth?.toFixed(0),
        whisperMs: timings.whisperTranscription?.toFixed(0),
        totalMs: timings.total?.toFixed(0),
        ts: Date.now(),
      });

      return NextResponse.json(
        {
          recordingId: recording.id,
          transcription,
          status: "TRANSCRIBED",
          timings: process.env.NODE_ENV === "development" ? timings : undefined,
        },
        { status: 200 }
      );
    } catch (openaiError) {
      console.error("[transcribe] Erreur OpenAI:", openaiError);
      await prisma.recording.update({
        where: { id: recording.id },
        data: {
          status: "ERROR",
          errorMessage: openaiError instanceof Error ? openaiError.message : String(openaiError),
        },
      }).catch(() => {});
      await prisma.user.update({
        where: { id: user.id },
        data: {
          minutesUsedMonth: beforeDebitMinutesUsed,
          extraMinutesMonth: beforeDebitExtraMinutes,
        },
      }).catch(() => {});
      return NextResponse.json(
        { error: "Impossible de générer la transcription. Les minutes n'ont pas été débitées." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[transcribe] Erreur générale:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue lors du traitement de l'enregistrement.",
      },
      { status: 500 }
    );
  }
}
