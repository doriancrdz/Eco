import { prisma } from "./prisma";
import { PLANS, PlanType } from "./billingConfig";
import { getCurrentMonthKey } from "./billing";
import { getStripeOrNull } from "./stripe";

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
  bonusSeconds: number;
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
        bonusSeconds: 0,
        quotaResetAt: null,
      },
    });
  } else {
    // Vérifier si on doit reset le quota
    let shouldReset = false;
    let resetAt: Date | null = null;
    let currentPeriodEnd: Date | null = user.currentPeriodEnd;

    // Priorité 1: Si l'utilisateur a un abonnement Stripe mais pas de currentPeriodEnd, le récupérer
    if (!currentPeriodEnd && user.stripeSubscriptionId) {
      try {
        const stripe = getStripeOrNull();
        if (stripe) {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          if (subscription.current_period_end) {
            currentPeriodEnd = new Date(subscription.current_period_end * 1000);
            // Mettre à jour la DB pour éviter de refaire cette requête
            await prisma.user.update({
              where: { id: user.id },
              data: { currentPeriodEnd },
            });
          }
        }
      } catch (error) {
        console.error("[getOrCreateUserWithQuotaSeconds] Erreur récupération subscription Stripe:", error);
      }
    }

    // Priorité 2: Reset basé sur currentPeriodEnd (date anniversaire)
    if (currentPeriodEnd) {
      if (now >= currentPeriodEnd) {
        shouldReset = true;
        resetAt = currentPeriodEnd;
      }
    }
    // Priorité 3: Reset basé sur monthKey (legacy, uniquement pour utilisateurs free sans abonnement)
    else if (user.plan === "free" && !user.stripeSubscriptionId && user.monthKey !== currentMonthKey) {
      shouldReset = true;
      // Calculer la date de fin du mois précédent
      const [year, month] = user.monthKey.split("-").map(Number);
      resetAt = new Date(year, month, 0, 23, 59, 59); // Dernier jour du mois précédent
    }

    if (shouldReset) {
      const newQuotaTotal = planMinutesToSeconds(user.plan as PlanType);
      
      // Si reset basé sur date anniversaire et on a une subscription Stripe, récupérer la prochaine période
      let nextPeriodEnd: Date | null = null;
      if (currentPeriodEnd && resetAt && user.stripeSubscriptionId) {
        try {
          const stripe = getStripeOrNull();
          if (stripe) {
            const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
            if (subscription.current_period_end) {
              nextPeriodEnd = new Date(subscription.current_period_end * 1000);
            }
          }
        } catch (error) {
          console.error("[getOrCreateUserWithQuotaSeconds] Erreur récupération subscription pour nextPeriodEnd:", error);
        }
      }
      
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          monthKey: currentMonthKey,
          quotaSecondsTotal: newQuotaTotal,
          quotaSecondsUsed: 0,
          quotaExtraSeconds: 0,
          // bonusSeconds: JAMAIS RESET (permanent)
          quotaResetAt: resetAt,
          // Mettre à jour currentPeriodEnd si on a récupéré la prochaine période depuis Stripe
          ...(nextPeriodEnd && { currentPeriodEnd: nextPeriodEnd }),
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
    bonusSeconds: user.bonusSeconds,
    quotaResetAt: user.quotaResetAt,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    currentPeriodEnd: user.currentPeriodEnd,
  };
}

/**
 * Calcule les secondes disponibles pour un utilisateur
 * Les bonusSeconds sont permanents et s'ajoutent aux minutes du plan
 */
