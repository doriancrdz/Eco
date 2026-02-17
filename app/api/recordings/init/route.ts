export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUserWithQuota, getAvailableMinutes, canUseMinutes, debitMinutes } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

/**
 * Crée un Recording et retourne recordingId immédiatement (sans audio).
 * Le client navigue, puis envoie l'audio via POST /api/recordings/[id]/transcribe.
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
    const { durationSeconds: ds, mimeType } = body;
    const durationSeconds = parseFloat(ds);

    if (isNaN(durationSeconds) || durationSeconds < 0) {
      return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
    }

    const minutesNeeded = Math.ceil(durationSeconds / 60);
    if (minutesNeeded > 30) {
      return NextResponse.json(
        { error: `Enregistrement trop long (${minutesNeeded} min). Limite 30 min.` },
        { status: 400 }
      );
    }

    const quotaStart = performance.now();
    const user = await getOrCreateUserWithQuota(userId);
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeSubscriptionId: true, subscriptionStatus: true },
    });

    if (fullUser && !canUseMinutes(fullUser)) {
      return NextResponse.json({ error: "Paiement échoué — accès suspendu" }, { status: 402 });
    }

    const available = getAvailableMinutes(user.plan, user.minutesUsedMonth, user.extraMinutesMonth);
    if (minutesNeeded > available) {
      return NextResponse.json(
        { error: "Quota insuffisant", available, needed: minutesNeeded },
        { status: 403 }
      );
    }

    const debitSuccess = await debitMinutes(user.id, minutesNeeded);
    if (!debitSuccess) {
      const u = await getOrCreateUserWithQuota(userId);
      const avail = getAvailableMinutes(u.plan, u.minutesUsedMonth, u.extraMinutesMonth);
      return NextResponse.json({ error: "Quota insuffisant", available: avail, needed: minutesNeeded }, { status: 403 });
    }

    timings.quota = performance.now() - quotaStart;

    const dbStart = performance.now();
    const recording = await prisma.recording.create({
      data: {
        userId: user.id,
        status: "PROCESSING",
        durationSeconds,
        mimeType: mimeType || "audio/webm",
      },
    });
    timings.dbCreate = performance.now() - dbStart;
    timings.total = performance.now() - reqStart;

    console.log("[recordings/init] request end", {
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
