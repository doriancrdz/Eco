export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";

function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Upload audio vers R2. Évite le 413 (payload trop gros) en envoyant le fichier
 * directement à R2 au lieu de passer par le body de la requête Vercel.
 * Retourne fileId et optionnellement audioUrl (si R2_PUBLIC_URL configuré).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const s3 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    if (!s3 || !bucket) {
      return NextResponse.json(
        { error: "R2 non configuré", code: "R2_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile || !(audioFile instanceof File) || audioFile.size === 0) {
      return NextResponse.json({ error: "Aucun fichier audio" }, { status: 400 });
    }

    const fileId = crypto.randomUUID().replace(/-/g, "").slice(0, 21);
    const ext = audioFile.type?.includes("mp4") || audioFile.name?.endsWith(".mp4") ? "mp4" : "webm";
    const key = `${user.id}/${fileId}.${ext}`;

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: audioFile.type || "audio/webm",
      })
    );

    console.log("[upload-audio] Uploaded:", key, buffer.length, "bytes");

    const publicBase = process.env.R2_PUBLIC_URL;
    const audioUrl = publicBase ? `${publicBase.replace(/\/$/, "")}/${key}` : null;

    return NextResponse.json({ fileId, audioUrl, r2Key: key });
  } catch (error) {
    console.error("[upload-audio] Error:", error);
    return NextResponse.json(
      { error: "Échec de l’upload", code: "UPLOAD_FAILED" },
      { status: 500 }
    );
  }
}
