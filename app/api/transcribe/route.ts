export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { canUseMinutes } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserWithQuotaSeconds, getAvailableSeconds, debitRecordingSeconds } from "@/lib/usage";
import { MAX_RECORDING_DURATION_MINUTES } from "@/lib/billingConfig";

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

    // 3. Calculer la durée EXACTE de l'audio en secondes
    let durationSeconds: number;
    if (!durationSecondsStr || typeof durationSecondsStr !== "string") {
      // Fallback: essayer de calculer depuis le fichier audio
      // Note: côté serveur, on ne peut pas facilement lire la durée d'un Blob
      // On utilise la durée fournie par le client qui l'a calculée depuis l'audio réel
      return NextResponse.json(
        { error: "Durée de l'enregistrement manquante ou invalide." },
        { status: 400 }
      );
    }

    durationSeconds = parseFloat(durationSecondsStr);
    if (isNaN(durationSeconds) || durationSeconds < 0) {
      return NextResponse.json(
        { error: "Durée de l'enregistrement invalide." },
        { status: 400 }
      );
    }

    // Calculer la durée en minutes PRÉCISE (sans arrondi)
    const durationMinutes = durationSeconds / 60; // PRÉCIS à 2 décimales
    const maxDurationSeconds = MAX_RECORDING_DURATION_MINUTES * 60;

    // Vérifier la limite de 60 minutes par enregistrement
    if (durationSeconds > maxDurationSeconds) {
      return NextResponse.json(
        {
          error: `Enregistrement trop long (${durationMinutes.toFixed(2)} min). La limite est de ${MAX_RECORDING_DURATION_MINUTES} minutes par enregistrement.`,
        },
        { status: 400 }
      );
    }

    console.log("[transcribe] Durée exacte calculée", {
      durationSeconds: durationSeconds.toFixed(2),
      durationMinutes: durationMinutes.toFixed(2),
    });

    // 4. Vérifier le quota utilisateur (système de secondes)
    const quotaStart = performance.now();
    const user = await getOrCreateUserWithQuotaSeconds(userId);
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

    const availableSeconds = getAvailableSeconds(
      user.quotaSecondsTotal,
      user.quotaSecondsUsed,
      user.quotaExtraSeconds
    );

    // Si quota insuffisant → retourner 403
    const secondsNeeded = Math.ceil(durationSeconds); // Arrondir à la seconde supérieure pour la vérification
    if (secondsNeeded > availableSeconds) {
      return NextResponse.json(
        {
          error: "Quota insuffisant",
          available: Math.floor(availableSeconds / 60), // En minutes pour compatibilité
          needed: Math.ceil(durationMinutes), // En minutes pour compatibilité
        },
        { status: 403 }
      );
    }

    // 5. Créer le Recording AVANT le débit
    const dbCreateStart = performance.now();
    const recording = await prisma.recording.create({
      data: {
        userId: user.id,
        status: "PROCESSING",
        audioBlobSize: audioFile.size,
        durationSeconds,
        durationMs: Math.round(durationSeconds * 1000), // PRÉCIS en millisecondes
        mimeType: audioFile.type,
        usageRecorded: false, // Sera mis à true après le débit
      },
    });
    timings.dbCreate = performance.now() - dbCreateStart;

    // 6. Débiter les secondes AVANT l'appel OpenAI (système précis)
    const debitStart = performance.now();
    const durationMs = Math.round(durationSeconds * 1000);
    const debitResult = await debitRecordingSeconds(user.id, recording.id, durationMs);
    if (!debitResult.success) {
      // Supprimer le recording si le débit a échoué
      await prisma.recording.delete({ where: { id: recording.id } }).catch(() => {});
      return NextResponse.json(
        {
          error: "Quota insuffisant",
          available: Math.floor(debitResult.remainingSeconds / 60), // En minutes pour compatibilité
          needed: Math.ceil(durationMinutes), // En minutes pour compatibilité
        },
        { status: 403 }
      );
    }
    timings.quotaCheck = performance.now() - quotaStart;
    timings.debitMinutes = performance.now() - debitStart;

    console.log("[transcribe] Débit précis effectué", {
      durationSeconds: durationSeconds.toFixed(2),
      durationMinutes: durationMinutes.toFixed(2),
      secondsDebited: debitResult.secondsDebited,
      remainingSeconds: debitResult.remainingSeconds,
    });

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
      // Note: Le débit a déjà été effectué via debitRecordingSeconds
      // On ne peut pas facilement le rollback car c'est un système de secondes avec UsageEvent
      // En production, on pourrait implémenter un système de crédit si nécessaire
      return NextResponse.json(
        { error: "Impossible de générer la transcription. Les secondes ont été débitées." },
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
