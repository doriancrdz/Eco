export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateUserWithQuotaSeconds,
  debitRecordingSeconds,
  formatSecondsToMMSS,
} from "@/lib/usage";
import { canUseMinutes } from "@/lib/billing";

/**
 * POST /api/recordings/[id]/complete
 * 
 * Débite les secondes consommées pour un enregistrement terminé.
 * Idempotent: si déjà débité, retourne les infos actuelles sans re-débit.
 * 
 * Body: { durationMs: number }
 * 
 * Returns: {
 *   success: boolean,
 *   remainingSeconds: number,
 *   remainingFormatted: string, // "mm:ss"
 *   overLimit: boolean,
 *   secondsDebited: number
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const reqStart = performance.now();

  try {
    // 1. Authentification
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const { durationMs } = body;

    if (typeof durationMs !== "number" || durationMs < 0 || !Number.isFinite(durationMs)) {
      return NextResponse.json(
        { error: "durationMs doit être un nombre positif" },
        { status: 400 }
      );
    }

    // Limite de 30 minutes par enregistrement
    const maxDurationMs = 30 * 60 * 1000;
    if (durationMs > maxDurationMs) {
      return NextResponse.json(
        {
          error: `Enregistrement trop long (${Math.ceil(durationMs / 60000)} min). La limite est de 30 minutes.`,
        },
        { status: 400 }
      );
    }

    // 3. Vérifier que l'utilisateur peut utiliser le service
    const user = await getOrCreateUserWithQuotaSeconds(userId);
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeSubscriptionId: true, subscriptionStatus: true },
    });

    if (fullUser && !canUseMinutes(fullUser)) {
      return NextResponse.json(
        { error: "Paiement échoué — accès suspendu" },
        { status: 402 }
      );
    }

    // 4. Vérifier que le recording existe et appartient à l'utilisateur
    const recording = await prisma.recording.findFirst({
      where: { id: params.id, userId: user.id },
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording introuvable" },
        { status: 404 }
      );
    }

    // 5. Débiter les secondes (transaction atomique)
    const result = await debitRecordingSeconds(user.id, params.id, durationMs);

    const totalMs = performance.now() - reqStart;

    console.log("[recordings/complete] request end", {
      recordingId: params.id,
      durationMs,
      secondsDebited: result.secondsDebited,
      remainingSeconds: result.remainingSeconds,
      overLimit: result.overLimit,
      totalMs: totalMs.toFixed(0),
      ts: Date.now(),
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Quota insuffisant",
          remainingSeconds: result.remainingSeconds,
          remainingFormatted: formatSecondsToMMSS(result.remainingSeconds),
          overLimit: result.overLimit,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      remainingSeconds: result.remainingSeconds,
      remainingFormatted: formatSecondsToMMSS(result.remainingSeconds),
      overLimit: result.overLimit,
      secondsDebited: result.secondsDebited,
    });
  } catch (error) {
    console.error("[recordings/complete] Erreur:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 }
    );
  }
}
