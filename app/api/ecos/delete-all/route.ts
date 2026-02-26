import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Trouver l'utilisateur en base
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Supprimer tous les ECOs de l'utilisateur
    const result = await prisma.eco.deleteMany({
      where: {
        userId: user.id,
      },
    });

    return NextResponse.json({
      count: result.count,
      message: `${result.count} ECOs supprimés`,
    });
  } catch (error) {
    const err = error as { message?: string; stack?: string };
    console.error("[ecos/delete-all] Error:", {
      message: err?.message,
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
