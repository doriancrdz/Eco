import { prisma } from "./prisma";
import { PLANS, PlanType } from "./billingConfig";
import { getCurrentMonthKey } from "./billing";

/**
 * Convertit les minutes d'un plan en secondes
 */
export function planMinutesToSeconds(plan: PlanType): number {
  const planConfig = PLANS[plan];
  return planConfig.minutesPerMonth * 60;
}

/**
 * Convertit les minutes d'un pack en secondes
 */
export function packMinutesToSeconds(minutes: number): number {
  return minutes * 60;
}

/**
 * Obtient ou crée un utilisateur avec gestion automatique du quota en secondes
 * Reset basé sur currentPeriodEnd (Stripe) ou monthKey (legacy)
 */
export async function getOrCreateUserWithQuotaSeconds(
  clerkUserId: string
): Promise<{
  id: string;
  plan: PlanType;
  monthKey: string;
  quotaSecondsTotal: number;
  quotaSecondsUsed: number;
  quotaExtraSeconds: number;
  quotaResetAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
}> {
  const currentMonthKey = getCurrentMonthKey();
  const now = new Date();

  let user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    // Créer un nouvel utilisateur avec quota par défaut
    const defaultQuotaSeconds = planMinutesToSeconds("free");
    user = await prisma.user.create({
      data: {
        clerkUserId,
        plan: "free",
        monthKey: currentMonthKey,
        quotaSecondsTotal: defaultQuotaSeconds,
        quotaSecondsUsed: 0,
        quotaExtraSeconds: 0,
        quotaResetAt: null,
      },
    });
  } else {
    // Vérifier si on doit reset le quota
    let shouldReset = false;
    let resetAt: Date | null = null;

    // Priorité 1: Reset basé sur currentPeriodEnd (Stripe)
    if (user.currentPeriodEnd) {
      if (now >= user.currentPeriodEnd) {
        shouldReset = true;
        resetAt = user.currentPeriodEnd;
      }
    }
    // Priorité 2: Reset basé sur monthKey (legacy)
    else if (user.monthKey !== currentMonthKey) {
      shouldReset = true;
      // Calculer la date de fin du mois précédent
      const [year, month] = user.monthKey.split("-").map(Number);
      resetAt = new Date(year, month, 0, 23, 59, 59); // Dernier jour du mois précédent
    }

    if (shouldReset) {
      const newQuotaTotal = planMinutesToSeconds(user.plan as PlanType);
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          monthKey: currentMonthKey,
          quotaSecondsTotal: newQuotaTotal,
          quotaSecondsUsed: 0,
          quotaExtraSeconds: 0,
          quotaResetAt: resetAt,
          // Legacy fields reset aussi
          minutesUsedMonth: 0,
          extraMinutesMonth: 0,
        },
      });
    } else {
      // S'assurer que quotaSecondsTotal est à jour avec le plan
      const expectedQuota = planMinutesToSeconds(user.plan as PlanType);
      if (user.quotaSecondsTotal !== expectedQuota) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            quotaSecondsTotal: expectedQuota,
          },
        });
      }
    }
  }

  return {
    id: user.id,
    plan: user.plan as PlanType,
    monthKey: user.monthKey,
    quotaSecondsTotal: user.quotaSecondsTotal,
    quotaSecondsUsed: user.quotaSecondsUsed,
    quotaExtraSeconds: user.quotaExtraSeconds,
    quotaResetAt: user.quotaResetAt,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    currentPeriodEnd: user.currentPeriodEnd,
  };
}

/**
 * Calcule les secondes disponibles pour un utilisateur
 */
export function getAvailableSeconds(
  quotaSecondsTotal: number,
  quotaSecondsUsed: number,
  quotaExtraSeconds: number
): number {
  return quotaSecondsTotal - quotaSecondsUsed + quotaExtraSeconds;
}

/**
 * Débite des secondes pour un enregistrement (transaction atomique)
 * @returns { success: boolean, remainingSeconds: number, overLimit: boolean }
 */
