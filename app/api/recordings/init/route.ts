export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUserWithQuotaSeconds, getAvailableSeconds } from "@/lib/usage";
import { canUseMinutes } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { MAX_RECORDING_DURATION_MINUTES } from "@/lib/billingConfig";

/**
 * Crée un Recording et retourne recordingId immédiatement (sans audio).
 * Le client navigue, puis envoie l'audio via POST /api/recordings/[id]/transcribe.
 * 
 * NOTE: Le débit du quota se fait maintenant dans /api/recordings/[id]/complete
 * après l'upload du fichier audio. Ici on fait seulement la validation.
 */
export async function POST(req: NextRequest) {
  const reqStart = performance.now();
  const timings: Record<string, number> = {};

  try {
    const authStart = performance.now();
    const { userId } = await auth();
    timings.auth = performance.now() - authStart;

    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();
    const traceId = req.headers.get("x-eco-trace") ?? (body && typeof body === "object" && "traceId" in body ? (body as { traceId?: string }).traceId : null);
    const { durationSeconds: ds, mimeType } = body;
    const durationSeconds = parseFloat(ds);

    if (isNaN(durationSeconds) || durationSeconds < 0) {
      return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
    }

    // Limite de 60 minutes par enregistrement
    const maxDurationSeconds = MAX_RECORDING_DURATION_MINUTES * 60;
    if (durationSeconds > maxDurationSeconds) {
      const durationMinutes = durationSeconds / 60; // PRÉCIS
      return NextResponse.json(
        { error: `Enregistrement trop long (${durationMinutes.toFixed(2)} min). Limite ${MAX_RECORDING_DURATION_MINUTES} min.` },
        { status: 400 }
      );
    }

    // Validation du quota (sans débit)
    const quotaStart = performance.now();
    const user = await getOrCreateUserWithQuotaSeconds(userId);
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeSubscriptionId: true, subscriptionStatus: true },
    });

    if (fullUser && !canUseMinutes(fullUser)) {
      return NextResponse.json({ error: "Paiement échoué — accès suspendu" }, { status: 402 });
    }

    // Vérifier que l'utilisateur a au moins quelques secondes disponibles
    // (le débit exact se fera dans /complete avec la durée réelle mesurée)
    const available = getAvailableSeconds(
      user.quotaSecondsTotal,
      user.quotaSecondsUsed,
      user.quotaExtraSeconds
    );

    // Si quota complètement épuisé, refuser dès maintenant
    if (available <= 0) {
      return NextResponse.json(
        { error: "Quota insuffisant", available, needed: Math.ceil(durationSeconds) },
        { status: 403 }
      );
    }

    timings.quota = performance.now() - quotaStart;

    // Créer le recording sans débit
    const dbStart = performance.now();
    const recording = await prisma.recording.create({
      data: {
        userId: user.id,
        status: "PROCESSING",
        durationSeconds, // Legacy field, sera remplacé par durationMs dans /complete
        mimeType: mimeType || "audio/webm",
        usageRecorded: false, // Sera mis à true dans /complete
      },
    });
    timings.dbCreate = performance.now() - dbStart;
    timings.total = performance.now() - reqStart;

    console.log("[recordings/init] request end", {
      traceId: traceId ?? undefined,
      recordingId: recording.id,
      authMs: timings.auth?.toFixed(0),
      totalMs: timings.total.toFixed(0),
      ts: Date.now(),
    });

    return NextResponse.json({
      recordingId: recording.id,
      status: "PROCESSING",
      timings: process.env.NODE_ENV === "development" ? timings : undefined,
    });
  } catch (error) {
    console.error("[recordings/init] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
