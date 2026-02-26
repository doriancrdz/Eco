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
    const err = error as { message?: string; stack?: string };
    console.error("[ecos/archive-all] Error:", {
      message: err?.message,
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
