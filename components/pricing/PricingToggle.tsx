"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface PricingToggleProps {
  isYearly: boolean;
  onToggle: (yearly: boolean) => void;
}

function PricingToggle({ isYearly, onToggle }: PricingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-5 mb-16">
      <span className={`text-base font-semibold transition-colors duration-200 ${!isYearly ? "text-gray-900" : "text-gray-400"}`}>
        Mensuel
      </span>
      <button
        onClick={() => onToggle(!isYearly)}
        className={`relative w-16 h-8 rounded-full p-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${
          isYearly
            ? "bg-gradient-to-r from-emerald-500 to-blue-500 shadow-lg shadow-emerald-500/30"
            : "bg-gray-300"
        }`}
      >
        <div
          className={`w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ${isYearly ? "translate-x-8" : "translate-x-0"}`}
        >
          {isYearly && (
            <Sparkles className="w-3 h-3 text-emerald-600" />
          )}
        </div>
      </button>
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <span className={`text-base font-semibold transition-colors duration-200 ${isYearly ? "text-gray-900" : "text-gray-400"}`}>
            Annuel
          </span>
          {isYearly && (
            <span className="px-2.5 py-0.5 bg-gradient-to-r from-emerald-500 to-blue-500 text-white text-xs font-bold rounded-full">
              -17%
            </span>
          )}
        </div>
        {isYearly && (
          <p className="text-xs text-gray-500">
            Facturé annuellement
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(PricingToggle);