export async function debitRecordingSeconds(
  userId: string,
  recordingId: string,
  durationMs: number
): Promise<{
  success: boolean;
  remainingSeconds: number;
  overLimit: boolean;
  secondsDebited: number;
}> {
  const secondsToDebit = Math.floor(durationMs / 1000);

  return await prisma.$transaction(async (tx) => {
    // 1. Vérifier que le recording existe et appartient à l'utilisateur
    const recording = await tx.recording.findFirst({
      where: { id: recordingId, userId },
    });

    if (!recording) {
      throw new Error("Recording introuvable");
    }

    // 2. Vérifier idempotence : si déjà débité, retourner les infos actuelles
    if (recording.usageRecorded) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          quotaSecondsTotal: true,
          quotaSecondsUsed: true,
          quotaExtraSeconds: true,
        },
      });
      if (!user) throw new Error("Utilisateur introuvable");

      const remaining = getAvailableSeconds(
        user.quotaSecondsTotal,
        user.quotaSecondsUsed,
        user.quotaExtraSeconds
      );

      // Récupérer le montant déjà débité depuis UsageEvent
      const existingEvent = await tx.usageEvent.findUnique({
        where: { recordingId },
      });

      return {
        success: true,
        remainingSeconds: remaining,
        overLimit: false,
        secondsDebited: existingEvent?.secondsUsed || 0,
      };
    }

    // 3. Charger l'utilisateur avec reset si nécessaire
    const user = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Utilisateur introuvable");
    }

    // Reset si nécessaire (même logique que getOrCreateUserWithQuotaSeconds)
    const now = new Date();
    const currentMonthKey = getCurrentMonthKey();
    let shouldReset = false;

    if (user.currentPeriodEnd && now >= user.currentPeriodEnd) {
      shouldReset = true;
    } else if (!user.currentPeriodEnd && user.monthKey !== currentMonthKey) {
      shouldReset = true;
    }

    if (shouldReset) {
      const newQuotaTotal = planMinutesToSeconds(user.plan as PlanType);
      await tx.user.update({
        where: { id: userId },
        data: {
          monthKey: currentMonthKey,
          quotaSecondsTotal: newQuotaTotal,
          quotaSecondsUsed: 0,
          quotaExtraSeconds: 0,
          minutesUsedMonth: 0,
          extraMinutesMonth: 0,
        },
      });
    }

    // 4. Relire l'utilisateur après reset potentiel
    const updatedUser = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!updatedUser) {
      throw new Error("Utilisateur introuvable après reset");
    }

    // 5. Calculer les secondes disponibles
    const available = getAvailableSeconds(
      updatedUser.quotaSecondsTotal,
      updatedUser.quotaSecondsUsed,
      updatedUser.quotaExtraSeconds
    );

    // 6. Vérifier si quota suffisant
    if (secondsToDebit > available) {
      // Option: permettre consommation partielle jusqu'à la limite
      const partialSeconds = Math.max(0, available);
      const overLimit = true;

      if (partialSeconds > 0) {
        // Débiter partiellement
        let remainingToDebit = partialSeconds;
        let newExtraSeconds = updatedUser.quotaExtraSeconds;
        let newUsedSeconds = updatedUser.quotaSecondsUsed;

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

        await tx.user.update({
          where: { id: userId },
          data: {
            quotaSecondsUsed: newUsedSeconds,
            quotaExtraSeconds: newExtraSeconds,
          },
        });

        await tx.recording.update({
          where: { id: recordingId },
          data: {
            durationMs,
            usageRecorded: true,
          },
        });

        await tx.usageEvent.create({
          data: {
            userId,
            recordingId,
            secondsUsed: partialSeconds,
          },
        });

        return {
          success: true,
          remainingSeconds: 0,
          overLimit: true,
          secondsDebited: partialSeconds,
        };
      }

      return {
        success: false,
        remainingSeconds: available,
        overLimit: true,
        secondsDebited: 0,
      };
    }

    // 7. Débiter les secondes (d'abord les extra, puis les incluses)
    let remainingToDebit = secondsToDebit;
    let newExtraSeconds = updatedUser.quotaExtraSeconds;
    let newUsedSeconds = updatedUser.quotaSecondsUsed;

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

    // 8. Mettre à jour l'utilisateur
    await tx.user.update({
      where: { id: userId },
      data: {
        quotaSecondsUsed: newUsedSeconds,
        quotaExtraSeconds: newExtraSeconds,
      },
    });

    // 9. Mettre à jour le recording
    await tx.recording.update({
      where: { id: recordingId },
      data: {
        durationMs,
        usageRecorded: true,
      },
    });

    // 10. Créer l'événement d'usage (idempotence via unique constraint)
    await tx.usageEvent.create({
      data: {
        userId,
        recordingId,
        secondsUsed: secondsToDebit,
      },
    });

    // 11. Calculer les secondes restantes
    const finalUser = await tx.user.findUnique({
      where: { id: userId },
      select: {
        quotaSecondsTotal: true,
        quotaSecondsUsed: true,
        quotaExtraSeconds: true,
      },
    });

    if (!finalUser) {
      throw new Error("Erreur lors du calcul des secondes restantes");
    }

    const remaining = getAvailableSeconds(
      finalUser.quotaSecondsTotal,
      finalUser.quotaSecondsUsed,
      finalUser.quotaExtraSeconds
    );

    return {
      success: true,
      remainingSeconds: remaining,
      overLimit: false,
      secondsDebited: secondsToDebit,
    };
  });
}

/**
 * Formate les secondes en mm:ss pour l'affichage
 */
export function formatSecondsToMMSS(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Formate les secondes en minutes avec décimales (ex: 9.5 min)
 */
export function formatSecondsToMinutes(seconds: number): string {
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)} min`;
}

/**
 * Met à jour le quota total d'un utilisateur (lors d'un changement de plan)
 */
export async function updateUserQuotaTotal(
  userId: string,
  plan: PlanType
): Promise<void> {
  const newQuotaTotal = planMinutesToSeconds(plan);
  await prisma.user.update({
    where: { id: userId },
    data: {
      quotaSecondsTotal: newQuotaTotal,
    },
  });
}

/**
 * Ajoute des secondes supplémentaires (pour packs)
 */
export async function creditExtraSeconds(
  userId: string,
  seconds: number,
  monthKey: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  const currentMonthKey = getCurrentMonthKey();

  // Si on est dans un mois différent, reset d'abord
  if (user.monthKey !== currentMonthKey) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthKey: currentMonthKey,
        quotaSecondsUsed: 0,
        quotaExtraSeconds: 0,
        minutesUsedMonth: 0,
        extraMinutesMonth: 0,
      },
    });
  }

  // Ajouter les secondes supplémentaires uniquement si c'est le mois d'achat
  if (monthKey === currentMonthKey) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        quotaExtraSeconds: {
          increment: seconds,
        },
        // Legacy: aussi mettre à jour extraMinutesMonth
        extraMinutesMonth: {
          increment: Math.ceil(seconds / 60),
        },
      },
    });
  }
}
