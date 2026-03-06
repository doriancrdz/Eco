import { prisma } from "../lib/prisma";
import { PLANS } from "../lib/billingConfig";
import { getOrCreateUserWithQuotaSeconds, getAvailableSeconds, formatSecondsToMMSS } from "../lib/usage";

async function diagnoseAll() {
  console.log("🔍 ===== DIAGNOSTIC COMPLET =====\n");

  try {
    // 1. Test connexion DB
    console.log("1️⃣ Test connexion base de données...");
    await prisma.$connect();
    console.log("✅ Connexion DB OK\n");

    // 2. Compter les utilisateurs
    console.log("2️⃣ Comptage utilisateurs...");
    const userCount = await prisma.user.count();
    console.log(`📊 Nombre total d'utilisateurs : ${userCount}\n`);

    // 3. Lister tous les utilisateurs (si présents)
    if (userCount > 0) {
      console.log("3️⃣ Liste des utilisateurs (principaux champs) :");
      const users = await prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          clerkUserId: true,
          plan: true,
          monthKey: true,
          quotaSecondsTotal: true,
          quotaSecondsUsed: true,
          quotaExtraSeconds: true,
          bonusSeconds: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          subscriptionStatus: true,
          billingMode: true,
          currentPeriodEnd: true,
          createdAt: true,
        },
      });
      console.table(
        users.map((u) => ({
          id: u.id,
          clerkUserId: u.clerkUserId,
          plan: u.plan,
          monthKey: u.monthKey,
          quotaTotalSec: u.quotaSecondsTotal,
          quotaUsedSec: u.quotaSecondsUsed,
          extraSec: u.quotaExtraSeconds,
          bonusSec: u.bonusSeconds,
          stripeCustomerId: u.stripeCustomerId,
          stripeSubscriptionId: u.stripeSubscriptionId,
          subscriptionStatus: u.subscriptionStatus,
          billingMode: u.billingMode,
          currentPeriodEnd: u.currentPeriodEnd,
          createdAt: u.createdAt,
        }))
      );
      console.log();
    } else {
      console.log("❌ PROBLÈME : Base de données VIDE - Aucun utilisateur trouvé\n");
    }

    // 4. Chercher spécifiquement l'admin (par clerkUserId)
    console.log("4️⃣ Recherche utilisateur admin par clerkUserId...");
    const ADMIN_CLERK_USER_ID = "REMPLACER_PAR_TON_CLERK_USER_ID";

    if (ADMIN_CLERK_USER_ID === "REMPLACER_PAR_TON_CLERK_USER_ID") {
      console.log(
        "⚠️  ADMIN_CLERK_USER_ID non défini dans scripts/diagnose-all.ts (ligne 48). " +
          "Modifie cette constante avec ton vrai Clerk User ID pour un diagnostic complet de l'admin.\n"
      );
    } else {
      const admin = await prisma.user.findUnique({
        where: { clerkUserId: ADMIN_CLERK_USER_ID },
      });

      if (admin) {
        console.log("✅ Admin trouvé :");
        console.log(JSON.stringify(admin, null, 2));
      } else {
        console.log(`❌ PROBLÈME : Admin clerkUserId=${ADMIN_CLERK_USER_ID} NON TROUVÉ dans la DB\n`);
      }
    }

    // 5. Vérifier les enregistrements
    console.log("\n5️⃣ Comptage enregistrements (recordings)...");
    const recordingCount = await prisma.recording.count();
    console.log(`📊 Nombre d'enregistrements : ${recordingCount}\n`);

    // 6. Vérifier les dossiers
    console.log("6️⃣ Comptage dossiers (folders)...");
    const folderCount = await prisma.folder.count();
    console.log(`📊 Nombre de dossiers : ${folderCount}\n`);

    // 7. Simulation API /api/billing/me pour l'admin (si possible)
    console.log("7️⃣ Simulation API /api/billing/me pour l'admin...");
    if (ADMIN_CLERK_USER_ID === "REMPLACER_PAR_TON_CLERK_USER_ID") {
      console.log(
        "⚠️  Impossible de simuler /api/billing/me tant que ADMIN_CLERK_USER_ID n'est pas renseigné.\n"
      );
    } else {
      try {
        const user = await getOrCreateUserWithQuotaSeconds(ADMIN_CLERK_USER_ID);
        const fullUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            commitmentEndAt: true,
            billingMode: true,
            stripeSubscriptionId: true,
            subscriptionStatus: true,
            bonusSeconds: true,
          },
        });

        const planConfig = PLANS[user.plan];

        // Statut de paiement bloqué (même logique que /api/billing/me)
        const subscriptionBlocked = Boolean(
          fullUser?.stripeSubscriptionId &&
            (fullUser.subscriptionStatus === "past_due" || fullUser.subscriptionStatus === "unpaid")
        );

        const availableSeconds = subscriptionBlocked
          ? 0
          : getAvailableSeconds(
              user.quotaSecondsTotal,
              user.quotaSecondsUsed,
              user.quotaExtraSeconds,
              user.bonusSeconds
            );
        const availableMinutes = Math.floor(availableSeconds / 60);

        const quotaResetAt = user.currentPeriodEnd?.toISOString() ?? null;

        const billingData = {
          plan: user.plan,
          planName: planConfig.name,
          minutesPerMonth: planConfig.minutesPerMonth,
          minutesUsedMonth: Math.ceil(user.quotaSecondsUsed / 60),
          extraMinutesMonth: Math.ceil(user.quotaExtraSeconds / 60),
          availableMinutes,
          quotaSecondsTotal: user.quotaSecondsTotal,
          quotaSecondsUsed: user.quotaSecondsUsed,
          quotaExtraSeconds: user.quotaExtraSeconds,
          bonusSeconds: user.bonusSeconds,
          availableSeconds,
          availableSecondsFormatted: formatSecondsToMMSS(availableSeconds),
          quotaResetAt,
          commitmentEndAt: fullUser?.commitmentEndAt?.toISOString() ?? null,
          billingMode: fullUser?.billingMode ?? null,
          subscriptionStatus: fullUser?.subscriptionStatus ?? null,
          stripeSubscriptionId: fullUser?.stripeSubscriptionId ?? null,
          paymentBlocked: subscriptionBlocked ?? false,
        };

        console.log("📊 Données billing simulées pour /api/billing/me (admin) :");
        console.log(JSON.stringify(billingData, null, 2));
      } catch (error: any) {
        console.error("❌ ERREUR lors de la simulation /api/billing/me pour l'admin:", error?.message);
      }
    }

    // 8. Vérifier la connexion DB (Neon / PostgreSQL)
    console.log("\n8️⃣ Informations connexion DB...");
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      console.log(`DATABASE_URL: ${dbUrl.substring(0, 80)}...`);
    } else {
      console.log("❌ DATABASE_URL non définie dans l'environnement.");
    }
  } catch (error: any) {
    console.error("❌ ERREUR CRITIQUE:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n🔍 ===== FIN DIAGNOSTIC =====\n");
}

diagnoseAll().catch((err) => {
  console.error("❌ diagnoseAll() a échoué:", err);
  process.exit(1);
});

