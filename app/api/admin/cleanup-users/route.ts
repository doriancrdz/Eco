import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const ADMIN_CLERK_USER_ID = "user_39dRWQ2EkFMC9D95LvxywQHWpv2";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId || userId !== ADMIN_CLERK_USER_ID) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Chercher les utilisateurs à nettoyer (clerkUserId vide ou placeholder "Non renseigné")
    const usersToClean = await prisma.user.findMany({
      where: {
        clerkUserId: { in: ["", "Non renseigné"] },
      },
    });

    console.log("[Cleanup] Utilisateurs à nettoyer:", usersToClean.length);

    if (usersToClean.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Aucun utilisateur à nettoyer",
        deleted: 0,
      });
    }

    // Supprimer ces utilisateurs (cascade vers ecos, recordings, etc.)
    const deleted = await prisma.user.deleteMany({
      where: {
        clerkUserId: { in: ["", "Non renseigné"] },
      },
    });

    console.log("[Cleanup] Utilisateurs supprimés:", deleted.count);

    return NextResponse.json({
      success: true,
      message: `${deleted.count} utilisateur(s) supprimé(s)`,
      deleted: deleted.count,
      users: usersToClean.map((u) => ({ id: u.id, clerkUserId: u.clerkUserId })),
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[Cleanup] Erreur:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: err?.message ?? "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
