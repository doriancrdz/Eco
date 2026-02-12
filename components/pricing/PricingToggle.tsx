"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface PricingToggleProps {
  isYearly: boolean;
  onToggle: (yearly: boolean) => void;
}

export default function PricingToggle({ isYearly, onToggle }: PricingToggleProps) {
  return (
    <div className="flex items-center justify-center gap-5 mb-16">
      <motion.span
        animate={{ color: !isYearly ? "#111827" : "#9ca3af" }}
        transition={{ duration: 0.3 }}
        className="text-base font-semibold"
      >
        Mensuel
      </motion.span>
      <button
        onClick={() => onToggle(!isYearly)}
        className={`relative w-16 h-8 rounded-full p-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${
          isYearly
            ? "bg-gradient-to-r from-emerald-500 to-blue-500 shadow-lg shadow-emerald-500/30"
            : "bg-gray-300"
        }`}
      >
        <motion.div
          className="w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center"
          animate={{ x: isYearly ? 32 : 0 }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 35,
          }}
        >
          {isYearly && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              <Sparkles className="w-3 h-3 text-emerald-600" />
            </motion.div>
          )}
        </motion.div>
      </button>
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <motion.span
            animate={{ color: isYearly ? "#111827" : "#9ca3af" }}
            transition={{ duration: 0.2 }}
            className="text-base font-semibold"
          >
            Annuel
          </motion.span>
          <AnimatePresence mode="wait">
            {isYearly && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="px-2.5 py-0.5 bg-gradient-to-r from-emerald-500 to-blue-500 text-white text-xs font-bold rounded-full"
              >
                -17%
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {isYearly && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-gray-500"
          >
            Facturé annuellement — 2 mois off
          </motion.p>
        )}
      </div>
    </div>
  );
}
