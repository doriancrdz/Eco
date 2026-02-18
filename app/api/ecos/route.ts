export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/ecos?folderId=...
 * Récupère la liste des ECOs de l'utilisateur, optionnellement filtrés par folderId
 * Si folderId est null ou absent : retourne les ECOs sans dossier (folderId IS NULL)
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

    const searchParams = req.nextUrl.searchParams;
    const folderId = searchParams.get("folderId");

    const where: any = {
      userId: user.id,
      archived: false,
    };

    // Logique de filtrage :
    // - Si folderId est absent ou null → retourner TOUS les ECOs (pas de filtre)
    // - Si folderId est "null" (string explicite) → retourner uniquement les ECOs sans dossier
    // - Si folderId est un ID → retourner les ECOs de ce dossier
    if (folderId !== null && folderId !== undefined) {
      if (folderId === "null" || folderId === "") {
        // Cas explicite : uniquement les ECOs sans dossier
        where.folderId = null;
      } else {
        // Cas : filtrer par dossier spécifique
        where.folderId = folderId;
      }
    }
    // Si folderId est null/undefined → pas de filtre folderId (retourne tous les ECOs)

    const ecos = await prisma.eco.findMany({
      where,
      select: {
        id: true,
        title: true,
        audioUrl: true,
        transcriptionText: true,
        content: true,
        folderId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Transformer pour correspondre au format attendu par le frontend
    const formattedEcos = ecos.map((eco) => ({
      id: eco.id,
      title: eco.title,
      audio_url: eco.audioUrl || "",
      transcription_text: eco.transcriptionText || "",
      summary_text: eco.content || null, // Utiliser content pour summary_text
      folder: eco.folderId || "",
      created_at: eco.createdAt.toISOString(),
    }));

    return NextResponse.json({ ecos: formattedEcos });
  } catch (error) {
    console.error("[ecos GET] Erreur:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}
