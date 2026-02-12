import { prisma } from "./prisma";
import { PLANS, PlanType } from "./billingConfig";

/**
 * Obtient la clé du mois actuel au format "YYYY-MM" (timezone Europe/Paris)
 */
export function getCurrentMonthKey(): string {
  const now = new Date();
  // Convertir en Europe/Paris
  const parisTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
  const year = parisTime.getFullYear();
  const month = String(parisTime.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Obtient ou crée un utilisateur avec gestion automatique du reset mensuel
 */
export async function getOrCreateUserWithQuota(
  clerkUserId: string
): Promise<{
  id: string;
  plan: PlanType;
  monthKey: string;
  minutesUsedMonth: number;
  extraMinutesMonth: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}> {
  const currentMonthKey = getCurrentMonthKey();

  let user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    // Créer un nouvel utilisateur
    user = await prisma.user.create({
      data: {
        clerkUserId,
        plan: "free",
        monthKey: currentMonthKey,
        minutesUsedMonth: 0,
        extraMinutesMonth: 0,
      },
    });
  } else {
    // Vérifier si on doit reset le mois
    if (user.monthKey !== currentMonthKey) {
      // Reset mensuel : remettre à zéro les minutes utilisées et les packs
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          monthKey: currentMonthKey,
          minutesUsedMonth: 0,
          extraMinutesMonth: 0, // Les packs sont valables uniquement pour le mois d'achat
        },
      });
    }
  }

  return {
    id: user.id,
    plan: user.plan as PlanType,
    monthKey: user.monthKey,
    minutesUsedMonth: user.minutesUsedMonth,
    extraMinutesMonth: user.extraMinutesMonth,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
  };
}

/**
 * Calcule les minutes disponibles pour un utilisateur
 */
export function getAvailableMinutes(
  plan: PlanType,
  minutesUsedMonth: number,
  extraMinutesMonth: number
): number {
  const planConfig = PLANS[plan];
  const includedMinutes = planConfig.minutesPerMonth;
  return includedMinutes - minutesUsedMonth + extraMinutesMonth;
}

/**
 * Débite des minutes pour un utilisateur
 * @returns true si le débit a réussi, false si quota insuffisant
 */
export async function debitMinutes(
  userId: string,
  minutesToDebit: number
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  const currentMonthKey = getCurrentMonthKey();
  
  // Vérifier si on est dans le bon mois
  if (user.monthKey !== currentMonthKey) {
    // Reset automatique si changement de mois
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthKey: currentMonthKey,
        minutesUsedMonth: 0,
        extraMinutesMonth: 0,
      },
    });
    // Relire l'utilisateur après reset
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!updatedUser) throw new Error("Utilisateur introuvable après reset");
    
    // Vérifier les quotas après reset
    const available = getAvailableMinutes(
      updatedUser.plan as PlanType,
      updatedUser.minutesUsedMonth,
      updatedUser.extraMinutesMonth
    );
    
    if (minutesToDebit > available) {
      return false;
    }
  } else {
    // Vérifier les quotas dans le mois courant
    const available = getAvailableMinutes(
      user.plan as PlanType,
      user.minutesUsedMonth,
      user.extraMinutesMonth
    );
    
    if (minutesToDebit > available) {
      return false;
    }
  }

  // Débiter les minutes (d'abord les extra, puis les included)
  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!updatedUser) throw new Error("Utilisateur introuvable");

  let remainingToDebit = minutesToDebit;
  let newExtraMinutes = updatedUser.extraMinutesMonth;
  let newUsedMinutes = updatedUser.minutesUsedMonth;

  // Débiter d'abord les extra minutes
  if (newExtraMinutes > 0 && remainingToDebit > 0) {
    const debitFromExtra = Math.min(newExtraMinutes, remainingToDebit);
    newExtraMinutes -= debitFromExtra;
    remainingToDebit -= debitFromExtra;
  }

  // Débiter ensuite les minutes incluses
  if (remainingToDebit > 0) {
    newUsedMinutes += remainingToDebit;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      minutesUsedMonth: newUsedMinutes,
      extraMinutesMonth: newExtraMinutes,
    },
  });

  return true;
}

/**
 * Crédite des minutes supplémentaires (pour packs)
 */
export async function creditExtraMinutes(
  userId: string,
  minutes: number,
  monthKey: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  // Si on est dans un mois différent, reset d'abord
  const currentMonthKey = getCurrentMonthKey();
  if (user.monthKey !== currentMonthKey) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        monthKey: currentMonthKey,
        minutesUsedMonth: 0,
        extraMinutesMonth: 0,
      },
    });
  }

  // Ajouter les minutes supplémentaires uniquement si c'est le mois d'achat
  if (monthKey === currentMonthKey) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        extraMinutesMonth: {
          increment: minutes,
        },
      },
    });
  }
}

/**
 * Met à jour le plan d'un utilisateur
 */
export async function updateUserPlan(
  userId: string,
  plan: PlanType,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      ...(stripeCustomerId && { stripeCustomerId }),
      ...(stripeSubscriptionId && { stripeSubscriptionId }),
    },
  });
}