export function getAvailableSeconds(
  quotaSecondsTotal: number,
  quotaSecondsUsed: number,
  quotaExtraSeconds: number,
  bonusSeconds: number = 0
): number {
  // Minutes du plan encore disponibles ce mois-ci
  const planSecondsLeft = Math.max(0, quotaSecondsTotal - quotaSecondsUsed);
  // Total = minutes du plan + bonus permanents + extra (legacy)
  return planSecondsLeft + bonusSeconds + quotaExtraSeconds;
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
          bonusSeconds: true,
        },
      });
      if (!user) throw new Error("Utilisateur introuvable");

      const remaining = getAvailableSeconds(
        user.quotaSecondsTotal,
        user.quotaSecondsUsed,
        user.quotaExtraSeconds,
        user.bonusSeconds
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
    let currentPeriodEnd: Date | null = user.currentPeriodEnd;

    // Si l'utilisateur a un abonnement Stripe mais pas de currentPeriodEnd, le récupérer
    if (!currentPeriodEnd && user.stripeSubscriptionId) {
      try {
        const stripe = getStripeOrNull();
        if (stripe) {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          if (subscription.current_period_end) {
            currentPeriodEnd = new Date(subscription.current_period_end * 1000);
          }
        }
      } catch (error) {
        console.error("[debitRecordingSeconds] Erreur récupération subscription Stripe:", error);
      }
    }

    // Reset basé sur currentPeriodEnd (date anniversaire) en priorité
    if (currentPeriodEnd && now >= currentPeriodEnd) {
      shouldReset = true;
    }
    // Reset basé sur monthKey uniquement pour utilisateurs free sans abonnement
    else if (user.plan === "free" && !user.stripeSubscriptionId && user.monthKey !== currentMonthKey) {
      shouldReset = true;
    }

    if (shouldReset) {
      const newQuotaTotal = planMinutesToSeconds(user.plan as PlanType);
      
      // Si reset basé sur date anniversaire et on a une subscription Stripe, récupérer la prochaine période
      let nextPeriodEnd: Date | null = null;
      if (currentPeriodEnd && now >= currentPeriodEnd && user.stripeSubscriptionId) {
        try {
          const stripe = getStripeOrNull();
          if (stripe) {
            const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
            if (subscription.current_period_end) {
              nextPeriodEnd = new Date(subscription.current_period_end * 1000);
            }
          }
        } catch (error) {
          console.error("[debitRecordingSeconds] Erreur récupération subscription pour nextPeriodEnd:", error);
        }
      }
      
      await tx.user.update({
        where: { id: userId },
        data: {
          monthKey: currentMonthKey,
          quotaSecondsTotal: newQuotaTotal,
          quotaSecondsUsed: 0,
          quotaExtraSeconds: 0,
          // bonusSeconds: JAMAIS RESET (permanent)
          // Mettre à jour currentPeriodEnd si on a récupéré la prochaine période depuis Stripe
          ...(nextPeriodEnd && { currentPeriodEnd: nextPeriodEnd }),
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
      updatedUser.quotaExtraSeconds,
      updatedUser.bonusSeconds
    );

    // 6. Vérifier si quota suffisant
    if (secondsToDebit > available) {
      // Option: permettre consommation partielle jusqu'à la limite
      const partialSeconds = Math.max(0, available);
      const overLimit = true;

      if (partialSeconds > 0) {
        // Débiter partiellement
        let remainingToDebit = partialSeconds;
        let newBonusSeconds = updatedUser.bonusSeconds;
        let newUsedSeconds = updatedUser.quotaSecondsUsed;
        const planSecondsLeft = Math.max(0, updatedUser.quotaSecondsTotal - updatedUser.quotaSecondsUsed);

        // Débiter d'abord les secondes du plan
        if (planSecondsLeft > 0 && remainingToDebit > 0) {
          const debitFromPlan = Math.min(planSecondsLeft, remainingToDebit);
          newUsedSeconds += debitFromPlan;
          remainingToDebit -= debitFromPlan;
        }

        // Débiter ensuite les bonus permanents
        if (newBonusSeconds > 0 && remainingToDebit > 0) {
          const debitFromBonus = Math.min(newBonusSeconds, remainingToDebit);
          newBonusSeconds -= debitFromBonus;
          remainingToDebit -= debitFromBonus;
        }

        await tx.user.update({
          where: { id: userId },
          data: {
            quotaSecondsUsed: newUsedSeconds,
            bonusSeconds: newBonusSeconds,
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

    // 7. Débiter les secondes (d'abord le plan, puis les bonus permanents)
    let remainingToDebit = secondsToDebit;
    let newBonusSeconds = updatedUser.bonusSeconds;
    let newUsedSeconds = updatedUser.quotaSecondsUsed;
    const planSecondsLeft = Math.max(0, updatedUser.quotaSecondsTotal - updatedUser.quotaSecondsUsed);

    // Débiter d'abord les secondes du plan
    if (planSecondsLeft > 0 && remainingToDebit > 0) {
      const debitFromPlan = Math.min(planSecondsLeft, remainingToDebit);
      newUsedSeconds += debitFromPlan;
      remainingToDebit -= debitFromPlan;
    }

    // Débiter ensuite les bonus permanents
    if (newBonusSeconds > 0 && remainingToDebit > 0) {
      const debitFromBonus = Math.min(newBonusSeconds, remainingToDebit);
      newBonusSeconds -= debitFromBonus;
      remainingToDebit -= debitFromBonus;
    }

    // 8. Mettre à jour l'utilisateur
    await tx.user.update({
      where: { id: userId },
      data: {
        quotaSecondsUsed: newUsedSeconds,
        bonusSeconds: newBonusSeconds,
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
        bonusSeconds: true,
      },
    });

    if (!finalUser) {
      throw new Error("Erreur lors du calcul des secondes restantes");
    }

    const remaining = getAvailableSeconds(
      finalUser.quotaSecondsTotal,
      finalUser.quotaSecondsUsed,
      finalUser.quotaExtraSeconds,
      finalUser.bonusSeconds
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
 * Ajoute des secondes supplémentaires (pour packs) - LEGACY
 * Utiliser creditBonusSeconds pour les nouveaux packs permanents
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
        // bonusSeconds: JAMAIS RESET (permanent)
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

/**
 * Ajoute des secondes bonus permanentes (pour packs) - NOUVEAU
 * Les bonusSeconds ne sont JAMAIS reset, contrairement à quotaExtraSeconds
 */
export async function creditBonusSeconds(
  userId: string,
  seconds: number
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  // Ajouter les secondes bonus de manière permanente (jamais reset)
  await prisma.user.update({
    where: { id: userId },
    data: {
      bonusSeconds: {
        increment: seconds,
      },
    },
  });
}
