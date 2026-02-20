export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000,
});

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Reçoit l'audio et lance Whisper. Appelé en fire-and-forget par le client.
 * Le client poll GET /api/ecos/[id] pour l’affichage (transcription + résumé).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const reqStart = performance.now();
  const traceId = req.headers.get("x-eco-trace") ?? null;

  try {
    const authStart = performance.now();
    const { userId } = await auth();
    const authMs = performance.now() - authStart;

    if (!userId || !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: userId ? "Clé API manquante" : "Non authentifié" },
        { status: userId ? 500 : 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const recording = await prisma.recording.findFirst({
      where: { id: params.id, userId: user.id },
      select: {
        id: true,
        userId: true,
        status: true,
        transcriptionText: true,
        fileId: true,
        r2Key: true,
      },
    });
    if (!recording) {
      return NextResponse.json({ error: "Recording introuvable" }, { status: 404 });
    }
    if (recording.status !== "PROCESSING") {
      return NextResponse.json(
        { recordingId: params.id, status: recording.status, transcription: recording.transcriptionText },
        { status: 200 }
      );
    }

    const recordingId = params.id;
    let audioFile: File;

    if (recording.r2Key || recording.fileId) {
      const s3 = getR2Client();
      const bucket = process.env.R2_BUCKET_NAME;
      if (!s3 || !bucket) {
        return NextResponse.json(
          { ok: false, error: "R2 non configuré", code: "R2_NOT_CONFIGURED" },
          { status: 503 }
        );
      }
      const key = recording.r2Key ?? `${recording.userId}/${recording.fileId}.webm`;
      console.log("[transcribe] Téléchargement depuis R2:", key);
      const getRes = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      const body = getRes.Body;
      if (!body) {
        return NextResponse.json(
          { ok: false, error: "Fichier R2 introuvable", code: "R2_MISSING" },
          { status: 404 }
        );
      }
      const bytes = await body.transformToByteArray();
      const buffer = Buffer.from(bytes);
      const mime = getRes.ContentType ?? "audio/webm";
      audioFile = new File([buffer], "recording.webm", { type: mime });
      const sizeMB = (audioFile.size / 1024 / 1024).toFixed(2);
      console.log("[transcribe] Fichier R2 récupéré", {
        key,
        contentType: mime,
        sizeBytes: audioFile.size,
        sizeMB: `${sizeMB} MB`,
      });
    } else {
      const formData = await req.formData();
      const file = formData.get("audio");
      const fileSize = file && file instanceof File ? file.size : 0;
      if (!file || !(file instanceof File) || file.size === 0) {
        return NextResponse.json(
          { ok: false, error: "AUDIO_MISSING", code: "AUDIO_MISSING", detail: "Fichier audio absent ou vide" },
          { status: 400 }
        );
      }
      const fileSizeInMB = file.size / (1024 * 1024);
      console.log("[API] Audio reçu via formData", {
        traceId,
        recordingId,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        sizeMB: `${fileSizeInMB.toFixed(2)} MB`,
        ts: Date.now(),
      });
      if (fileSizeInMB > 24) {
        return NextResponse.json(
          { ok: false, error: "Fichier audio trop volumineux (max 24MB).", code: "FILE_TOO_LARGE" },
          { status: 400 }
        );
      }
      audioFile = file;
    }

    const fileSize = audioFile.size;
    console.log("[transcribe] start", { traceId, recordingId, userId: user.id, fileSize, ts: Date.now() });

    async function transcribeWithRetry(file: File, maxRetries = 3): Promise<string> {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[transcribe] Tentative ${attempt}/${maxRetries}`);
          const fileForAttempt = new File([buffer], file.name, { type: file.type });
          const response = await openai.audio.transcriptions.create({
            file: fileForAttempt,
            model: "whisper-1",
            language: "fr",
            response_format: "text",
          });
          const text = typeof response === "string" ? response : (response as { text?: string }).text ?? "";
          console.log("[transcribe] Succès, longueur:", text.length, "caractères");
          return text;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[transcribe] Tentative ${attempt} échouée:`, errMsg);
          if (attempt === maxRetries) throw err;
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`[transcribe] Retry dans ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      throw new Error("Transcription échouée après retries");
    }

    const whisperStart = performance.now();
    const transcription = await transcribeWithRetry(audioFile);
    const whisperMs = performance.now() - whisperStart;

    const dbUpdateStart = performance.now();
    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: "TRANSCRIBED",
        transcriptionText: transcription,
        audioBlobSize: audioFile.size,
      },
    });
    console.log("[transcribe] recording updated", {
      hasTranscription: !!transcription,
      len: transcription?.length ?? 0,
      ts: Date.now(),
    });

    // Sync Eco (id = recordingId) : upsert pour être robuste si l'Eco n'existe pas encore
    console.log("[transcribe] syncing eco", { ecoId: recordingId });
    const defaultTitle = `Eco du ${new Date().toLocaleDateString("fr-FR")}`;
    const updatedEco = await prisma.eco.upsert({
      where: { id: recordingId },
      create: {
        id: recordingId,
        userId: user.id,
        title: defaultTitle,
        transcriptionText: transcription,
        content: null,
      },
      update: { transcriptionText: transcription },
      select: { id: true, transcriptionText: true },
    });
    console.log("[transcribe] eco synced", {
      ecoId: updatedEco?.id,
      hasTranscription: !!updatedEco?.transcriptionText,
      len: updatedEco?.transcriptionText?.length ?? 0,
      ts: Date.now(),
    });

    const dbUpdateMs = performance.now() - dbUpdateStart;
    const totalMs = performance.now() - reqStart;
    const transcriptionLen = transcription?.length ?? 0;
    console.log("[transcribe] end", {
      traceId,
      recordingId,
      transcriptionLen,
      whisperMs: whisperMs.toFixed(0),
      dbUpdateMs: dbUpdateMs.toFixed(0),
      totalMs: totalMs.toFixed(0),
      ts: Date.now(),
    });

    return NextResponse.json({
      recordingId,
      transcription,
      status: "TRANSCRIBED",
      transcriptionLen,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number; code?: string; type?: string };
    const errMsg = err?.message ?? String(error);
    const errStack = error instanceof Error ? (error as Error).stack : undefined;
    console.error("[recordings/transcribe] Erreur complète:", {
      message: errMsg,
      code: err?.code,
      status: err?.status,
      type: err?.type,
    }, errStack);

    try {
      const { userId } = await auth();
      if (userId) {
        const user = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
        if (user) {
          const rec = await prisma.recording.findFirst({
            where: { id: params.id, userId: user.id },
          });
          if (rec) {
            await prisma.recording.update({
              where: { id: params.id },
              data: {
                status: "ERROR",
                errorMessage: errMsg,
              },
            });
          }
        }
      }
    } catch (e) {
      console.error("[recordings/transcribe] Update ERROR:", e);
    }

    if (err?.status === 413) {
      return NextResponse.json(
        { ok: false, error: "Fichier audio trop volumineux. Veuillez raccourcir votre enregistrement.", code: "FILE_TOO_LARGE" },
        { status: 400 }
      );
    }
    if (err?.code === "ETIMEDOUT" || errMsg?.toLowerCase?.().includes("timeout")) {
      return NextResponse.json(
        { ok: false, error: "Le traitement a pris trop de temps. Veuillez réessayer ou raccourcir votre enregistrement.", code: "TIMEOUT" },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Erreur lors de la transcription. Veuillez réessayer.", code: "TRANSCRIBE_ERROR" },
      { status: 500 }
    );
  }
}
