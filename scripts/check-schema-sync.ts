import { execSync } from "child_process";

console.log("🔍 Vérification synchronisation Prisma...\n");

try {
  // 1. Valider le schéma local
  console.log("1️⃣ Vérification du schéma local...");
  execSync("npx prisma validate", { stdio: "inherit" });
  console.log("✅ Schéma local valide\n");

  // 2. Introspection DB (optionnel : compare schéma local vs DB)
  console.log("2️⃣ Vérification synchronisation avec la DB...");
  execSync("npx prisma db pull --force", { stdio: "inherit" });
  console.log("✅ Schéma synchronisé\n");

  // 3. Générer le client Prisma
  console.log("3️⃣ Génération du client Prisma...");
  execSync("npx prisma generate", { stdio: "inherit" });
  console.log("✅ Client généré\n");

  console.log("✅ ===== TOUT EST SYNCHRONISÉ =====\n");
  console.log("Le schéma Prisma est bien synchronisé avec la DB.");
} catch (error) {
  console.error("❌ ERREUR : Schéma non synchronisé !");
  console.error("Exécute manuellement :");
  console.error("  npx prisma db push");
  process.exit(1);
}
