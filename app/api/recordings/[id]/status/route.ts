import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recording = await prisma.recording.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      status: true,
      summaryJson: true,
      transcriptionText: true,
      errorMessage: true,
    },
  });

  if (!recording) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let summary:
    | {
        titre: string;
        resume: string;
        pointsCles: string[];
        notions: unknown;
      }
    | null = null;

  if (recording.summaryJson) {
    try {
      summary = JSON.parse(recording.summaryJson);
    } catch {
      summary = null;
    }
  }

  return NextResponse.json({
    status: recording.status,
    summary,
    transcription: recording.transcriptionText,
    error: recording.errorMessage ?? null,
  });
}

