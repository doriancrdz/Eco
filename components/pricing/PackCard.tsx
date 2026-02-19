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

function PackCard({
  name,
  minutes,
  price,
  onSelect,
  isLoading = false,
}: PackCardProps) {
  const pricePerMinute = (price / minutes).toFixed(3);

  return (
    <div
      className="floating-card rounded-card border border-white/40 p-7 hover:border-white/60 hover:shadow-xl transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="transition-transform duration-200 hover:rotate-3">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500/20" />
            </div>
            <h4 className="text-xl font-bold text-gray-900">{name}</h4>
          </div>
        </div>
        <div className="text-right ml-4">
          <div className="text-3xl font-bold text-gray-900">{price}€</div>
          <div className="text-xs text-gray-500 font-medium">one-time</div>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gradient-to-br from-amber-50/50 to-orange-50/50 rounded-lg border border-amber-100/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-gray-700">
            <span className="text-2xl font-bold text-gray-900">+{minutes}</span>
            <span className="text-sm">minutes</span>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">~{pricePerMinute}€/min</div>
            <div className="text-xs text-emerald-600 font-medium">Ajoutées immédiatement</div>
          </div>
        </div>
      </div>

      <button
        onClick={onSelect}
        disabled={isLoading}
        className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all bg-gradient-to-r from-gray-800 to-gray-700 text-white hover:from-gray-700 hover:to-gray-600 shadow-lg relative overflow-hidden hover:scale-[1.02] active:scale-[0.98] ${
          isLoading ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Chargement...
          </span>
        ) : (
          <span className="relative z-10 flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" />
            Acheter ce pack
          </span>
        )}
      </button>
    </div>
  );
}

export default memo(PackCard);
