"use client";

import { memo } from "react";
import { Check } from "lucide-react";
import { PlanConfig, MAX_RECORDING_DURATION_MINUTES } from "@/lib/billingConfig";

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

const TAGLINES: Record<string, string> = {
  free: "Pour tester sur un vrai cours",
  student: "Pour un semestre classique",
  pro: "Pour un semestre chargé",
  business: "Pour un usage intensif",
};

function hours(minutes: number) {
  return Math.round(minutes / 60);
}

function PlanCard({ plan, planKey, isYearly, isMostPopular = false, onSelect, isLoading = false, isCurrentPlan = false }: PlanCardProps) {
  const isFree = planKey === "free";
  const displayPrice = isYearly && !isFree ? plan.priceAnnualCommitMonthly : plan.priceMonthly;
  const yearlySavings = plan.priceMonthly * 12 - plan.priceYearly;
  const isDisabled = isLoading || (!isFree && isCurrentPlan);

  const features = isFree
    ? [
        `${plan.minutesPerMonth} minutes offertes pour essayer`,
        "Toutes les fonctionnalités incluses",
        "Packs de minutes disponibles",
      ]
    : [
        `${plan.minutesPerMonth} minutes par mois`,
        `Soit ≈ ${hours(plan.minutesPerMonth)} h de cours enregistrés`,
        `Jusqu'à ${MAX_RECORDING_DURATION_MINUTES} min par enregistrement`,
        "Toutes les fonctionnalités incluses",
      ];

  return (
    <div
      className="relative flex h-full flex-col rounded-[20px] border p-7"
      style={{
        background: isMostPopular ? "#131218" : "var(--mk-surface)",
        borderColor: isMostPopular ? "rgba(201,184,255,0.45)" : "var(--mk-line)",
        boxShadow: isMostPopular ? "0 30px 80px -40px rgba(201,184,255,0.35)" : "none",
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-medium" style={{ color: "var(--mk-text)" }}>
          {plan.name}
        </h3>
        {isMostPopular && (
          <span
            className="rounded-full px-2.5 py-1 text-[11.5px] font-medium"
            style={{ background: "rgba(201,184,255,0.12)", color: "var(--mk-lilac)" }}
          >
            Le plus choisi
          </span>
        )}
      </div>
      <p className="mt-1 text-[13.5px]" style={{ color: "var(--mk-faint)" }}>
        {TAGLINES[planKey]}
      </p>

      <div className="mt-7 flex items-baseline gap-1.5">
        <span className="mk-display text-[56px]" style={{ color: "var(--mk-text)" }}>
          {displayPrice}€
        </span>
        {!isFree && (
          <span className="text-[14px]" style={{ color: "var(--mk-muted)" }}>
            / mois
          </span>
        )}
      </div>
      <p className="mt-1 h-5 text-[13px]" style={{ color: isYearly && !isFree ? "#A7F3D0" : "var(--mk-faint)" }}>
        {isFree
          ? "Sans carte bancaire"
          : isYearly
          ? `${plan.priceYearly} € par an · ${yearlySavings} € économisés`
          : "Sans engagement"}
      </p>

      <button
        type="button"
        onClick={isDisabled ? undefined : onSelect}
        disabled={isDisabled}
        className={`mk-btn mt-7 w-full disabled:cursor-not-allowed disabled:opacity-50 ${isMostPopular ? "mk-btn-primary" : "mk-btn-ghost"}`}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Redirection…
          </span>
        ) : isCurrentPlan && !isFree ? (
          "Ton plan actuel"
        ) : isFree ? (
          "Commencer"
        ) : (
          `Choisir ${plan.name}`
        )}
      </button>

      <ul className="mt-8 space-y-3 border-t pt-7" style={{ borderColor: "var(--mk-line)" }}>
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-[14px] leading-snug" style={{ color: "#C9C6C0" }}>
            <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} style={{ color: isMostPopular ? "var(--mk-lilac)" : "var(--mk-muted)" }} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default memo(PlanCard);
