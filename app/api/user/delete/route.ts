import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "Utilisateur introuvable en base" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.usageEvent.deleteMany({ where: { userId: dbUser.id } });
      await tx.eco.deleteMany({ where: { userId: dbUser.id } });
      await tx.recording.deleteMany({ where: { userId: dbUser.id } });
      await tx.folder.deleteMany({ where: { userId: dbUser.id } });
      await tx.transaction.deleteMany({ where: { userId: dbUser.id } });
      await tx.user.delete({ where: { id: dbUser.id } });
    });

    const client = await clerkClient();
    await client.users.deleteUser(clerkUserId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[user/delete] Error:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
