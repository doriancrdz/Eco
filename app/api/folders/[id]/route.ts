export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_FOLDER_NAMES = ["Travail", "Études", "Personnel"];

/**
 * PATCH /api/folders/[id]
 * Renomme un dossier
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Vérifier que le dossier existe et appartient à l'utilisateur
    const folder = await prisma.folder.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Le nom du dossier est requis" },
        { status: 400 }
      );
    }

    const updatedFolder = await prisma.folder.update({
      where: { id: params.id },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updatedFolder);
  } catch (error) {
    console.error("[folders PATCH] Erreur:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/folders/[id]
 * Supprime un dossier et déplace ses ECOs vers folderId = null
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Vérifier que le dossier existe et appartient à l'utilisateur
    const folder = await prisma.folder.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    // Empêcher la suppression des dossiers par défaut
    if (folder.isDefault || DEFAULT_FOLDER_NAMES.includes(folder.name)) {
      return NextResponse.json(
        { error: "Impossible de supprimer un dossier par défaut" },
        { status: 400 }
      );
    }

    // Transaction : déplacer les ECOs vers folderId = null puis supprimer le dossier
    await prisma.$transaction(async (tx) => {
      // Déplacer tous les ECOs du dossier vers folderId = null
      await tx.eco.updateMany({
        where: {
          folderId: params.id,
          userId: user.id,
        },
        data: {
          folderId: null,
        },
      });

      // Supprimer le dossier
      await tx.folder.delete({
        where: { id: params.id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[folders DELETE] Erreur:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}
