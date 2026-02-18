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
import { probeDurationMs } from "@/lib/serverAudio";

/**
 * POST /api/recordings/[id]/complete
 * 
 * Débite les secondes consommées pour un enregistrement terminé.
 * Idempotent: si déjà débité, retourne les infos actuelles sans re-débit.
 * 
 * Body: { durationMs?: number }
 * - durationMs doit être un entier positif en millisecondes.
 * - Si durationMs est manquant ou invalide:
 *   - si USE_FFPROBE="true" et recording.audioUrl défini, le serveur tente
 *     de mesurer la durée via ffprobe.
 *   - sinon, fallback conservateur à une petite durée (par défaut 1000ms)
 *     ou aux champs legacy (durationMs / durationSeconds) du Recording.
 * 
 * Returns: {
 *   success: boolean,
 *   remainingSeconds: number,
 *   remainingFormatted: string, // "mm:ss"
 *   overLimit: boolean,
 *   secondsDebited: number,
 *   durationMsUsed?: number,
 *   durationSource?: string // "body" | "ffprobe" | "recording_durationMs" | "recording_durationSeconds" | "fallback_1000ms"
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const reqStart = performance.now();
  const traceId = req.headers.get("x-eco-trace") ?? null;

  try {
    // 1. Authentification
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // 2. Parse body de manière robuste (durationMs facultatif)
    let body: unknown = null;
    try {
      body = await req.json();
    } catch (err) {
      console.warn("[recordings/complete] JSON parse error, proceeding without durationMs", err);
    }

    let durationMs: number | undefined;
    let durationSource: string = "body";

    if (body && typeof body === "object" && "durationMs" in (body as Record<string, unknown>)) {
      const raw = (body as any).durationMs;
      const candidate =
        typeof raw === "string" ? Number(raw) : (raw as number | undefined);

      if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
        durationMs = candidate;
      }
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
      select: {
        id: true,
        audioUrl: true,
        durationSeconds: true,
        durationMs: true,
      },
    });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording introuvable" },
        { status: 404 }
      );
    }

    // 5. Fallback côté serveur si durationMs manquant ou invalide
    const ffprobeEnabled = process.env.USE_FFPROBE === "true";

    if (!durationMs || durationMs <= 0) {
      if (ffprobeEnabled && recording.audioUrl) {
        try {
          const probed = await probeDurationMs(recording.audioUrl);
          durationMs = probed;
          durationSource = "ffprobe";
          console.log("[recordings/complete] server probed durationMs via ffprobe", {
            recordingId: params.id,
            durationMs,
          });
        } catch (err) {
          console.error("[recordings/complete] ffprobe failed, will use fallback", err);
        }
      } else if (ffprobeEnabled && !recording.audioUrl) {
        console.warn("[recordings/complete] USE_FFPROBE=true but recording.audioUrl is missing", {
          recordingId: params.id,
        });
      }

      // Si ffprobe désactivé ou a échoué, utiliser les champs du recording ou un fallback conservateur
      if (!durationMs || durationMs <= 0) {
        if (recording.durationMs && recording.durationMs > 0) {
          durationMs = recording.durationMs;
          durationSource = "recording_durationMs";
        } else if (recording.durationSeconds && recording.durationSeconds > 0) {
          durationMs = Math.round(recording.durationSeconds * 1000);
          durationSource = "recording_durationSeconds";
        } else {
          durationMs = 1000;
          durationSource = "fallback_1000ms";
        }
      }
    }

    // Normalisation: entier positif
    durationMs = Math.max(1, Math.round(durationMs));

    // Limite de 30 minutes par enregistrement (après fallback éventuel)
    const maxDurationMs = 30 * 60 * 1000;
    if (durationMs > maxDurationMs) {
      return NextResponse.json(
        {
          error: `Enregistrement trop long (${Math.ceil(
            durationMs / 60000
          )} min). La limite est de 30 minutes.`,
        },
        { status: 400 }
      );
    }

    console.log("[recordings/complete] start", {
      traceId,
      recordingId: params.id,
      userId: user.id,
      durationMs,
      ts: Date.now(),
    });

    // 6. Débiter les secondes (transaction atomique)
    const result = await debitRecordingSeconds(user.id, params.id, durationMs);

    const totalMs = performance.now() - reqStart;

    if (!result.success) {
      console.log("[recordings/complete] Débit échoué (quota insuffisant)", {
        traceId,
        recordingId: params.id,
        userId: user.id,
        durationMs,
        remainingSeconds: result.remainingSeconds,
        overLimit: result.overLimit,
        totalMs: totalMs.toFixed(0),
        ts: Date.now(),
      });
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

    // 7. Mettre à jour le status du Recording à "DONE" après débit réussi
    await prisma.recording.update({
      where: { id: params.id },
      data: {
        status: "DONE",
        durationMs,
      },
    });

    const afterUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { quotaSecondsUsed: true, quotaSecondsTotal: true },
    });
    const quotaSecondsUsed = afterUser?.quotaSecondsUsed ?? 0;
    const quotaSecondsTotal = afterUser?.quotaSecondsTotal ?? 0;

    console.log("[recordings/complete] result", {
      traceId,
      recordingId: params.id,
      secondsDebited: result.secondsDebited,
      quotaSecondsUsed,
      quotaSecondsTotal,
      usageEventCreated: true,
      totalMs: totalMs.toFixed(0),
      ts: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      success: true,
      secondsDebited: result.secondsDebited,
      quotaSecondsUsed,
      quotaSecondsTotal,
      remainingSeconds: result.remainingSeconds,
      remainingFormatted: formatSecondsToMMSS(result.remainingSeconds),
      overLimit: result.overLimit,
      durationMsUsed: durationMs,
      durationSource,
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
