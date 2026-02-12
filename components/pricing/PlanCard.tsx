"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { PlanConfig } from "@/lib/billingConfig";

interface PlanCardProps {
  plan: PlanConfig;
  planKey: string;
  isYearly: boolean;
  isMostPopular?: boolean;
  onSelect: () => void;
  isLoading?: boolean;
  index?: number;
}

export default function PlanCard({
  plan,
  planKey,
  isYearly,
  isMostPopular = false,
  onSelect,
  isLoading = false,
  index = 0,
}: PlanCardProps) {
  const price = isYearly ? plan.priceYearly : plan.priceMonthly;
  const isFree = planKey === "free";

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            duration: 0.5,
            delay: index * 0.1,
            ease: [0.22, 1, 0.36, 1],
          },
        },
      }}
      whileHover={{
        y: isMostPopular ? -8 : -6,
        scale: isMostPopular ? 1.03 : 1.02,
        transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
      }}
      className={`relative ${
        isMostPopular
          ? "md:scale-105 z-10"
          : ""
      }`}
    >
      {isMostPopular && (
        <>
          {/* Glow animé derrière la carte */}
          <motion.div
            animate={{
              opacity: [0.4, 0.6, 0.4],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 bg-gradient-to-r from-aura-emerald/30 via-aura-blue/30 to-aura-sand/30 rounded-card blur-2xl -z-10"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-aura-emerald/20 via-aura-blue/20 to-aura-sand/20 rounded-card blur-xl -z-10 opacity-60"></div>
          
          {/* Badge Most Popular intégré */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.25 }}
              className="px-4 py-1.5 bg-gradient-to-r from-aura-emerald via-aura-blue to-aura-sand text-gray-900 text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3" />
              Most Popular
            </motion.div>
          </div>
        </>
      )}

      {/* Halo aura pour Pro */}
      {isMostPopular && (
        <div className="absolute inset-0 -z-10 rounded-3xl">
          <div 
            className="absolute inset-0 rounded-3xl blur-2xl opacity-60"
            style={{
              background: 'radial-gradient(circle, rgba(184, 232, 208, 0.2) 0%, rgba(184, 216, 232, 0.15) 50%, transparent 100%)'
            }}
          />
        </div>
      )}

      {/* Wrapper avec bordure dégradée pour Pro */}
      <motion.div
        whileHover={{
          y: -4,
          transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
        }}
        className={`relative ${isMostPopular ? "p-[2px] rounded-3xl bg-gradient-to-r from-aura-emerald/40 via-aura-blue/40 to-aura-sand/40" : ""}`}
      >
        <div
          className={`rounded-3xl border p-8 h-full flex flex-col transition-all duration-250 ${
            isMostPopular
              ? "border-0 bg-white/70 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.08)] hover:shadow-[0_25px_70px_rgba(0,0,0,0.12)]"
              : "border-white/30 bg-white/70 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.06)] hover:border-white/50 hover:shadow-[0_15px_50px_rgba(0,0,0,0.08)]"
          }`}
        >
          <div className="flex-1">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-semibold text-gray-900 mb-3"
            >
              {plan.name}
            </motion.h3>
            <div className="mb-8">
              <div className="flex items-baseline gap-2">
                <motion.span
                  key={`${price}-${isYearly}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="text-5xl font-bold text-gray-900"
                >
                  {isFree ? "Gratuit" : `${price}€`}
                </motion.span>
                {!isFree && (
                  <motion.span
                    key={`period-${isYearly}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-gray-500 text-base"
                  >
                    /{isYearly ? "an" : "mois"}
                  </motion.span>
                )}
              </div>
              {!isFree && isYearly && plan.yearlyDiscountPercent > 0 && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm text-emerald-600 font-semibold mt-2 flex items-center gap-1"
                >
                  <span className="inline-block">💰</span>
                  Économise ~{plan.yearlyDiscountPercent}%
                </motion.p>
              )}
            </div>

            <div className="space-y-4 mb-8">
              {[
                { text: <><strong>{plan.minutesPerMonth} minutes</strong> par mois</>, delay: 0.3 },
                { text: <>Maximum <strong>30 minutes</strong> par enregistrement</>, delay: 0.35 },
                ...(planKey !== "free"
                  ? [{ text: <>Transcription + résumé illimités</>, delay: 0.4 }]
                  : [{ text: <>Packs de minutes disponibles</>, delay: 0.4 }]),
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: item.delay, duration: 0.4 }}
                  className="flex items-start gap-3 group"
                >
                  <motion.div
                    whileHover={{ scale: 1.2, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5 group-hover:text-emerald-700 transition-colors" />
                  </motion.div>
                  <span className="text-gray-700 text-sm leading-relaxed">
                    {item.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.button
            whileHover={{
              scale: isLoading ? 1 : 1.02,
              y: isLoading ? 0 : -2,
            }}
            whileTap={{ scale: 0.98 }}
            onClick={onSelect}
            disabled={isLoading}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-250 relative overflow-hidden ${
              isMostPopular
                ? "bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:from-gray-800 hover:to-gray-700 shadow-xl hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-emerald-500/20"
                : isFree
                ? "bg-white border-2 border-gray-300 text-gray-900 hover:bg-gray-50 hover:border-gray-400"
                : "bg-gradient-to-r from-gray-800 to-gray-700 text-white hover:from-gray-700 hover:to-gray-600 shadow-lg"
            } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                />
                Chargement...
              </span>
            ) : (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative z-10"
              >
                {isFree ? "Commencer gratuitement" : "Choisir ce plan"}
              </motion.span>
            )}
            {!isLoading && isMostPopular && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.6 }}
              />
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
