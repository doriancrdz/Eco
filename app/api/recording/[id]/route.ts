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
  try {
    const { userId } = await auth();
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
    console.error("[recording] Erreur:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}
