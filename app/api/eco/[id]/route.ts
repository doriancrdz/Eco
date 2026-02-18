export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/eco/[id]
 * Récupère un ECO par ID
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

    const formattedEco = {
      id: eco.id,
      title: eco.title,
      audio_url: eco.audioUrl || "",
      transcription_text: eco.transcriptionText || "",
      summary_text: eco.content || null,
      folder: eco.folderId || "",
      created_at: eco.createdAt.toISOString(),
    };

    const totalMs = Date.now() - t0;
    console.log(`[api/eco/${params.id} GET] ms=${totalMs} auth=${authMs} user=${userMs} db=${dbMs}`, {
      id: eco.id,
      hasTranscription: !!eco.transcriptionText && eco.transcriptionText.length > 0,
      transcriptionLength: eco.transcriptionText?.length || 0,
      hasSummary: !!eco.content,
      summaryLength: eco.content?.length || 0,
      updatedAt: eco.updatedAt.toISOString(),
    });

    return NextResponse.json({ eco: formattedEco });
  } catch (error) {
    console.error("[eco GET] Erreur:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Une erreur est survenue.",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/eco/[id]
 * Met à jour un ECO (title, folder)
 */
export async function PATCH(
  req: NextRequest,
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

    const bodyStart = Date.now();
    const body = await req.json();
    const bodyMs = Date.now() - bodyStart;
    const { title, folder, folderId, summary_text, transcription_text } = body;

    // Vérifier que l'ECO existe et appartient à l'utilisateur
    const checkStart = Date.now();
    const eco = await prisma.eco.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });
    const checkMs = Date.now() - checkStart;

    if (!eco) {
      return NextResponse.json({ error: "ECO introuvable" }, { status: 404 });
    }

    const updateData: { title?: string; folderId?: string | null; content?: string | null; transcriptionText?: string | null } = {};
    if (title !== undefined) {
      updateData.title = title;
    }
    if (summary_text !== undefined) {
      updateData.content = summary_text || null;
    }
    if (transcription_text !== undefined) {
      updateData.transcriptionText = transcription_text || null;
    }
    // folderId prioritaire (frontend envoie { folderId }), sinon folder pour compatibilité
    const targetFolderId = folderId !== undefined ? folderId : folder;
    if (targetFolderId !== undefined) {
      const finalFolderId = targetFolderId === null || targetFolderId === "" ? null : targetFolderId;
      if (finalFolderId) {
        const folderExists = await prisma.folder.findFirst({
          where: { id: finalFolderId, userId: user.id },
        });
        if (!folderExists) {
          return NextResponse.json(
            { error: "Dossier introuvable" },
            { status: 404 }
          );
        }
      }
      updateData.folderId = finalFolderId ?? null;
    }

    const updateStart = Date.now();
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
    const updateMs = Date.now() - updateStart;

    const formattedEco = {
      id: updatedEco.id,
      title: updatedEco.title,
      audio_url: updatedEco.audioUrl || "",
      transcription_text: updatedEco.transcriptionText || "",
      summary_text: updatedEco.content || null,
      folder: updatedEco.folderId || "",
      created_at: updatedEco.createdAt.toISOString(),
    };
    
    const totalMs = Date.now() - t0;
    console.log(`[api/eco/${params.id} PATCH] ms=${totalMs} auth=${authMs} user=${userMs} body=${bodyMs} check=${checkMs} update=${updateMs}`);
    
    return NextResponse.json({ eco: formattedEco });
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
