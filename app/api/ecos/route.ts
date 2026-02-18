export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/ecos?folderId=...
 * Récupère la liste des ECOs de l'utilisateur, optionnellement filtrés par folderId
 * Si folderId est absent → retourne TOUS les ECOs récents (30 derniers)
 * Si folderId est "null" → retourne uniquement les ECOs sans dossier
 * Si folderId est un ID → retourne les ECOs de ce dossier
 */
export async function GET(req: NextRequest) {
  const t0 = Date.now();
  try {
    const authStart = Date.now();
    const { userId } = await auth();
    const authMs = Date.now() - authStart;
    
    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userStart = Date.now();
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });
    const userMs = Date.now() - userStart;

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const folderId = searchParams.get("folderId");
    const limitParam = searchParams.get("limit");
    const take = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 30;

    const where: any = {
      userId: user.id,
      archived: false,
    };

    // Logique de filtrage :
    // - Si folderId est absent ou null → retourner TOUS les ECOs (pas de filtre folderId)
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

    const dbStart = Date.now();
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
      take,
    });
    const dbMs = Date.now() - dbStart;

    // Transformer pour correspondre au format attendu par le frontend
    const formattedEcos = ecos.map((eco) => ({
      id: eco.id,
      title: eco.title,
      audio_url: eco.audioUrl || "",
      transcription_text: eco.transcriptionText || "",
      summary_text: eco.content || null,
      folder: eco.folderId || "",
      created_at: eco.createdAt.toISOString(),
    }));

    const totalMs = Date.now() - t0;
    console.log(`[api/ecos GET] ms=${totalMs} auth=${authMs} user=${userMs} db=${dbMs} count=${ecos.length}`);

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

/**
 * POST /api/ecos
 * Crée un nouvel ECO en DB
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
    const { id, title, audio_url, transcription_text, summary_text, folder } = body;

    if (!id || !title) {
      return NextResponse.json(
        { error: "ID et titre sont requis" },
        { status: 400 }
      );
    }

    // Vérifier si le dossier existe si folderId est fourni
    let folderId: string | null = null;
    if (folder && folder !== "") {
      const folderExists = await prisma.folder.findFirst({
        where: {
          id: folder,
          userId: user.id,
        },
      });
      if (folderExists) {
        folderId = folder;
      }
    }

    const eco = await prisma.eco.upsert({
      where: { id },
      update: {
        title,
        audioUrl: audio_url || null,
        transcriptionText: transcription_text || null,
        content: summary_text || null,
        folderId,
      },
      create: {
        id,
        userId: user.id,
        title,
        audioUrl: audio_url || null,
        transcriptionText: transcription_text || null,
        content: summary_text || null,
        folderId,
      },
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
    });

    // Transformer pour correspondre au format attendu par le frontend
    const formattedEco = {
      id: eco.id,
      title: eco.title,
      audio_url: eco.audioUrl || "",
      transcription_text: eco.transcriptionText || "",
      summary_text: eco.content || null,
      folder: eco.folderId || "",
      created_at: eco.createdAt.toISOString(),
    };

    return NextResponse.json({ eco: formattedEco });
  } catch (error) {
    console.error("[ecos POST] Erreur:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}
