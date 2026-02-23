export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/ecos/[id]
 * Source de vérité pour l'affichage : transcriptionText + content (résumé JSON).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const dbStart = Date.now();
    const eco = await prisma.eco.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
      select: {
        id: true,
        userId: true,
        title: true,
        audioUrl: true,
        transcriptionText: true,
        content: true,
        folderId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const dbMs = Date.now() - dbStart;

    if (!eco) {
      return NextResponse.json({ error: "ECO introuvable" }, { status: 404 });
    }

    const recording = await prisma.recording.findUnique({
      where: { id: eco.id },
      select: { durationMs: true, durationSeconds: true },
    });
    const durationSeconds =
      recording?.durationMs != null ? recording.durationMs / 1000 : recording?.durationSeconds ?? null;

    const transcriptionLen = eco.transcriptionText?.length ?? 0;
    const contentLen = eco.content?.length ?? 0;
    const totalMs = Date.now() - t0;
    if (process.env.NODE_ENV === "development") {
      console.log(`[api/ecos/${params.id} GET] ms=${totalMs} auth=${authMs} user=${userMs} db=${dbMs}`, {
        id: eco.id,
        transcriptionLen,
        contentLen,
        hasTranscription: transcriptionLen > 0,
        hasContent: contentLen > 0,
        updatedAt: eco.updatedAt.toISOString(),
      });
    }

    const formattedEco = {
      id: eco.id,
      title: eco.title,
      audio_url: eco.audioUrl || "",
      transcription_text: eco.transcriptionText || "",
      summary_text: eco.content || null,
      folder: eco.folderId || "",
      created_at: eco.createdAt.toISOString(),
      duration_seconds: durationSeconds,
    };

    return NextResponse.json({ eco: formattedEco });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[ecos GET] Erreur:", error);
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
 * PATCH /api/ecos/[id]
 * Met à jour un ECO (title, folder, summary_text, transcription_text)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const t0 = Date.now();
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
    const { title, folder, folderId, summary_text, transcription_text, archived } = body;

    const eco = await prisma.eco.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!eco) {
      return NextResponse.json({ error: "ECO introuvable" }, { status: 404 });
    }

    const updateData: {
      title?: string;
      folderId?: string | null;
      content?: string | null;
      transcriptionText?: string | null;
      archived?: boolean;
    } = {};
    if (title !== undefined) updateData.title = title;
    if (archived !== undefined) updateData.archived = Boolean(archived);
    if (summary_text !== undefined) updateData.content = summary_text || null;
    if (transcription_text !== undefined) updateData.transcriptionText = transcription_text || null;
    const targetFolderId = folderId !== undefined ? folderId : folder;
    if (targetFolderId !== undefined) {
      const finalFolderId = targetFolderId === null || targetFolderId === "" ? null : targetFolderId;
      if (finalFolderId) {
        const folderExists = await prisma.folder.findFirst({
          where: { id: finalFolderId, userId: user.id },
        });
        if (!folderExists) {
          return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
        }
      }
      updateData.folderId = finalFolderId ?? null;
    }

    const updatedEco = await prisma.eco.update({
      where: { id: params.id },
      data: updateData,
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

    const recording = await prisma.recording.findUnique({
      where: { id: updatedEco.id },
      select: { durationMs: true, durationSeconds: true },
    });
    const durationSeconds =
      recording?.durationMs != null ? recording.durationMs / 1000 : recording?.durationSeconds ?? null;

    const formattedEco = {
      id: updatedEco.id,
      title: updatedEco.title,
      audio_url: updatedEco.audioUrl || "",
      transcription_text: updatedEco.transcriptionText || "",
      summary_text: updatedEco.content || null,
      folder: updatedEco.folderId || "",
      created_at: updatedEco.createdAt.toISOString(),
      duration_seconds: durationSeconds,
    };
    if (process.env.NODE_ENV === "development") {
      console.log(`[api/ecos/${params.id} PATCH] ms=${Date.now() - t0}`);
    }
    return NextResponse.json({ eco: formattedEco });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[ecos PATCH] Erreur:", error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ecos/[id]
 */
export async function DELETE(
  _req: NextRequest,
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
    const eco = await prisma.eco.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!eco) {
      return NextResponse.json({ error: "ECO introuvable" }, { status: 404 });
    }
    const ecoId = params.id;
    await prisma.eco.delete({ where: { id: ecoId } });
    await prisma.recording.deleteMany({ where: { id: ecoId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[ecos DELETE] Erreur:", error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue." },
      { status: 500 }
    );
  }
}
