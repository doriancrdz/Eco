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

export const BUSINESS_CONTACT_HREF =
  "mailto:support@econewapp.com?subject=" + encodeURIComponent("Offre Business ECO") +
  "&body=" + encodeURIComponent("Bonjour,\n\nNous sommes (école / association / groupe) : \nNombre d'étudiants : \nBesoin estimé (heures de cours par mois) : \n\nMerci !");

const TAGLINES: Record<string, string> = {
  free: "Pour tester sur un vrai cours",
  student: "Pour suivre un semestre sans recopier",
  pro: "Pour les semestres chargés et les partiels",
  business: "Pour une classe, une asso ou une école",
};

function hours(minutes: number) {
  return Math.round(minutes / 60);
}

function formatMinutes(n: number) {
  return n.toLocaleString("fr-FR");
}

function getFeatures(planKey: string, plan: PlanConfig): { lead?: string; items: string[] } {
  switch (planKey) {
    case "free":
      return {
        items: [
          `${plan.minutesPerMonth} min offertes chaque mois`,
          "Fiche, notions, quiz et flashcards",
          "PDF du prof et son d'un onglet",
          "Packs de minutes si besoin",
        ],
      };
    case "student":
      return {
        items: [
          `${formatMinutes(plan.minutesPerMonth)} min par mois, soit ≈ ${hours(plan.minutesPerMonth)} h de cours`,
          "Fiche, notions, quiz et flashcards pour chaque cours",
          "Export Anki de tes flashcards",
          "Matières, recherche et historique complet",
          `Jusqu'à ${MAX_RECORDING_DURATION_MINUTES} min par enregistrement`,
        ],
      };
    case "pro":
      return {
        lead: "Tout Student, plus :",
        items: [
          `${formatMinutes(plan.minutesPerMonth)} min par mois, soit ≈ ${hours(plan.minutesPerMonth)} h de cours`,
          "Un quiz qui mélange les cours de ton choix",
          "Les flashcards de plusieurs cours réunies",
          "Export PDF de chaque fiche",
          "Support prioritaire",
        ],
      };
    case "business":
      return {
        lead: "Tout Pro, plus :",
        items: ["Volume de minutes sur mesure", "Comptes Pro activés pour tout le groupe", "Une seule facture", "Un interlocuteur dédié"],
      };
    default:
      return { items: [] };
  }
}

function PlanCard({ plan, planKey, isYearly, isMostPopular = false, onSelect, isLoading = false, isCurrentPlan = false }: PlanCardProps) {
  const isFree = planKey === "free";
  const isQuote = planKey === "business";
  const displayPrice = isYearly && !isFree ? plan.priceAnnualCommitMonthly : plan.priceMonthly;
  const yearlySavings = plan.priceMonthly * 12 - plan.priceYearly;
  const isDisabled = isLoading || (!isFree && isCurrentPlan);
  const { lead, items } = getFeatures(planKey, plan);

  const buttonClass = `mk-btn mt-7 w-full disabled:cursor-not-allowed disabled:opacity-50 ${isMostPopular ? "mk-btn-primary" : "mk-btn-ghost"}`;

  return (
    <div className={`mk-spotlight relative flex h-full flex-col rounded-[20px] border p-7 ${isMostPopular ? "mk-featured" : ""}`}
      style={isMostPopular ? undefined : { background: "var(--mk-surface)", borderColor: "var(--mk-line)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-medium" style={{ color: "var(--mk-text)" }}>
          {plan.name}
        </h3>
        {isMostPopular && (
          <span className="rounded-full px-2.5 py-1 text-[11.5px] font-medium" style={{ background: "rgba(201,184,255,0.12)", color: "var(--mk-lilac)" }}>
            Recommandé
          </span>
        )}
      </div>
      <p className="mt-1 text-[13.5px]" style={{ color: "var(--mk-faint)" }}>
        {TAGLINES[planKey]}
      </p>

      <div className="mt-7 flex h-[64px] items-baseline gap-1.5">
        {isQuote ? (
          <span className="mk-display text-[44px] leading-[64px]" style={{ color: "var(--mk-text)" }}>
            Sur devis
          </span>
        ) : (
          <>
            <span className="mk-display text-[56px] leading-[64px]" style={{ color: "var(--mk-text)" }}>
              {displayPrice}€
            </span>
            {!isFree && (
              <span className="text-[14px]" style={{ color: "var(--mk-muted)" }}>
                / mois
              </span>
            )}
          </>
        )}
      </div>
      <p className="mt-1 h-5 text-[13px]" style={{ color: isYearly && !isFree && !isQuote ? "#A7F3D0" : "var(--mk-faint)" }}>
        {isFree
          ? "Sans carte bancaire"
          : isQuote
          ? "Tarif selon le nombre d'étudiants"
          : isYearly
          ? `${plan.priceYearly} € par an · ${yearlySavings} € économisés`
          : "Sans engagement"}
      </p>

      {isQuote && !isCurrentPlan ? (
        <a href={BUSINESS_CONTACT_HREF} className={buttonClass}>
          Nous contacter
        </a>
      ) : (
        <button type="button" onClick={isDisabled ? undefined : onSelect} disabled={isDisabled} className={buttonClass}>
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Redirection…
            </span>
          ) : isCurrentPlan && !isFree ? (
            "Ton plan actuel"
          ) : isFree ? (
            "Commencer gratuitement"
          ) : (
            `Choisir ${plan.name}`
          )}
        </button>
      )}

      <div className="mt-8 border-t pt-7" style={{ borderColor: "var(--mk-line)" }}>
        {lead && (
          <p className="mb-4 text-[13px] font-medium" style={{ color: "var(--mk-text)" }}>
            {lead}
          </p>
        )}
        <ul className="space-y-3">
          {items.map((f) => (
            <li key={f} className="flex items-start gap-3 text-[14px] leading-snug" style={{ color: "#C9C6C0" }}>
              <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} style={{ color: isMostPopular || planKey === "pro" ? "var(--mk-lilac)" : "var(--mk-muted)" }} />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default memo(PlanCard);
