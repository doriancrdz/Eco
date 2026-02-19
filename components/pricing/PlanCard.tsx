"use client";

import { memo, useState, useEffect } from "react";
import { Check, Sparkles } from "lucide-react";
import { PlanConfig } from "@/lib/billingConfig";

interface PlanCardProps {
  plan: PlanConfig;
  planKey: string;
  isYearly: boolean;
  isMostPopular?: boolean;
  onSelect: () => void;
  isLoading?: boolean;
  index?: number;
}

function PlanCard({
  plan,
  planKey,
  isYearly,
  isMostPopular = false,
  onSelect,
  isLoading = false,
  index = 0,
}: PlanCardProps) {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isFree = planKey === "free";
  // Mode Mensuel: prix mensuel sans engagement
  // Mode Annuel: prix mensuel équivalent avec engagement (affiché en gros), total annuel en petit
  const displayPrice = isYearly ? plan.priceAnnualCommitMonthly : plan.priceMonthly;
  const displayPeriod = isYearly ? "mois" : "mois"; // En mode annuel, on affiche aussi "/mois" pour le prix principal

  // Calcul des économies réelles en mode annuel
  const savings = {
    student: (19 * 12) - 192,  // 36€
    pro: (49 * 12) - 480,       // 108€
    business: (149 * 12) - 1500 // 288€
  };
  const savingsAmount = planKey !== "free" ? savings[planKey as keyof typeof savings] : 0;

  return (
    <div
      className={`relative h-full transition-transform duration-200 hover:scale-[1.02] ${
        isMostPopular
          ? "md:scale-105 z-10"
          : ""
      }`}
    >
      {isMostPopular && (
        <>
          {/* Glow statique derrière la carte */}
          <div className="absolute inset-0 bg-gradient-to-r from-aura-emerald/30 via-aura-blue/30 to-aura-sand/30 rounded-card blur-2xl -z-10 opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-r from-aura-emerald/20 via-aura-blue/20 to-aura-sand/20 rounded-card blur-xl -z-10 opacity-60"></div>
          
          {/* Badge Most Popular intégré */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
            <div className="px-4 py-1.5 bg-gradient-to-r from-aura-emerald via-aura-blue to-aura-sand text-gray-900 text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Most Popular
            </div>
          </div>
        </>
      )}

      {/* Halo aura pour Pro */}
      {isMostPopular && (
        <div className="absolute inset-0 -z-10 rounded-3xl">
          <div 
            className="absolute inset-0 rounded-3xl blur-2xl opacity-60"
            style={{
              background: 'radial-gradient(circle, rgba(184, 232, 208, 0.2) 0%, rgba(184, 216, 232, 0.15) 50%, transparent 100%)'
            }}
          />
        </div>
      )}

      {/* Wrapper avec bordure dégradée pour Student */}
      <div
        className={`relative h-full transition-transform duration-200 hover:-translate-y-1 ${isMostPopular ? "p-[2px] rounded-3xl bg-gradient-to-r from-aura-emerald/40 via-aura-blue/40 to-aura-sand/40" : ""}`}
      >
        <div
          className={`rounded-3xl border p-8 h-full flex flex-col transition-all duration-250 ${
            isMostPopular
              ? "border-0 bg-white/70 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.08)] hover:shadow-[0_25px_70px_rgba(0,0,0,0.12)]"
              : "border-white/30 bg-white/70 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.06)] hover:border-white/50 hover:shadow-[0_15px_50px_rgba(0,0,0,0.08)]"
          }`}
        >
          {/* HEADER: Hauteur fixe pour réserver l'espace en mode annuel */}
          <div className="min-h-[120px] mb-5">
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
              {plan.name}
            </h3>
            <div>
              {isYearly && !isFree ? (
                // Mode Annuel: prix mensuel équivalent en gros, badge "2 mois offerts", total annuel en petit
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-gray-900">
                      {displayPrice}€
                    </span>
                    <span className="text-gray-500 text-base">
                      /mois
                    </span>
                  </div>
                  <p className="text-sm text-emerald-600 font-semibold mt-2">
                    {savingsAmount}€ économisés
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {plan.priceYearly}€ / an
                  </p>
                </>
              ) : (
                // Mode Mensuel: prix mensuel simple
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-gray-900">
                      {isFree ? "Gratuit" : `${displayPrice}€`}
                    </span>
                    {!isFree && (
                      <span className="text-gray-500 text-base">
                        /mois
                      </span>
                    )}
                  </div>
                  {/* Placeholder invisible pour Free en mode annuel pour réserver l'espace */}
                  {isYearly && isFree && (
                    <div className="mt-2 space-y-1 opacity-0 pointer-events-none" aria-hidden="true">
                      <div className="text-sm h-5" />
                      <div className="text-sm h-5" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* CONTENT: Zone flexible qui prend le reste */}
          <div className="flex-1 space-y-4 mb-6">
            {(planKey === "free"
              ? [
                  { text: "10 minutes offertes", delay: 0.3 },
                  { text: "Transcription + résumé + points clés et notions à retenir", delay: 0.35 },
                  { text: "Packs de minutes disponibles", delay: 0.4 },
                ]
              : [
                  { text: <><strong>{plan.minutesPerMonth} minutes</strong> par mois</>, delay: 0.3 },
                  { text: <>Maximum <strong>60 minutes</strong> par enregistrement</>, delay: 0.35 },
                  { text: "Transcription + résumés illimités + points clés et notions à retenir", delay: 0.4 },
                ]
            ).map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 group"
              >
                <div className="transition-transform duration-200 hover:scale-110">
                  <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5 group-hover:text-emerald-700 transition-colors" />
                </div>
                <span className="text-gray-700 text-sm leading-relaxed">
                  {item.text}
                </span>
              </div>
            ))}
          </div>

          {/* FOOTER: Hauteur fixe pour toutes les cartes */}
          <div className="min-h-[56px] flex items-end">
            {!isFree ? (
              <button
                onClick={onSelect}
                disabled={isLoading}
                className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 relative overflow-hidden hover:scale-[1.02] active:scale-[0.98] ${
                  isMostPopular
                    ? "bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:from-gray-800 hover:to-gray-700 shadow-xl hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-emerald-500/20"
                    : "bg-gradient-to-r from-gray-800 to-gray-700 text-white hover:from-gray-700 hover:to-gray-600 shadow-lg"
                } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Chargement...
                  </span>
                ) : (
                  <span className="relative z-10">
                    Choisir ce plan
                  </span>
                )}
              </button>
            ) : (
              // Placeholder invisible pour Free qui garde la même hauteur que le bouton
              <div className="w-full py-3.5 px-4 opacity-0 pointer-events-none" aria-hidden="true">
                <span className="text-sm font-semibold">Choisir ce plan</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(PlanCard);
