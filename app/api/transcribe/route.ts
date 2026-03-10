export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { canUseMinutes } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserWithQuotaSeconds, getAvailableSeconds, debitRecordingSeconds } from "@/lib/usage";
import { MAX_RECORDING_DURATION_MINUTES } from "@/lib/billingConfig";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000, // 120 secondes pour les longs audios (25+ min)
});

function getR2Client(): S3Client | null {
  const accountId =
    process.env.R2_ACCOUNT_ID ||
    process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
    process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID ||
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const endpoint =
    process.env.CLOUDFLARE_R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  if (!endpoint || !accessKeyId || !secretAccessKey) return null;

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

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

    // 2. Récupérer soit :
    //    - une key R2 + durée (JSON) pour éviter l'upload direct vers Vercel
    //    - soit, en fallback, le fichier audio via FormData (clé "audio")
    const contentTypeHeader = req.headers.get("content-type") || "";
    let audioFile: File | null = null;
    let durationSeconds: number | null = null;

    if (contentTypeHeader.startsWith("application/json")) {
      const jsonStart = performance.now();
      const body = await req.json().catch(() => null);
      timings.formDataParse = performance.now() - jsonStart;

      const key = body?.key as string | undefined;
      const durationSecondsValue = body?.durationSeconds as number | undefined;

      if (!key || typeof key !== "string") {
        return NextResponse.json(
          { error: "Clé R2 manquante ou invalide." },
          { status: 400 }
        );
      }

      if (
        typeof durationSecondsValue !== "number" ||
        !Number.isFinite(durationSecondsValue) ||
        durationSecondsValue <= 0
      ) {
        return NextResponse.json(
          { error: "Durée de l'enregistrement manquante ou invalide." },
          { status: 400 }
        );
      }

      durationSeconds = durationSecondsValue;

      const s3 = getR2Client();
      const bucket =
        process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME;
      if (!s3 || !bucket) {
        return NextResponse.json(
          { error: "Stockage R2 non configuré." },
          { status: 503 }
        );
      }

      const object = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      const bodyStream = object.Body;
      if (!bodyStream) {
        return NextResponse.json(
          { error: "Impossible de lire le fichier audio depuis R2." },
          { status: 500 }
        );
      }

      const audioBuffer = Buffer.from(await bodyStream.transformToByteArray());
      const fileName = key.split("/").pop() || "recording.webm";
      const mimeType =
        object.ContentType || "audio/webm";
      audioFile = new File([audioBuffer], fileName, { type: mimeType });

      if (process.env.NODE_ENV === "development") {
        console.log("[transcribe] Récupéré depuis R2", {
          key,
          mimeType,
          sizeBytes: audioBuffer.length,
          sizeMB: (audioBuffer.length / 1024 / 1024).toFixed(2),
        });
      }
    } else {
      const formDataStart = performance.now();
      const formData = await req.formData();
      const formAudioFile = formData.get("audio");
      const durationSecondsStr = formData.get("durationSeconds");
      timings.formDataParse = performance.now() - formDataStart;

      if (process.env.NODE_ENV === "development") {
        console.log("[transcribe] FormData reçu", {
          hasAudioFile: !!formAudioFile,
          audioFileType:
            formAudioFile &&
            typeof formAudioFile === "object" &&
            "type" in formAudioFile
              ? (formAudioFile as File).type
              : typeof formAudioFile,
          audioFileSize:
            formAudioFile &&
            typeof formAudioFile === "object" &&
            "size" in formAudioFile
              ? (formAudioFile as File).size
              : null,
          durationSecondsStr,
        });
      }

      if (!formAudioFile || !(formAudioFile instanceof File)) {
        if (process.env.NODE_ENV === "development") {
          console.error("[transcribe] Fichier audio invalide");
        }
        return NextResponse.json(
          { error: "Aucun fichier audio valide fourni." },
          { status: 400 }
        );
      }

      if (formAudioFile.size === 0) {
        if (process.env.NODE_ENV === "development") {
          console.error("[transcribe] Fichier audio vide");
        }
        return NextResponse.json(
          { error: "Le fichier audio est vide." },
          { status: 400 }
        );
      }

      const fileSizeInMB = formAudioFile.size / (1024 * 1024);
      if (process.env.NODE_ENV === "development") {
        console.log("[transcribe] Taille fichier:", fileSizeInMB.toFixed(2), "MB");
      }
      if (fileSizeInMB > 24) {
        return NextResponse.json(
          {
            error:
              "Fichier audio trop volumineux (max 24MB). Veuillez raccourcir votre enregistrement.",
          },
          { status: 400 }
        );
      }

      if (!durationSecondsStr || typeof durationSecondsStr !== "string") {
        return NextResponse.json(
          { error: "Durée de l'enregistrement manquante ou invalide." },
          { status: 400 }
        );
      }

      const parsed = parseFloat(durationSecondsStr);
      if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json(
          { error: "Durée de l'enregistrement invalide." },
          { status: 400 }
        );
      }

      durationSeconds = parsed;
      audioFile = formAudioFile;
    }

    if (!audioFile || durationSeconds == null) {
      return NextResponse.json(
        { error: "Requête invalide (audio ou durée manquants)." },
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

    if (process.env.NODE_ENV === "development") {
      console.log("[transcribe] Durée exacte calculée", {
        durationSeconds: durationSeconds.toFixed(2),
        durationMinutes: durationMinutes.toFixed(2),
      });
    }

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
      user.quotaExtraSeconds,
      user.bonusSeconds
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

    if (process.env.NODE_ENV === "development") {
      console.log("[transcribe] Débit précis effectué", {
        durationSeconds: durationSeconds.toFixed(2),
        durationMinutes: durationMinutes.toFixed(2),
        secondsDebited: debitResult.secondsDebited,
        remainingSeconds: debitResult.remainingSeconds,
      });
    }

    async function transcribeWithRetry(file: File, maxRetries = 3): Promise<string> {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (process.env.NODE_ENV === "development") {
            console.log(`[transcribe] Tentative ${attempt}/${maxRetries}`);
          }
          const fileForAttempt = new File([buffer], file.name, { type: file.type });
          const response = await openai.audio.transcriptions.create({
            file: fileForAttempt,
            model: "whisper-1",
            language: "fr",
            response_format: "text",
          });
          const text = typeof response === "string" ? response : (response as { text?: string }).text ?? "";
          if (process.env.NODE_ENV === "development") {
            console.log("[transcribe] Succès, longueur:", text.length, "caractères");
          }
          return text;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (process.env.NODE_ENV === "development") {
            console.error(`[transcribe] Tentative ${attempt} échouée:`, errMsg);
          }
          if (attempt === maxRetries) throw err;
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          if (process.env.NODE_ENV === "development") {
            console.log(`[transcribe] Retry dans ${delay}ms...`);
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      throw new Error("Transcription échouée après retries");
    }

    try {
      const whisperStart = performance.now();
      const transcription = await transcribeWithRetry(audioFile);
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

      if (process.env.NODE_ENV === "development") {
        console.log("[transcribe] request end", {
          authMs: timings.auth?.toFixed(0),
          whisperMs: timings.whisperTranscription?.toFixed(0),
          totalMs: timings.total?.toFixed(0),
          ts: Date.now(),
        });
      }

      return NextResponse.json(
        {
          recordingId: recording.id,
          transcription,
          status: "TRANSCRIBED",
          timings: process.env.NODE_ENV === "development" ? timings : undefined,
        },
        { status: 200 }
      );
    } catch (openaiError: unknown) {
      const err = openaiError as { message?: string; status?: number; code?: string };
      const errMsg = err?.message ?? String(openaiError);
      if (process.env.NODE_ENV === "development") {
        console.error("[transcribe] Erreur OpenAI:", { message: errMsg, code: err?.code, status: err?.status });
      }
      await prisma.recording.update({
        where: { id: recording.id },
        data: {
          status: "ERROR",
          errorMessage: errMsg,
        },
      }).catch(() => {});

      if (err?.status === 413) {
        return NextResponse.json(
          { error: "Fichier audio trop volumineux. Veuillez raccourcir votre enregistrement." },
          { status: 400 }
        );
      }
      if (err?.code === "ETIMEDOUT" || errMsg?.toLowerCase?.().includes("timeout")) {
        return NextResponse.json(
          { error: "Le traitement a pris trop de temps. Veuillez réessayer ou raccourcir votre enregistrement." },
          { status: 408 }
        );
      }
      return NextResponse.json(
        { error: "Erreur lors de la transcription. Veuillez réessayer." },
        { status: 500 }
      );
    }
  } catch (error) {
    const err = error as { message?: string; stack?: string };
    console.error("[transcribe] Error:", {
      message: err?.message,
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
