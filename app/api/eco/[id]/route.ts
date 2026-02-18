export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/eco/[id]
 * Met à jour un ECO (title, folder)
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

    const body = await req.json();
    const { title, folder, folderId } = body;

    // Vérifier que l'ECO existe et appartient à l'utilisateur
    const eco = await prisma.eco.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!eco) {
      return NextResponse.json({ error: "ECO introuvable" }, { status: 404 });
    }

    // Mettre à jour uniquement les champs fournis
    const updateData: { title?: string; folderId?: string | null } = {};
    if (title !== undefined) {
      updateData.title = title;
    }
    // Support folderId (nouveau) ou folder (ancien pour compatibilité)
    const targetFolderId = folderId !== undefined ? folderId : folder;
    if (targetFolderId !== undefined) {
      // Si folderId est fourni et non null, vérifier qu'il existe et appartient à l'utilisateur
      if (targetFolderId && targetFolderId !== "") {
        const folderExists = await prisma.folder.findFirst({
          where: {
            id: targetFolderId,
            userId: user.id,
          },
        });
        if (!folderExists) {
          return NextResponse.json(
            { error: "Dossier introuvable" },
            { status: 404 }
          );
        }
      }
      updateData.folderId = targetFolderId || null;
    }

    const updatedEco = await prisma.eco.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        title: true,
        folderId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ eco: updatedEco });
  } catch (error) {
    console.error("[eco PATCH] Erreur:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/eco/[id]
 * Supprime un ECO
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

    // Vérifier que l'ECO existe et appartient à l'utilisateur
    const eco = await prisma.eco.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!eco) {
      return NextResponse.json({ error: "ECO introuvable" }, { status: 404 });
    }

    // Supprimer l'ECO (cascade gérée par Prisma)
    await prisma.eco.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[eco DELETE] Erreur:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}
