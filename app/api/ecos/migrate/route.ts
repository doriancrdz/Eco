export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/ecos/migrate
 * Migre les ECOs de localStorage vers la DB (une seule fois)
 * À appeler depuis le client au chargement si nécessaire
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
    const { ecos } = body; // Array d'ECOs depuis localStorage

    if (!Array.isArray(ecos)) {
      return NextResponse.json(
        { error: "ecos doit être un tableau" },
        { status: 400 }
      );
    }

    const migrated: string[] = [];
    const errors: string[] = [];

    for (const eco of ecos) {
      try {
        // Vérifier si le dossier existe
        let folderId: string | null = null;
        if (eco.folder && eco.folder !== "") {
          const folderExists = await prisma.folder.findFirst({
            where: {
              id: eco.folder,
              userId: user.id,
            },
          });
          if (folderExists) {
            folderId = eco.folder;
          }
        }

        await prisma.eco.upsert({
          where: { id: eco.id },
          update: {
            title: eco.title,
            audioUrl: eco.audio_url || null,
            transcriptionText: eco.transcription_text || null,
            content: eco.summary_text || null,
            folderId,
          },
          create: {
            id: eco.id,
            userId: user.id,
            title: eco.title,
            audioUrl: eco.audio_url || null,
            transcriptionText: eco.transcription_text || null,
            content: eco.summary_text || null,
            folderId,
          },
        });
        migrated.push(eco.id);
      } catch (error) {
        console.error(`Erreur migration ECO ${eco.id}:`, error);
        errors.push(eco.id);
      }
    }

    return NextResponse.json({
      migrated: migrated.length,
      errors: errors.length,
      migratedIds: migrated,
      errorIds: errors,
    });
  } catch (error) {
    console.error("[ecos/migrate] Erreur:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}
