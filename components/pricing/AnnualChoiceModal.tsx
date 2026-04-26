"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
export type AnnualBillingChoice = "yearly_upfront" | "annual_commit_monthly";

interface AnnualChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  planKey: string;
  priceYearly: number;
  priceAnnualCommitMonthly: number;
  onChoose: (choice: AnnualBillingChoice) => void;
  isLoading?: boolean;
}

export default function AnnualChoiceModal({
  isOpen,
  onClose,
  planName,
  priceYearly,
  priceAnnualCommitMonthly,
  onChoose,
  isLoading = false,
}: AnnualChoiceModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100]"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          aria-hidden="true"
        />
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="w-full max-w-md rounded-2xl p-6"
            style={{
              background: "#141619",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 32px 64px rgba(0,0,0,0.7)",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="annual-choice-title"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3
                id="annual-choice-title"
                className="text-lg font-semibold"
                style={{ color: "#EDECE8" }}
              >
                Choisir le paiement — {planName}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: "rgba(237,236,232,0.35)" }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.color = "rgba(237,236,232,0.7)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "rgba(237,236,232,0.35)";
                }}
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
                className="w-full rounded-xl p-4 text-left transition-all disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
              >
                <div className="font-semibold" style={{ color: "#EDECE8" }}>Payer en 1 fois</div>
                <div className="mt-1 text-sm" style={{ color: "rgba(237,236,232,0.5)" }}>
                  {priceYearly}€ aujourd&apos;hui (annuel)
                </div>
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onChoose("annual_commit_monthly")}
                disabled={isLoading}
                className="w-full rounded-xl p-4 text-left transition-all disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(6,182,212,0.4)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
              >
                <div className="font-semibold" style={{ color: "#EDECE8" }}>
                  Paiement mensuel avec engagement 12 mois
                </div>
                <div className="mt-1 text-sm" style={{ color: "rgba(237,236,232,0.5)" }}>
                  {priceAnnualCommitMonthly}€/mois — engagement 12 mois, facturé chaque mois
                </div>
              </motion.button>
            </div>

            {isLoading && (
              <div className="mt-5 flex justify-center">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="h-5 w-5 border-2 border-t-transparent rounded-full"
                  style={{ borderColor: "#A78BFA", borderTopColor: "transparent" }}
                />
              </div>
            )}
          </motion.div>
        </div>
      </>
    </AnimatePresence>
  );
}
