"use client";

import { memo } from "react";
import { Zap } from "lucide-react";

interface PackCardProps {
  name: string;
  minutes: number;
  price: number;
  onSelect: () => void;
  isLoading?: boolean;
  index?: number;
}

function PackCard({ name, minutes, price, onSelect, isLoading = false }: PackCardProps) {
  const pricePerMinute = (price / minutes).toFixed(3);

  return (
    <div
      className="rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1"
      style={{
        background: "#141619",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
    >
      <div className="flex items-start justify-between mb-5">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5" style={{ color: "#FCD34D" }} />
            <h4 className="text-lg font-bold" style={{ color: "#EDECE8" }}>{name}</h4>
          </div>
        </div>
        <div className="text-right ml-4">
          <div className="text-3xl font-bold" style={{ color: "#EDECE8" }}>{price}€</div>
          <div className="text-xs font-medium" style={{ color: "rgba(237,236,232,0.4)" }}>paiement unique</div>
        </div>
      </div>

      <div
        className="mb-5 p-4 rounded-xl"
        style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.15)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: "#EDECE8" }}>+{minutes}</span>
            <span className="text-sm" style={{ color: "rgba(237,236,232,0.55)" }}>minutes</span>
          </div>
          <div className="text-right">
            <div className="text-xs" style={{ color: "rgba(237,236,232,0.4)" }}>~{pricePerMinute}€/min</div>
            <div className="text-xs font-medium" style={{ color: "#34D399" }}>Ajoutées immédiatement</div>
          </div>
        </div>
      </div>

      <button
        onClick={onSelect}
        disabled={isLoading}
        className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#EDECE8" }}
        onMouseEnter={e => !isLoading && ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.13)")}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)")}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Chargement...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" style={{ color: "#FCD34D" }} />
            Acheter ce pack
          </span>
        )}
      </button>
    </div>
  );
}

export default memo(PackCard);
