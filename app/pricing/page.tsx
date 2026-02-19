"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import PricingTopbar from "@/components/pricing/PricingTopbar";
import PricingToggle from "@/components/pricing/PricingToggle";
import PlanCard from "@/components/pricing/PlanCard";
import PackCard from "@/components/pricing/PackCard";
import PricingComparison from "@/components/pricing/PricingComparison";
import TrustLine from "@/components/pricing/TrustLine";
import PricingFAQ from "@/components/pricing/PricingFAQ";
import TestimonialsMarquee from "@/components/pricing/TestimonialsMarquee";
import AnnualChoiceModal, { type AnnualBillingChoice } from "@/components/pricing/AnnualChoiceModal";
import { PLANS, PACKS, PlanType } from "@/lib/billingConfig";
import { Mic, FileText, Clock, Calendar } from "lucide-react";

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [annualModalOpen, setAnnualModalOpen] = useState(false);
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<PlanType | null>(null);

  useEffect(() => {
    // Masquer l'erreur après 5 secondes
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

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
          : "Une erreur est survenue. Veuillez réessayer.";
      
      if (message.includes("PRICE_ID") || message.includes("Stripe")) {
        setError(
          "Configuration de paiement en cours. Veuillez contacter le support ou réessayer plus tard."
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
    if (isYearly && planKey !== "free") {
      setSelectedPlanForModal(planKey);
      setAnnualModalOpen(true);
      return;
    }
    doCheckout(planKey);
  };

  const handleAnnualChoice = (choice: AnnualBillingChoice) => {
    if (!selectedPlanForModal) return;
    doCheckout(selectedPlanForModal, choice);
    setAnnualModalOpen(false);
    setSelectedPlanForModal(null);
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
          : "Une erreur est survenue. Veuillez réessayer.";
      
      if (message.includes("PRICE_ID") || message.includes("Stripe")) {
        setError(
          "Configuration de paiement en cours. Veuillez contacter le support ou réessayer plus tard."
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
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold text-gray-900 mb-6 tracking-tight"
          >
            Choisissez votre plan
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-lg md:text-xl lg:text-2xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8"
          >
            Transformez votre voix en connaissance structurée. Plans flexibles pour tous vos besoins.
          </motion.p>

          {/* Chips */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-2 md:gap-3 max-w-3xl mx-auto"
          >
            {[
              { icon: Mic, label: "Transcription réelle" },
              { icon: FileText, label: "Résumé structuré" },
              { icon: Clock, label: "30 min / Eco" },
              { icon: Calendar, label: "Reset le 1er du mois" },
            ].map((chip, idx) => {
              const Icon = chip.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + idx * 0.05, duration: 0.25 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 text-xs md:text-sm font-medium text-gray-700 hover:bg-white/70 hover:border-white/50 transition-all duration-200"
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{chip.label}</span>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Toggle Mensuel/Annuel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="px-4"
        >
          <PricingToggle isYearly={isYearly} onToggle={setIsYearly} />
        </motion.div>

        {/* Message d'erreur */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-4xl mx-auto px-4 mb-8"
          >
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          </motion.div>
        )}

        {/* Plans */}
        <div className="max-w-7xl mx-auto px-4 mb-16">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.05,
                  delayChildren: 0.2,
                },
              },
            }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8"
          >
            {Object.entries(PLANS).map(([planKey, plan], index) => (
              <PlanCard
                key={planKey}
                plan={plan}
                planKey={planKey}
                isYearly={isYearly}
                isMostPopular={planKey === "pro"}
                onSelect={() => handlePlanSelect(planKey as PlanType)}
                isLoading={loadingPlan === planKey}
                index={index}
              />
            ))}
          </motion.div>
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="mb-8 text-center"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-2">
              Comparaison rapide
            </h2>
            <p className="text-sm md:text-base text-gray-600">
              Tous les détails en un coup d&apos;œil
            </p>
          </motion.div>
          <PricingComparison />
        </div>

        {/* Trust line */}
        <div className="max-w-5xl mx-auto px-4 mb-16">
          <TrustLine />
        </div>

        {/* Packs de minutes */}
        <div id="packs" className="max-w-6xl mx-auto px-4 mb-24 scroll-mt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
              Packs de minutes supplémentaires
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Besoin de plus de minutes ce mois-ci ? Achetez un pack valable pour le mois en cours.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.05,
                  delayChildren: 0.4,
                },
              },
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
          >
            {PACKS.map((pack, index) => (
              <PackCard
                key={index}
                name={pack.name}
                minutes={pack.minutes}
                price={pack.price}
                onSelect={() => handlePackSelect(index)}
                isLoading={loadingPack === index}
                index={index}
              />
            ))}
          </motion.div>
        </div>

        {/* Testimonials Marquee */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-full mx-auto px-4 mb-24"
        >
          <TestimonialsMarquee />
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-6xl mx-auto px-4 pb-20"
        >
          <PricingFAQ />
        </motion.div>
      </div>
    </div>
  );
}
