import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH() {
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

    // Archiver tous les ECOs de l'utilisateur
    const result = await prisma.eco.updateMany({
      where: {
        userId: user.id,
        archived: false,
      },
      data: {
        archived: true,
      },
    });

    return NextResponse.json({
      count: result.count,
      message: `${result.count} ECOs archivés`,
    });
  } catch (error) {
    console.error("Erreur lors de l'archivage:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de l'archivage des ECOs",
      },
      { status: 500 }
    );
  }
}
