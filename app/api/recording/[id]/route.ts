export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/recording/[id]
 * Récupère l'état d'un Recording (pour polling côté client)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const reqStart = performance.now();
  try {
    const authStart = performance.now();
    const { userId } = await auth();
    const authMs = performance.now() - authStart;
    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const recording = await prisma.recording.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
      select: {
        id: true,
        status: true,
        transcriptionText: true,
        summaryJson: true,
        errorMessage: true,
        aiStatus: true,
        aiError: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!recording) {
      return NextResponse.json({ error: "Recording introuvable" }, { status: 404 });
    }

    const totalMs = performance.now() - reqStart;
    console.log("[recording GET] request end", {
      id: params.id,
      status: recording.status,
      aiStatus: recording.aiStatus,
      authMs: authMs.toFixed(0),
      totalMs: totalMs.toFixed(0),
      ts: Date.now(),
    });

    let summary = null;
    if (recording.summaryJson) {
      try {
        summary = JSON.parse(recording.summaryJson);
      } catch {
        // Ignore parse error
      }
    }

    return NextResponse.json({
      recordingId: recording.id,
      status: recording.status,
      aiStatus: recording.aiStatus ?? "IDLE",
      transcription: recording.transcriptionText,
      summary,
      errorMessage: recording.errorMessage,
      aiError: recording.aiError,
      createdAt: recording.createdAt.toISOString(),
      updatedAt: recording.updatedAt.toISOString(),
    });
  } catch (error) {
    const err = error as { message?: string; stack?: string };
    console.error("[recording/[id] GET] Error:", {
      message: err?.message,
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
