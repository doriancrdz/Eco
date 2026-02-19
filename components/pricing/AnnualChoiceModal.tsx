"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
export type AnnualBillingChoice = "yearly_upfront" | "annual_commit_monthly";

interface AnnualChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  planKey: string;
  priceYearly: number; // Prix annuel upfront
  priceAnnualCommitMonthly: number; // Prix mensuel avec engagement 12 mois
  onChoose: (choice: AnnualBillingChoice) => void;
  isLoading?: boolean;
}

export default function AnnualChoiceModal({
  isOpen,
  onClose,
  planName,
  planKey,
  priceYearly,
  priceAnnualCommitMonthly,
  onChoose,
  isLoading = false,
}: AnnualChoiceModalProps) {

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="rounded-3xl border border-white/40 bg-white/80 p-6 shadow-xl backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Choisir le paiement — {planName}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-gray-500 hover:bg-white/60 hover:text-gray-700 transition-colors"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onChoose("yearly_upfront")}
                  disabled={isLoading}
                  className="w-full rounded-xl border-2 border-white/50 bg-white/70 p-4 text-left backdrop-blur-sm transition-all hover:border-aura-emerald/40 hover:bg-white/90 disabled:opacity-50"
                >
                  <div className="font-semibold text-gray-900">
                    Payer en 1 fois
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {priceYearly}€ aujourd&apos;hui (annuel)
                  </div>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onChoose("annual_commit_monthly")}
                  disabled={isLoading}
                  className="w-full rounded-xl border-2 border-white/50 bg-white/70 p-4 text-left backdrop-blur-sm transition-all hover:border-aura-blue/40 hover:bg-white/90 disabled:opacity-50"
                >
                  <div className="font-semibold text-gray-900">
                    Paiement mensuel avec engagement 12 mois
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {priceAnnualCommitMonthly}€/mois — engagement 12 mois, facturé chaque mois
                  </div>
                </motion.button>
              </div>

              {isLoading && (
                <div className="mt-4 flex justify-center">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full"
                  />
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
