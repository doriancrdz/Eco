export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { planMinutesToSeconds, packMinutesToSeconds } from "@/lib/usage";
import { getCurrentMonthKey } from "@/lib/billing";

/**
 * POST /api/migrate/usage
 * 
 * Script de migration pour recalculer les usages existants en secondes.
 * 
 * Pour chaque Recording avec durationSeconds mais usageRecorded=false:
 * - Calcule les secondes depuis durationSeconds ou durationMs
 * - Crée un UsageEvent si pas déjà existant
 * - Met à jour le quota de l'utilisateur
 * 
 * Sécurité: Accessible uniquement en développement ou avec authentification admin
 */
export async function POST(req: NextRequest) {
  try {
    // Sécurité: uniquement en développement ou admin
    if (process.env.NODE_ENV === "production") {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      }
      // TODO: Vérifier que l'utilisateur est admin (ajouter un champ isAdmin dans User si nécessaire)
      // Pour l'instant, on permet seulement en développement
      return NextResponse.json(
        { error: "Migration uniquement disponible en développement" },
        { status: 403 }
      );
    }

    const results = {
      recordingsProcessed: 0,
      recordingsSkipped: 0,
      recordingsError: 0,
      usersUpdated: 0,
      totalSecondsDebited: 0,
      errors: [] as string[],
    };

    // 1. Récupérer tous les utilisateurs
    const users = await prisma.user.findMany({
      select: {
        id: true,
        clerkUserId: true,
        plan: true,
        monthKey: true,
        quotaSecondsTotal: true,
        quotaSecondsUsed: true,
        quotaExtraSeconds: true,
        currentPeriodEnd: true,
      },
    });

    console.log(`[migrate/usage] Début migration pour ${users.length} utilisateurs`);

    // 2. Pour chaque utilisateur, recalculer le quota total basé sur le plan
    for (const user of users) {
      try {
        const expectedQuotaTotal = planMinutesToSeconds(user.plan as any);
        
        // Reset si nécessaire (même logique que getOrCreateUserWithQuotaSeconds)
        const now = new Date();
        const currentMonthKey = getCurrentMonthKey();
        let shouldReset = false;

        if (user.currentPeriodEnd && now >= user.currentPeriodEnd) {
          shouldReset = true;
        } else if (!user.currentPeriodEnd && user.monthKey !== currentMonthKey) {
          shouldReset = true;
        }

        if (shouldReset || user.quotaSecondsTotal !== expectedQuotaTotal) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              quotaSecondsTotal: expectedQuotaTotal,
              quotaSecondsUsed: shouldReset ? 0 : user.quotaSecondsUsed,
              quotaExtraSeconds: shouldReset ? 0 : user.quotaExtraSeconds,
              monthKey: shouldReset ? currentMonthKey : user.monthKey,
            },
          });
          results.usersUpdated++;
        }
      } catch (error) {
        results.errors.push(`Erreur utilisateur ${user.id}: ${error instanceof Error ? error.message : String(error)}`);
        results.recordingsError++;
      }
    }

    // 3. Récupérer tous les recordings avec durationSeconds mais usageRecorded=false
    const recordings = await prisma.recording.findMany({
      where: {
        usageRecorded: false,
        OR: [
          { durationSeconds: { not: null } },
          { durationMs: { not: null } },
        ],
      },
      select: {
        id: true,
        userId: true,
        durationSeconds: true,
        durationMs: true,
      },
    });

    console.log(`[migrate/usage] ${recordings.length} recordings à traiter`);

    // 4. Pour chaque recording, créer l'UsageEvent et mettre à jour le quota
    for (const recording of recordings) {
      try {
        // Vérifier si UsageEvent existe déjà (idempotence)
        const existingEvent = await prisma.usageEvent.findUnique({
          where: { recordingId: recording.id },
        });

        if (existingEvent) {
          results.recordingsSkipped++;
          continue;
        }

        // Calculer les secondes depuis durationMs (préféré) ou durationSeconds
        let secondsToDebit = 0;
        
        if (recording.durationMs !== null && recording.durationMs > 0) {
          secondsToDebit = Math.floor(recording.durationMs / 1000);
        } else if (recording.durationSeconds !== null && recording.durationSeconds > 0) {
          // Convertir Float en Int (arrondi vers le bas pour être juste)
          secondsToDebit = Math.floor(recording.durationSeconds);
        } else {
          results.recordingsSkipped++;
          continue;
        }

        if (secondsToDebit <= 0) {
          results.recordingsSkipped++;
          continue;
        }

        // Débiter les secondes dans une transaction
        await prisma.$transaction(async (tx) => {
          // Charger l'utilisateur
          const user = await tx.user.findUnique({
            where: { id: recording.userId },
            select: {
              quotaSecondsTotal: true,
              quotaSecondsUsed: true,
              quotaExtraSeconds: true,
            },
          });

          if (!user) {
            throw new Error(`Utilisateur ${recording.userId} introuvable`);
          }

          // Calculer les secondes disponibles
          const available = user.quotaSecondsTotal - user.quotaSecondsUsed + user.quotaExtraSeconds;

          // Débiter (même logique que debitRecordingSeconds)
          let remainingToDebit = secondsToDebit;
          let newExtraSeconds = user.quotaExtraSeconds;
          let newUsedSeconds = user.quotaSecondsUsed;

          // Si quota insuffisant, débiter seulement ce qui est disponible
          if (remainingToDebit > available) {
            remainingToDebit = Math.max(0, available);
          }

          // Débiter d'abord les extra seconds
          if (newExtraSeconds > 0 && remainingToDebit > 0) {
            const debitFromExtra = Math.min(newExtraSeconds, remainingToDebit);
            newExtraSeconds -= debitFromExtra;
            remainingToDebit -= debitFromExtra;
          }

          // Débiter ensuite les secondes incluses
          if (remainingToDebit > 0) {
            newUsedSeconds += remainingToDebit;
          }

          // Mettre à jour l'utilisateur
          await tx.user.update({
            where: { id: recording.userId },
            data: {
              quotaSecondsUsed: newUsedSeconds,
              quotaExtraSeconds: newExtraSeconds,
            },
          });

          // Mettre à jour le recording
          await tx.recording.update({
            where: { id: recording.id },
            data: {
              usageRecorded: true,
              // S'assurer que durationMs est défini
              durationMs: recording.durationMs ?? (recording.durationSeconds ? Math.floor(recording.durationSeconds * 1000) : null),
            },
          });

          // Créer l'UsageEvent
          await tx.usageEvent.create({
            data: {
              userId: recording.userId,
              recordingId: recording.id,
              secondsUsed: secondsToDebit,
            },
          });
        });

        results.recordingsProcessed++;
        results.totalSecondsDebited += secondsToDebit;
      } catch (error) {
        results.errors.push(
          `Erreur recording ${recording.id}: ${error instanceof Error ? error.message : String(error)}`
        );
        results.recordingsError++;
      }
    }

    console.log(`[migrate/usage] Migration terminée`, results);

    return NextResponse.json({
      success: true,
      message: "Migration terminée",
      results,
    });
  } catch (error) {
    const err = error as { message?: string; stack?: string };
    console.error("[migrate/usage] Error:", {
      message: err?.message,
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
