import { prisma } from "../lib/prisma";

async function verifyPlanQuotas() {
  console.log("🔍 Vérification des quotas par plan...\n");

  const plans = ["student", "pro", "business"];

  for (const plan of plans) {
    const users = await prisma.user.findMany({
      where: { plan },
      select: {
        id: true,
        clerkUserId: true,
        plan: true,
        quotaSecondsTotal: true,
        createdAt: true,
      },
    });

    if (users.length === 0) {
      console.log(`Plan ${plan}: Aucun utilisateur`);
      continue;
    }

    console.log(`\n📊 Plan ${plan.toUpperCase()} (${users.length} utilisateur(s)):`);

    const expectedMinutes =
      plan === "student" ? 800 : plan === "pro" ? 2000 : plan === "business" ? 6000 : 0;

    const expectedSeconds = expectedMinutes * 60;

    users.forEach((user) => {
      const actualMinutes = user.quotaSecondsTotal / 60;
      const isCorrect = user.quotaSecondsTotal === expectedSeconds;

      console.log(`  - User ${user.clerkUserId?.substring(0, 15)}...`);
      console.log(`    Quota: ${actualMinutes} minutes (attendu: ${expectedMinutes})`);
      console.log(`    ${isCorrect ? "✅ CORRECT" : "❌ INCORRECT"}`);
    });
  }

  console.log("\n");

  await prisma.$disconnect();
}

verifyPlanQuotas();
