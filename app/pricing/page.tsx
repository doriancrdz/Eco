"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import PricingTopbar from "@/components/pricing/PricingTopbar";
import PricingToggle from "@/components/pricing/PricingToggle";
import PlanCard from "@/components/pricing/PlanCard";
import PackCard from "@/components/pricing/PackCard";
import PricingComparison from "@/components/pricing/PricingComparison";
import TrustLine from "@/components/pricing/TrustLine";
import AnnualChoiceModal, { type AnnualBillingChoice } from "@/components/pricing/AnnualChoiceModal";
import { PLANS, PACKS, PlanType } from "@/lib/billingConfig";
import { Mic, FileText, List, Percent } from "lucide-react";

// Skeletons légers pour les sections non critiques
function TestimonialsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
      {[1, 2].map((i) => (
        <div key={i} className="h-48 bg-white/40 rounded-3xl" />
      ))}
    </div>
  );
}

function FAQSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 bg-white/40 rounded-xl" />
      ))}
    </div>
  );
}

// Lazy load des composants non critiques
const PricingFAQ = dynamic(
  () => import("@/components/pricing/PricingFAQ"),
  {
    loading: () => <FAQSkeleton />,
    ssr: false,
  }
);

const TestimonialsMarquee = dynamic(
  () => import("@/components/pricing/TestimonialsMarquee"),
  {
    loading: () => <TestimonialsSkeleton />,
    ssr: false,
  }
);

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
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/pricing`);
      return;
    }

    // Empêcher de souscrire au plan déjà possédé (hors free)
    if (currentPlan !== "free" && planKey === currentPlan) {
      return;
    }
    if (isYearly && planKey !== "free") {
      try {
        setSelectedPlanForModal(planKey);
        setAnnualModalOpen(true);
      } catch (error) {
        setError("Impossible d'ouvrir le modal de sélection. Merci de réessayer.");
      }
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
    <div className="min-h-screen aura-gradient relative">
      {/* Overlay noise subtil pour la page pricing */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10">
        {/* Topbar */}
        <PricingTopbar />

        {/* Header */}
        <div className="pt-12 pb-12 px-4 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-gray-900 mb-6 tracking-tight">
            Choisis ton plan
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
            Transforme ta voix en connaissance structurée. Plans flexibles pour tous tes besoins.
          </p>

          {/* Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 max-w-3xl mx-auto">
            {[
              { icon: FileText, label: "Résumé structuré" },
              { icon: List, label: "Points clés / notions importantes" },
              { icon: Mic, label: "Transcription réelle" },
              { icon: Percent, label: "Économisez 17% en payant annuellement" },
            ].map((chip, idx) => {
              const Icon = chip.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 text-xs md:text-sm font-medium text-gray-700 hover:bg-white/70 hover:border-white/50 transition-all duration-200"
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{chip.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Toggle Mensuel/Annuel */}
        <div className="px-4">
          <PricingToggle isYearly={isYearly} onToggle={setIsYearly} />
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="max-w-4xl mx-auto px-4 mb-8">
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Plans */}
        <div className="max-w-7xl mx-auto px-4 mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-stretch">
            {plansEntries.map(([planKey, plan], index) => {
              const typedKey = planKey as PlanType;
              const isCurrentPlan = currentPlan !== "free" && typedKey === currentPlan;

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
                  isCurrentPlan={isCurrentPlan}
                />
              );
            })}
          </div>
        </div>

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

        {/* Comparaison rapide */}
        <div className="max-w-6xl mx-auto px-4 mb-16">
          <div className="mb-8 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-2">
              Comparaison rapide
            </h2>
            <p className="text-sm md:text-base text-gray-600">
              Tous les détails en un coup d&apos;œil
            </p>
          </div>
          <PricingComparison />
        </div>

        {/* Trust line */}
        <div className="max-w-5xl mx-auto px-4 mb-16">
          <TrustLine />
        </div>

        {/* Packs de minutes */}
        <div id="packs" className="max-w-6xl mx-auto px-4 mb-24 scroll-mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
              Packs de minutes supplémentaires
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Achetez un pack pour bénéficier de minutes supplémentaires.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
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
        </div>

        {/* Testimonials Marquee */}
        <div className="max-w-full mx-auto px-4 mb-24">
          <TestimonialsMarquee />
        </div>

        {/* FAQ */}
        <div className="max-w-6xl mx-auto px-4 pb-20">
          <PricingFAQ />
        </div>
      </div>
    </div>
  );
}
