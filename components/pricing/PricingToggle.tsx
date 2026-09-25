"use client";

import { memo } from "react";
import { PLANS } from "@/lib/billingConfig";

interface PricingToggleProps {
  isYearly: boolean;
  onToggle: (yearly: boolean) => void;
}

const MAX_SAVING = Math.max(
  ...Object.values(PLANS)
    .filter((p) => p.priceMonthly > 0)
    .map((p) => Math.round(((p.priceMonthly * 12 - p.priceYearly) / (p.priceMonthly * 12)) * 100))
);

function PricingToggle({ isYearly, onToggle }: PricingToggleProps) {
  const option = (active: boolean) =>
    `relative rounded-full px-5 py-2 text-[14px] font-medium transition-colors ${active ? "" : "hover:text-[var(--mk-text)]"}`;
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Période de facturation"
        className="inline-flex rounded-full border p-1"
        style={{ borderColor: "var(--mk-line-strong)", background: "var(--mk-surface)" }}
      >
        <button
          type="button"
          role="radio"
          aria-checked={!isYearly}
          onClick={() => onToggle(false)}
          className={option(!isYearly)}
          style={!isYearly ? { background: "var(--mk-text)", color: "#0A0A0B" } : { color: "var(--mk-muted)" }}
        >
          Mensuel
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isYearly}
          onClick={() => onToggle(true)}
          className={option(isYearly)}
          style={isYearly ? { background: "var(--mk-text)", color: "#0A0A0B" } : { color: "var(--mk-muted)" }}
        >
          Annuel
        </button>
      </div>
      <p className="text-[13px]" style={{ color: isYearly ? "#A7F3D0" : "var(--mk-faint)" }}>
        Jusqu&apos;à {MAX_SAVING} % d&apos;économie avec l&apos;annuel
      </p>
    </div>
  );
}

export default memo(PricingToggle);
