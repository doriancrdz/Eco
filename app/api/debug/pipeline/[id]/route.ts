import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/debug/pipeline/[id]
 * DEV ONLY. Retourne l'état du pipeline pour un recording/eco id.
 * Permet de voir en un appel où ça bloque.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

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

    const id = params.id;

    const recording = await prisma.recording.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        status: true,
        aiStatus: true,
        durationMs: true,
        transcriptionText: true,
        summaryJson: true,
        updatedAt: true,
      },
    });

    const eco = await prisma.eco.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        transcriptionText: true,
        content: true,
        updatedAt: true,
      },
    });

    const lastUsageEvent = await prisma.usageEvent.findUnique({
      where: { recordingId: id },
      select: { createdAt: true, secondsUsed: true },
    });

    const recordingPayload = recording
      ? {
          id: recording.id,
          status: recording.status,
          aiStatus: recording.aiStatus,
          durationMs: recording.durationMs,
          transcriptionLen: recording.transcriptionText?.length ?? 0,
          summaryLen: recording.summaryJson?.length ?? 0,
          updatedAt: recording.updatedAt.toISOString(),
        }
      : null;

    const ecoPayload = eco
      ? {
          id: eco.id,
          transcriptionLen: eco.transcriptionText?.length ?? 0,
          contentLen: eco.content?.length ?? 0,
          updatedAt: eco.updatedAt.toISOString(),
        }
      : null;

    const lastUsagePayload = lastUsageEvent
      ? {
          createdAt: lastUsageEvent.createdAt.toISOString(),
          secondsDebited: lastUsageEvent.secondsUsed,
        }
      : null;

    return NextResponse.json({
      recording: recordingPayload,
      eco: ecoPayload,
      lastUsageEvent: lastUsagePayload,
    });
  } catch (error) {
    console.error("[debug/pipeline] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
