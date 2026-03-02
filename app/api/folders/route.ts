export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_FOLDER_NAMES = ["Travail", "Études", "Personnel"];

/**
 * GET /api/folders
 * Récupère la liste des dossiers de l'utilisateur
 * Crée automatiquement les dossiers par défaut s'ils manquent
 */
export async function GET(req: NextRequest) {
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

    // Récupérer les dossiers existants
    const existingFolders = await prisma.folder.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        isDefault: true,
        createdAt: true,
      },
    });

    // Créer les dossiers par défaut manquants (case-insensitive)
    const existingNames = existingFolders.map((f) => f.name.toLowerCase());
    const foldersToCreate = DEFAULT_FOLDER_NAMES.filter(
      (name) => !existingNames.includes(name.toLowerCase())
    );

    if (foldersToCreate.length > 0) {
      await prisma.folder.createMany({
        data: foldersToCreate.map((name) => ({
          userId: user.id,
          name,
          isDefault: true,
        })),
        skipDuplicates: true,
      });
    }

    // Récupérer la liste finale (avec les nouveaux dossiers créés)
    const allFolders = await prisma.folder.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        isDefault: true,
        createdAt: true,
      },
      orderBy: [
        { isDefault: "desc" }, // Dossiers par défaut en premier
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json({ folders: allFolders });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[folders GET] Erreur:", error);
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/folders
 * Crée un nouveau dossier
 */
export async function POST(req: NextRequest) {
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
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Le nom du dossier est requis" },
        { status: 400 }
      );
    }

    const folder = await prisma.folder.create({
      data: {
        userId: user.id,
        name: name.trim(),
        isDefault: false,
      },
      select: {
        id: true,
        name: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return NextResponse.json(folder);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[folders POST] Erreur:", error);
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}
