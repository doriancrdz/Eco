export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    // Enrichir avec les métadonnées Recording (durée, source, PDF) — 1 seule requête IN
    const ecoIds = ecos.map((e) => e.id);
    const recordings = ecoIds.length > 0
      ? await prisma.recording.findMany({
          where: { id: { in: ecoIds } },
          select: { id: true, durationMs: true, durationSeconds: true, sourceType: true, pdfContext: true },
        })
      : [];
    const recordingMap = new Map(recordings.map((r) => [r.id, r]));

    // Transformer pour correspondre au format attendu par le frontend
    const formattedEcos = ecos.map((eco) => {
      const rec = recordingMap.get(eco.id);
      const durationSeconds = rec?.durationMs != null
        ? rec.durationMs / 1000
        : (rec?.durationSeconds ?? null);
      return {
        id: eco.id,
        title: eco.title,
        audio_url: eco.audioUrl || "",
        transcription_text: eco.transcriptionText || "",
        summary_text: eco.content || null,
        folder: eco.folderId || "",
        created_at: eco.createdAt.toISOString(),
        duration_seconds: durationSeconds,
        source_type: (rec?.sourceType ?? "mic") as "mic" | "screen",
        has_pdf_context: rec?.pdfContext != null && rec.pdfContext.length > 0,
      };
    });

    const totalMs = Date.now() - t0;
    console.log(`[api/ecos GET] ms=${totalMs} auth=${authMs} user=${userMs} db=${dbMs} count=${ecos.length}`);

    return NextResponse.json({ ecos: formattedEcos });
  } catch (error) {
    const err = error as { message?: string; stack?: string };
    console.error("[ecos] GET Error:", {
      message: err?.message,
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
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

    // En update: ne pas écraser transcriptionText/content avec vide si déjà remplis (sync Recording -> Eco peut avoir déjà eu lieu)
    const existing = await prisma.eco.findUnique({ where: { id }, select: { transcriptionText: true, content: true } });
    const updateData: {
      title: string;
      audioUrl: string | null;
      transcriptionText?: string | null;
      content?: string | null;
      folderId: string | null;
    } = {
      title,
      audioUrl: audio_url || null,
      folderId,
    };
    if (existing) {
      if (transcription_text !== undefined)
        updateData.transcriptionText = (transcription_text && transcription_text.length > 0) ? transcription_text : (existing.transcriptionText ?? null);
      if (summary_text !== undefined)
        updateData.content = (summary_text != null && summary_text !== "") ? summary_text : (existing.content ?? null);
    } else {
      updateData.transcriptionText = transcription_text || null;
      updateData.content = summary_text || null;
    }

    const eco = await prisma.eco.upsert({
      where: { id },
      update: updateData,
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
    const err = error as { message?: string; stack?: string };
    console.error("[ecos] POST Error:", {
      message: err?.message,
      stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
