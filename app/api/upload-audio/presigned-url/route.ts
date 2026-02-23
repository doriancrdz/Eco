export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/prisma";
import { uploadLimiter } from "@/lib/ratelimit";

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
 * Génère une URL présignée pour upload direct navigateur → R2.
 * Évite la limite 4.5MB Vercel : le fichier ne passe jamais par notre serveur.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { success, limit, remaining, reset } = await uploadLimiter.limit(userId);
    if (!success) {
      return NextResponse.json(
        { error: "Trop d'uploads. Réessayez dans 1 minute." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": reset.toString(),
          },
        }
      );
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

    const body = await request.json().catch(() => ({}));
    const contentType = (body.contentType as string) || "audio/webm";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;

    const fileId = crypto.randomUUID().replace(/-/g, "").slice(0, 21);
    const extension = contentType.includes("mp4") ? "mp4" : "webm";
    const r2Key = `${user.id}/${fileId}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

    if (process.env.NODE_ENV === "development") {
      console.log("[presigned-url] Generated", {
        fileId,
        r2Key,
        contentType,
        fileSizeBytes: fileSize,
        fileSizeMB: fileSize ? (fileSize / 1024 / 1024).toFixed(2) : "—",
      });
    }

    return NextResponse.json(
      { presignedUrl, fileId, r2Key },
      {
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    );
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[presigned-url] Error:", error);
    }
    return NextResponse.json(
      { error: "Impossible de générer l’URL d’upload", code: "PRESIGN_FAILED" },
      { status: 500 }
    );
  }
}
