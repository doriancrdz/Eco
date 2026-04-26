"use client";

import { memo } from "react";
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
  isCurrentPlan?: boolean;
}

function PlanCard({
  plan,
  planKey,
  isYearly,
  isMostPopular = false,
  onSelect,
  isLoading = false,
  index = 0,
  isCurrentPlan = false,
}: PlanCardProps) {
  const isFree = planKey === "free";
  const displayPrice = isYearly ? plan.priceAnnualCommitMonthly : plan.priceMonthly;
  const savings = { student: (19 * 12) - 192, pro: (49 * 12) - 480, business: (149 * 12) - 1500 };
  const savingsAmount = planKey !== "free" ? savings[planKey as keyof typeof savings] : 0;
  const isDisabled = isLoading || (!isFree && isCurrentPlan);

  return (
    <div
      className={`relative h-full transition-transform duration-200 hover:scale-[1.02] ${isMostPopular ? "md:scale-105 z-10" : ""}`}
    >
      {/* Popular badge */}
      {isMostPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
          <div
            className="px-4 py-1.5 text-xs font-bold rounded-full flex items-center gap-1.5"
            style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)", color: "white" }}
          >
            <Sparkles className="w-3 h-3" />
            Le plus populaire
          </div>
        </div>
      )}

      {/* Glow for popular */}
      {isMostPopular && (
        <div
          className="absolute inset-0 -z-10 rounded-3xl blur-2xl opacity-40"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.3) 0%, rgba(6,182,212,0.15) 60%, transparent 100%)" }}
        />
      )}

      {/* Card wrapper — gradient border for popular */}
      <div
        className={`relative h-full transition-transform duration-200 hover:-translate-y-1 ${
          isMostPopular ? "p-[1.5px] rounded-3xl" : ""
        }`}
        style={isMostPopular ? {
          background: "linear-gradient(135deg, rgba(139,92,246,0.6) 0%, rgba(6,182,212,0.4) 100%)",
        } : {}}
      >
        <div
          className="rounded-3xl border p-8 h-full flex flex-col transition-all duration-250"
          style={{
            background: isMostPopular ? "#181A22" : "#141619",
            borderColor: isMostPopular ? "transparent" : "rgba(255,255,255,0.08)",
            boxShadow: isMostPopular
              ? "0 20px 60px rgba(139,92,246,0.15)"
              : "0 8px 32px rgba(0,0,0,0.3)",
          }}
          onMouseEnter={e => {
            if (!isMostPopular) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)";
          }}
          onMouseLeave={e => {
            if (!isMostPopular) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
          }}
        >
          {/* Header */}
          <div className="min-h-[120px] mb-5">
            <h3 className="text-2xl font-semibold mb-3" style={{ color: "#EDECE8" }}>
              {plan.name}
            </h3>
            <div>
              {isYearly && !isFree ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold" style={{ color: "#EDECE8" }}>{displayPrice}€</span>
                    <span className="text-base" style={{ color: "rgba(237,236,232,0.45)" }}>/mois</span>
                  </div>
                  <p className="text-sm font-semibold mt-2" style={{ color: "#34D399" }}>{savingsAmount}€ économisés</p>
                  <p className="text-sm mt-1" style={{ color: "rgba(237,236,232,0.4)" }}>{plan.priceYearly}€ / an</p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold" style={{ color: "#EDECE8" }}>{`${displayPrice}€`}</span>
                    <span className="text-base" style={{ color: "rgba(237,236,232,0.45)" }}>/mois</span>
                  </div>
                  {isYearly && isFree && (
                    <div className="mt-2 space-y-1 opacity-0 pointer-events-none" aria-hidden="true">
                      <div className="text-sm h-5" /><div className="text-sm h-5" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Features */}
          <div className="flex-1 space-y-4 mb-6">
            {(planKey === "free"
              ? [
                  { text: "10 minutes offertes" },
                  { text: "Transcription + résumé + points clés et notions à retenir" },
                  { text: "Packs de minutes disponibles" },
                ]
              : [
                  { text: <><strong style={{ color: "#EDECE8" }}>{plan.minutesPerMonth} minutes</strong><span style={{ color: "rgba(237,236,232,0.7)" }}> par mois</span></> },
                  { text: <>Maximum <strong style={{ color: "#EDECE8" }}>60 minutes</strong><span style={{ color: "rgba(237,236,232,0.7)" }}> par enregistrement</span></> },
                  { text: "Transcription + résumés illimités + points clés et notions à retenir" },
                ]
            ).map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: isMostPopular ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  <Check className="w-3 h-3" style={{ color: isMostPopular ? "#A78BFA" : "#5EEAD4" }} />
                </div>
                <span className="text-sm leading-relaxed" style={{ color: "rgba(237,236,232,0.7)" }}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="min-h-[56px] flex items-end">
            {!isFree ? (
              <button
                onClick={!isFree && isCurrentPlan ? undefined : onSelect}
                disabled={isDisabled}
                className="w-full px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={
                  !isFree && isCurrentPlan
                    ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(237,236,232,0.4)", cursor: "not-allowed" }
                    : isMostPopular
                    ? { background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)", color: "white", boxShadow: "0 8px 24px rgba(139,92,246,0.35)" }
                    : { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#EDECE8" }
                }
                onMouseEnter={e => {
                  if (!isDisabled && !isMostPopular) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.13)";
                }}
                onMouseLeave={e => {
                  if (!isDisabled && !isMostPopular) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Chargement...
                  </span>
                ) : (
                  <span>{!isFree && isCurrentPlan ? "Plan actuel" : "Choisir ce plan"}</span>
                )}
              </button>
            ) : (
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
