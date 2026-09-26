"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/marketing/SiteHeader";
import SiteFooter from "@/components/marketing/SiteFooter";
import PricingToggle from "@/components/pricing/PricingToggle";
import PlanCard from "@/components/pricing/PlanCard";
import PackCard from "@/components/pricing/PackCard";
import PricingComparison from "@/components/pricing/PricingComparison";
import TrustLine from "@/components/pricing/TrustLine";
import PricingFAQ from "@/components/pricing/PricingFAQ";
import TestimonialsMarquee from "@/components/pricing/TestimonialsMarquee";
import AnnualChoiceModal, { type AnnualBillingChoice } from "@/components/pricing/AnnualChoiceModal";
import { PLANS, PACKS, PlanType } from "@/lib/billingConfig";

type BillingData = {
  plan: PlanType;
};

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [annualModalOpen, setAnnualModalOpen] = useState(false);
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<PlanType | null>(null);
  const [billingData, setBillingData] = useState<BillingData | null>(null);

  // Mémoriser les plans et packs pour éviter les recalculs
  const plansEntries = useMemo(() => Object.entries(PLANS), []);
  const packsArray = useMemo(() => PACKS, []);

  useEffect(() => {
    // Masquer l'erreur après 5 secondes
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Charger le plan actuel de l'utilisateur
  useEffect(() => {
    if (!isSignedIn) {
      setBillingData(null);
      return;
    }

    let cancelled = false;

    const fetchBilling = async () => {
      try {
        const res = await fetch("/api/billing/me", { cache: "no-store" });
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            console.error("[pricing] /api/billing/me non OK:", res.status);
          }
          return;
        }
        const data = await res.json();
        if (!cancelled && data?.plan) {
          setBillingData({ plan: data.plan as PlanType });
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("[pricing] Erreur chargement billing:", err);
        }
      }
    };

    fetchBilling();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const currentPlan: PlanType = billingData?.plan ?? "free";

  const doCheckout = async (planKey: PlanType, billingMode?: AnnualBillingChoice) => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/pricing`);
      return;
    }

    setLoadingPlan(planKey);
    setError(null);

    try {
      const body: Record<string, string> = {
        type: "subscription",
        plan: planKey,
        period: isYearly ? "yearly" : "monthly",
      };
      if (isYearly && billingMode) {
        body.billingMode = billingMode;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la création de la session de paiement");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Une erreur est survenue. Merci de réessayer.";
      
      if (message.includes("PRICE_ID") || message.includes("Stripe")) {
        setError(
          "Configuration de paiement en cours. Contacte le support ou réessaie plus tard."
        );
      } else {
        setError(message);
      }
    } finally {
      setLoadingPlan(null);
    }
  };

  const handlePlanSelect = (planKey: PlanType) => {
    if (planKey === "free") {
      router.push(isSignedIn ? "/app" : "/sign-up");
      return;
    }
    if (!isSignedIn) {
      router.push(`/sign-up?redirect_url=/pricing`);
      return;
    }

    // Empêcher de souscrire au plan déjà possédé (hors free)
    if (currentPlan !== "free" && planKey === currentPlan) {
      return;
    }
    if (isYearly) {
      setSelectedPlanForModal(planKey);
      setAnnualModalOpen(true);
      return;
    }
    doCheckout(planKey);
  };

  const handleAnnualChoice = async (choice: AnnualBillingChoice) => {
    if (!selectedPlanForModal) {
      setError("Plan non sélectionné");
      setAnnualModalOpen(false);
      setSelectedPlanForModal(null);
      return;
    }
    setAnnualModalOpen(false);
    setSelectedPlanForModal(null);
    await doCheckout(selectedPlanForModal, choice);
  };

  const handlePackSelect = async (packIndex: number) => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/pricing`);
      return;
    }

    setLoadingPack(packIndex);
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pack",
          packIndex,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la création de la session de paiement");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Une erreur est survenue. Merci de réessayer.";
      
      if (message.includes("PRICE_ID") || message.includes("Stripe")) {
        setError(
          "Configuration de paiement en cours. Contacte le support ou réessaie plus tard."
        );
      } else {
        setError(message);
      }
    } finally {
      setLoadingPack(null);
    }
  };

  return (
    <div className="mk min-h-screen">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden px-5 pt-32 sm:px-8 sm:pt-40">
          <div className="mk-grain" aria-hidden />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mk-rise mk-eyebrow">Tarifs</p>
            <h1 className="mk-display mk-rise mt-6 text-[48px] sm:text-[72px]" style={{ animationDelay: "80ms" }}>
              Moins cher qu&apos;un
              <br />
              <span className="italic" style={{ color: "var(--mk-muted)" }}>
                cours particulier.
              </span>
            </h1>
            <p className="mk-rise mx-auto mt-6 max-w-xl text-[17px] leading-relaxed" style={{ color: "var(--mk-muted)", animationDelay: "160ms" }}>
              10 minutes offertes chaque mois pour tout tester, sans carte bancaire. Student couvre un semestre classique. Pro ajoute de quoi réviser une matière entière avant les partiels.
            </p>
          </div>
          <div className="mk-rise relative mt-10" style={{ animationDelay: "220ms" }}>
            <PricingToggle isYearly={isYearly} onToggle={setIsYearly} />
          </div>
        </section>

        {error && (
          <div className="mx-auto mt-8 max-w-4xl px-5" role="alert">
            <div className="rounded-xl border px-4 py-3 text-[14px]" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.25)", color: "#FCD34D" }}>
              {error}
            </div>
          </div>
        )}

        <section className="mx-auto mt-12 max-w-6xl px-5 sm:px-8" aria-label="Plans">
          <div className="grid items-stretch gap-5 md:grid-cols-2 lg:grid-cols-4">
            {plansEntries.map(([planKey, plan], index) => {
              const typedKey = planKey as PlanType;
              return (
                <PlanCard
                  key={planKey}
                  plan={plan}
                  planKey={planKey}
                  isYearly={isYearly}
                  isMostPopular={planKey === "student"}
                  onSelect={() => handlePlanSelect(typedKey)}
                  isLoading={loadingPlan === planKey}
                  index={index}
                  isCurrentPlan={currentPlan !== "free" && typedKey === currentPlan}
                />
              );
            })}
          </div>
        </section>

        <AnnualChoiceModal
          isOpen={annualModalOpen}
          onClose={() => {
            setAnnualModalOpen(false);
            setSelectedPlanForModal(null);
          }}
          planName={selectedPlanForModal ? PLANS[selectedPlanForModal].name : ""}
          planKey={selectedPlanForModal ?? ""}
          priceYearly={selectedPlanForModal ? PLANS[selectedPlanForModal].priceYearly : 0}
          priceAnnualCommitMonthly={selectedPlanForModal ? PLANS[selectedPlanForModal].priceAnnualCommitMonthly : 0}
          onChoose={handleAnnualChoice}
          isLoading={!!loadingPlan}
        />

        <section className="mx-auto mt-6 max-w-6xl space-y-6 px-5 sm:px-8">
          <PricingComparison />
          <TrustLine />
        </section>

        <section id="packs" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-32 sm:px-8">
          <div className="max-w-2xl">
            <p className="mk-eyebrow">Packs de minutes</p>
            <h2 className="mk-display mt-5 text-[42px] sm:text-[52px]">
              Un partiel qui approche ?
              <br />
              <span className="italic" style={{ color: "var(--mk-muted)" }}>
                Ajoute des minutes.
              </span>
            </h2>
            <p className="mt-5 text-[16px]" style={{ color: "var(--mk-muted)" }}>
              Des minutes en plus, sans changer d&apos;abonnement. Elles s&apos;ajoutent immédiatement à ton compteur et n&apos;expirent jamais.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {packsArray.map((pack, index) => (
              <PackCard
                key={index}
                name={pack.name}
                minutes={pack.minutes}
                price={pack.price}
                onSelect={() => handlePackSelect(index)}
                isLoading={loadingPack === index}
              />
            ))}
          </div>
        </section>

        <section className="pt-32">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <p className="mk-eyebrow">Avis</p>
            <h2 className="mk-display mt-5 text-[42px] sm:text-[52px]">Ce qu&apos;en disent les utilisateurs</h2>
          </div>
          <div className="mt-12">
            <TestimonialsMarquee />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-32 pt-32 sm:px-8">
          <PricingFAQ />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
