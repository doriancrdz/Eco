"use client";

import { memo } from "react";

interface PackCardProps {
  name: string;
  minutes: number;
  price: number;
  onSelect: () => void;
  isLoading?: boolean;
  index?: number;
}

function PackCard({ minutes, price, onSelect, isLoading = false }: PackCardProps) {
  const centsPerMinute = ((price / minutes) * 100).toFixed(1).replace(".", ",");

  return (
    <div className="mk-card flex flex-col p-7">
      <p className="text-[13.5px]" style={{ color: "var(--mk-faint)" }}>
        Paiement unique · minutes sans date d&apos;expiration
      </p>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <p className="mk-display text-[44px]" style={{ color: "var(--mk-text)" }}>
          +{minutes} <span className="text-[20px]" style={{ color: "var(--mk-muted)" }}>min</span>
        </p>
        <p className="text-[22px] font-medium" style={{ color: "var(--mk-text)" }}>
          {price}€
        </p>
      </div>
      <p className="mt-1 text-[13.5px]" style={{ color: "var(--mk-muted)" }}>
        ≈ {Math.round(minutes / 60)} h de cours · {centsPerMinute} centimes la minute
      </p>
      <button type="button" onClick={onSelect} disabled={isLoading} className="mk-btn mk-btn-ghost mt-7 w-full disabled:cursor-not-allowed disabled:opacity-50">
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Redirection…
          </span>
        ) : (
          "Acheter ce pack"
        )}
      </button>
    </div>
  );
}

export default memo(PackCard);
