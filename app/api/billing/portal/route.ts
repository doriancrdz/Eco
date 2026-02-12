export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStripeOrNull } from "@/lib/stripe";
import { getOrCreateUserWithQuota } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const stripe = getStripeOrNull();
  if (!stripe) return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });


  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await getOrCreateUserWithQuota(userId);

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "Aucun abonnement actif" },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${req.nextUrl.origin}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Erreur portal Stripe:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la création de la session du portail",
      },
      { status: 500 }
    );
  }
}
