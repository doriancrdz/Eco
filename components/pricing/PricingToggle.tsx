"use client";

import { memo } from "react";
import { Sparkles } from "lucide-react";

interface PricingToggleProps {
  isYearly: boolean;
  onToggle: (yearly: boolean) => void;
}

function PricingToggle({ isYearly, onToggle }: PricingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-5 mb-16">
      <span
        className="text-base font-semibold transition-colors duration-200"
        style={{ color: !isYearly ? "#EDECE8" : "rgba(237,236,232,0.35)" }}
      >
        Mensuel
      </span>

      <button
        onClick={() => onToggle(!isYearly)}
        className="relative w-16 h-8 rounded-full p-1 transition-all duration-300 focus:outline-none"
        style={{
          background: isYearly
            ? "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)"
            : "rgba(255,255,255,0.12)",
          boxShadow: isYearly ? "0 0 20px rgba(139,92,246,0.3)" : "none",
        }}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300"
          style={{
            background: "#EDECE8",
            transform: isYearly ? "translateX(32px)" : "translateX(0)",
          }}
        >
          {isYearly && <Sparkles className="w-3 h-3" style={{ color: "#8B5CF6" }} />}
        </div>
      </button>

      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <span
            className="text-base font-semibold transition-colors duration-200"
            style={{ color: isYearly ? "#EDECE8" : "rgba(237,236,232,0.35)" }}
          >
            Annuel
          </span>
          {isYearly && (
            <span
              className="px-2.5 py-0.5 text-xs font-bold rounded-full"
              style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)", color: "white" }}
            >
              -17%
            </span>
          )}
        </div>
        {isYearly && (
          <p className="text-xs" style={{ color: "rgba(237,236,232,0.4)" }}>
            Facturé annuellement
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(PricingToggle);
