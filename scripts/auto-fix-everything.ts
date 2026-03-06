import { prisma } from "../lib/prisma";
import * as readline from "readline";

// Fonction pour poser une question à l'utilisateur
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

async function autoFixEverything() {
  console.log("🤖 ===== AUTO-FIX COMPLET =====\n");

  const ADMIN_EMAIL = "cdorian654@yahoo.com";

  try {
    // ÉTAPE 1 : Demander le Clerk User ID
    console.log("1️⃣ Récupération du Clerk User ID...");
    console.log("");
    console.log("📌 Pour trouver ton Clerk User ID :");
    console.log("   1. Va sur https://dashboard.clerk.com");
    console.log('   2. Clique sur "Users"');
    console.log("   3. Cherche ton compte (cdorian654@yahoo.com)");
    console.log('   4. Copie le "User ID" (commence par user_2...)');
    console.log("");

    const CLERK_USER_ID = await askQuestion("Colle ton Clerk User ID ici : ");

    if (!CLERK_USER_ID || !CLERK_USER_ID.startsWith("user_")) {
      console.error('❌ ERREUR : ID invalide. Il doit commencer par "user_"');
      return;
    }

    console.log("✅ Clerk User ID reçu :", CLERK_USER_ID);
    console.log("");

    // ÉTAPE 2 : Diagnostic de la base de données
    console.log("2️⃣ Diagnostic de la base de données...");

    await prisma.$connect();
    console.log("✅ Connexion DB OK");

    const userCount = await prisma.user.count();
    console.log(`📊 Nombre total d'utilisateurs dans la DB : ${userCount}`);

    if (userCount === 0) {
      console.log("⚠️  BASE DE DONNÉES VIDE - Aucun utilisateur");
    } else {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          clerkUserId: true,
          plan: true,
          quotaSecondsTotal: true,
          quotaSecondsUsed: true,
          createdAt: true,
        },
        take: 10,
      });
      console.log("📋 Utilisateurs existants (max 10) :");
      console.table(users);
    }
    console.log("");

    // ÉTAPE 3 : Chercher l'admin dans la DB
    console.log("3️⃣ Recherche de l'admin dans la DB...");

    let admin = await prisma.user.findUnique({
      where: { clerkUserId: CLERK_USER_ID },
    });

    if (admin) {
      console.log("✅ Admin trouvé dans la DB");
      console.log("   Plan actuel :", admin.plan);
      console.log(
        "   Quota secondes :",
        admin.quotaSecondsTotal - admin.quotaSecondsUsed,
        "/",
        admin.quotaSecondsTotal
      );
    } else {
      console.log("❌ Admin NON trouvé dans la DB");
    }
    console.log("");

    // ÉTAPE 4 : Créer ou mettre à jour l'admin
    console.log("4️⃣ Création/Mise à jour de l'admin...");

    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    if (admin) {
      // Mettre à jour si le plan n'est pas Pro
      if (admin.plan !== "pro") {
        console.log("⚠️  Plan incorrect, mise à jour vers Pro...");

        admin = await prisma.user.update({
          where: { id: admin.id },
          data: {
            plan: "pro",
            quotaSecondsTotal: 2000 * 60, // 2000 minutes = 120000 secondes
            quotaSecondsUsed: 0,
            quotaExtraSeconds: 0,
            bonusSeconds: 0,
            monthKey: currentMonth,
            currentPeriodEnd: new Date("2030-12-31"),
            billingMode: "annual",
          },
        });

        console.log("✅ Plan mis à jour vers Pro (2000 minutes)");
      } else {
        console.log("✅ Plan déjà correct (Pro)");
      }
    } else {
      // Créer l'admin
      console.log("🔨 Création de l'utilisateur admin...");

      admin = await prisma.user.create({
        data: {
          clerkUserId: CLERK_USER_ID,
          plan: "pro",
          quotaSecondsTotal: 2000 * 60, // 2000 minutes
          quotaSecondsUsed: 0,
          quotaExtraSeconds: 0,
          bonusSeconds: 0,
          monthKey: currentMonth,
          currentPeriodEnd: new Date("2030-12-31"),
          billingMode: "annual",
        },
      });

      console.log("✅ Admin créé avec succès");
    }
    console.log("");

    // ÉTAPE 5 : Vérification finale
    console.log("5️⃣ Vérification finale...");

    const finalUserCount = await prisma.user.count();
    console.log(`📊 Nombre total d'utilisateurs : ${finalUserCount}`);

    const finalAdmin = await prisma.user.findUnique({
      where: { clerkUserId: CLERK_USER_ID },
    });

    if (finalAdmin) {
      console.log("✅ Admin vérifié :");
      console.log("   ID:", finalAdmin.id);
      console.log("   Clerk User ID:", finalAdmin.clerkUserId);
      console.log("   Plan:", finalAdmin.plan);
      console.log("   Quota total (minutes):", finalAdmin.quotaSecondsTotal / 60);
      console.log("   Quota utilisé (minutes):", finalAdmin.quotaSecondsUsed / 60);
      console.log(
        "   Quota restant (minutes):",
        (finalAdmin.quotaSecondsTotal - finalAdmin.quotaSecondsUsed) / 60
      );
      console.log("   Fin période:", finalAdmin.currentPeriodEnd);
    }
    console.log("");

    // ÉTAPE 6 : Simuler /api/billing/me
    console.log("6️⃣ Simulation de l'API /api/billing/me...");

    if (finalAdmin) {
      const availableSeconds = Math.max(
        0,
        finalAdmin.quotaSecondsTotal -
          finalAdmin.quotaSecondsUsed +
          (finalAdmin.bonusSeconds || 0)
      );
      const availableMinutes = Math.floor(availableSeconds / 60);
      const minutesPerMonth = Math.floor(finalAdmin.quotaSecondsTotal / 60);
      const bonusMinutes = Math.floor((finalAdmin.bonusSeconds || 0) / 60);

      const billingData = {
        plan: finalAdmin.plan,
        minutesPerMonth,
        availableMinutes,
        bonusMinutes,
        paymentBlocked: availableSeconds <= 0,
        currentPeriodEnd: finalAdmin.currentPeriodEnd,
        billingMode: finalAdmin.billingMode,
      };

      console.log("📊 Données qui seraient retournées par /api/billing/me :");
      console.log(JSON.stringify(billingData, null, 2));
    }
    console.log("");

    console.log("✅ ===== AUTO-FIX TERMINÉ =====\n");
    console.log("🎉 Tout est corrigé ! Tu peux maintenant :");
    console.log("   1. Lancer : npm run dev");
    console.log("   2. Aller sur http://localhost:3000 → Voir la barre des minutes");
    console.log("   3. Aller sur http://localhost:3000/admin → Voir ton utilisateur");
    console.log("   4. Aller sur http://localhost:3000/pricing → Tester le checkout");
    console.log("");
  } catch (error: any) {
    console.error("\n❌ ===== ERREUR AUTO-FIX =====");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    console.error("===== FIN ERREUR =====\n");
  } finally {
    await prisma.$disconnect();
  }
}

autoFixEverything();

