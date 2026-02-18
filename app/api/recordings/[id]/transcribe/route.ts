export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const formData = await req.formData();
    const audioFile = formData.get("audio");
    if (!audioFile || !(audioFile instanceof File) || audioFile.size === 0) {
      console.log("[transcribe] AUDIO_MISSING", { traceId, recordingId: params.id, userId: user.id });
      return NextResponse.json({ error: "AUDIO_MISSING", code: "AUDIO_MISSING" }, { status: 400 });
    }

    const recordingId = params.id;
    console.log("[transcribe] start", { traceId, recordingId, userId: user.id, ts: Date.now() });

    const whisperStart = performance.now();
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "fr",
    });
    const transcription = transcriptionResponse.text;
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
  } catch (error) {
    console.error("[recordings/transcribe] Erreur:", error);

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
                errorMessage: error instanceof Error ? error.message : String(error),
              },
            });
          }
        }
      }
    } catch (e) {
      console.error("[recordings/transcribe] Update ERROR:", e);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur transcription" },
      { status: 500 }
    );
  }
}
