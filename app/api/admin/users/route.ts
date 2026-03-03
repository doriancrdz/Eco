import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "cdorian654@yahoo.com";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId);

    if (clerkUser.primaryEmailAddress?.emailAddress !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const dbUsers = await prisma.user.findMany({
      select: {
        id: true,
        clerkUserId: true,
        plan: true,
        quotaSecondsTotal: true,
        quotaSecondsUsed: true,
        quotaExtraSeconds: true,
        bonusSeconds: true,
        currentPeriodEnd: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const clientInstance = await clerkClient();

    const users = await Promise.all(
      dbUsers.map(async (u) => {
        try {
          const cu = await clientInstance.users.getUser(u.clerkUserId);

          const email = cu.primaryEmailAddress?.emailAddress ?? "";
          const firstName = cu.firstName ?? null;
          const lastName = cu.lastName ?? null;

          const minutesIncluded = Math.floor(u.quotaSecondsTotal / 60);
          const minutesUsed = Math.ceil(u.quotaSecondsUsed / 60);
          const bonusMinutes = Math.ceil(u.bonusSeconds / 60);

          return {
            id: u.id,
            email,
            firstName,
            lastName,
            plan: u.plan,
            minutesIncluded,
            minutesUsed,
            bonusMinutes,
            currentPeriodEnd: u.currentPeriodEnd
              ? u.currentPeriodEnd.toISOString()
              : null,
            createdAt: u.createdAt.toISOString(),
          };
        } catch (error) {
          console.error("[admin/users] Clerk user fetch error:", error);

          const minutesIncluded = Math.floor(u.quotaSecondsTotal / 60);
          const minutesUsed = Math.ceil(u.quotaSecondsUsed / 60);
          const bonusMinutes = Math.ceil(u.bonusSeconds / 60);

          return {
            id: u.id,
            email: "",
            firstName: null,
            lastName: null,
            plan: u.plan,
            minutesIncluded,
            minutesUsed,
            bonusMinutes,
            currentPeriodEnd: u.currentPeriodEnd
              ? u.currentPeriodEnd.toISOString()
              : null,
            createdAt: u.createdAt.toISOString(),
          };
        }
      })
    );

    return NextResponse.json({ users });
  } catch (error) {
    console.error("[admin/users] Error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

