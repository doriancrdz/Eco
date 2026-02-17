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
 * Le client poll GET /api/recording/[id] pour la transcription.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const reqStart = performance.now();
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
      return NextResponse.json({ error: "Fichier audio invalide" }, { status: 400 });
    }

    const dbReadMs = performance.now() - reqStart;
    console.log("[recordings/transcribe] request start", {
      id: params.id,
      authMs: authMs.toFixed(0),
      dbReadMs: dbReadMs.toFixed(0),
      ts: Date.now(),
    });

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
      where: { id: params.id },
      data: {
        status: "TRANSCRIBED",
        transcriptionText: transcription,
        audioBlobSize: audioFile.size,
      },
    });
    const dbUpdateMs = performance.now() - dbUpdateStart;
    const totalMs = performance.now() - reqStart;

    console.log("[recordings/transcribe] request end", {
      id: params.id,
      whisperMs: whisperMs.toFixed(0),
      dbUpdateMs: dbUpdateMs.toFixed(0),
      totalMs: totalMs.toFixed(0),
      ts: Date.now(),
    });

    return NextResponse.json({
      recordingId: params.id,
      transcription,
      status: "TRANSCRIBED",
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
