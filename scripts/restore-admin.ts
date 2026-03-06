import { prisma } from "../lib/prisma";
import { updateUserQuotaTotal } from "../lib/usage";

async function restoreAdmin() {
  console.log("🔧 ===== RESTAURATION ADMIN =====\n");

  // Email purement informatif (stocké dans Clerk, pas dans la DB Prisma)
  const ADMIN_EMAIL = "cdorian654@yahoo.com";

  // IMPORTANT : Remplacer par le vrai Clerk User ID de l'admin
  // Va sur https://dashboard.clerk.com → Users → cherche ton compte → copie l'ID (ex: user_2...)
  const CLERK_USER_ID = "REMPLACER_PAR_TON_CLERK_USER_ID";

  if (CLERK_USER_ID === "REMPLACER_PAR_TON_CLERK_USER_ID") {
    console.error(
      "❌ ERREUR : Tu dois remplacer CLERK_USER_ID par ton vrai ID Clerk dans scripts/restore-admin.ts."
    );
    console.error(
      "   Va sur https://dashboard.clerk.com → Users → ton compte → copie l'ID (champ 'User ID')."
    );
    return;
  }

  try {
    // 1. Vérifier si l'admin existe (clé fonctionnelle = clerkUserId)
    console.log("1️⃣ Vérification utilisateur admin par clerkUserId...");
    let admin = await prisma.user.findUnique({
      where: { clerkUserId: CLERK_USER_ID },
    });

    if (admin) {
      console.log("✅ Admin trouvé en base de données.");
      console.log(`   ID interne Prisma : ${admin.id}`);
      console.log(`   Clerk User ID    : ${admin.clerkUserId}`);
      console.log(`   Email (Clerk)    : ${ADMIN_EMAIL}`);
      console.log(`   Plan actuel      : ${admin.plan}`);

      // 2. Forcer le plan Pro si nécessaire
      if (admin.plan !== "pro") {
        console.log("⚠️  Plan incorrect, mise à jour vers 'pro'...");
        admin = await prisma.user.update({
          where: { id: admin.id },
          data: {
            plan: "pro",
          },
        });
        console.log("✅ Plan mis à jour vers 'pro'.");
      } else {
        console.log("✅ Plan déjà 'pro'.");
      }

      // 3. Remettre à jour le quota total en fonction du plan Pro
      console.log("3️⃣ Mise à jour du quota seconds total pour 'pro'...");
      await updateUserQuotaTotal(admin.id, "pro");
      console.log("✅ Quota seconds total mis à jour.");
    } else {
      console.log("❌ Admin NON trouvé, création en cours...");
      admin = await prisma.user.create({
        data: {
          clerkUserId: CLERK_USER_ID,
          plan: "pro",
          // Les autres champs (quotaSecondsTotal, etc.) seront ajustés par updateUserQuotaTotal
        },
      });
      console.log("✅ Admin créé avec succès.");

      console.log("3️⃣ Initialisation du quota seconds total pour 'pro'...");
      await updateUserQuotaTotal(admin.id, "pro");
      console.log("✅ Quota seconds total initialisé.");
    }

    // 4. Afficher l'état final
    const finalAdmin = await prisma.user.findUnique({
      where: { id: admin.id },
    });

    console.log("\n📊 État final admin :");
    console.log(JSON.stringify(finalAdmin, null, 2));
  } catch (error: any) {
    console.error("❌ ERREUR lors de la restauration admin:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n🔧 ===== FIN RESTAURATION =====\n");
}

restoreAdmin().catch((err) => {
  console.error("❌ restoreAdmin() a échoué:", err);
  process.exit(1);
});

