"use client";

import { memo, useState, useEffect } from "react";
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

function PlanCard({
  plan,
  planKey,
  isYearly,
  isMostPopular = false,
  onSelect,
  isLoading = false,
  index = 0,
}: PlanCardProps) {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isFree = planKey === "free";
  // Mode Mensuel: prix mensuel sans engagement
  // Mode Annuel: prix mensuel équivalent avec engagement (affiché en gros), total annuel en petit
  const displayPrice = isYearly ? plan.priceAnnualCommitMonthly : plan.priceMonthly;
  const displayPeriod = isYearly ? "mois" : "mois"; // En mode annuel, on affiche aussi "/mois" pour le prix principal

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
            duration: 0.4,
            delay: index * 0.05,
            ease: [0.22, 1, 0.36, 1],
          },
        },
      }}
      whileHover={isMobile ? {} : {
        y: isMostPopular ? -8 : -6,
        scale: isMostPopular ? 1.03 : 1.02,
        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
      }}
      style={{ willChange: isMobile ? 'auto' : 'transform' }}
      className={`relative ${
        isMostPopular
          ? "md:scale-105 z-10"
          : ""
      }`}
    >
      {isMostPopular && (
        <>
          {/* Glow animé derrière la carte - optimisé */}
          <motion.div
            animate={isMobile ? { opacity: 0.5 } : {
              opacity: [0.5, 0.6, 0.5],
            }}
            transition={isMobile ? {} : {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 bg-gradient-to-r from-aura-emerald/30 via-aura-blue/30 to-aura-sand/30 rounded-card blur-2xl -z-10"
            style={{ willChange: isMobile ? 'auto' : 'opacity' }}
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
          <div className="flex-1 flex flex-col">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-semibold text-gray-900 mb-3"
            >
              {plan.name}
            </motion.h3>
            <div className="mb-8">
              {isYearly && !isFree ? (
                // Mode Annuel: prix mensuel équivalent en gros, badge "2 mois offerts", total annuel en petit
                <>
                  <div className="flex items-baseline gap-2">
                    <motion.span
                      key={`${displayPrice}-annual`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="text-5xl font-bold text-gray-900"
                    >
                      {displayPrice}€
                    </motion.span>
                    <motion.span
                      key="period-mois-annual"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="text-gray-500 text-base"
                    >
                      /mois
                    </motion.span>
                  </div>
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="text-sm text-emerald-600 font-semibold mt-2"
                  >
                    2 mois offerts
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm text-gray-500 mt-1"
                  >
                    {plan.priceYearly}€ / an
                  </motion.p>
                </>
              ) : (
                // Mode Mensuel: prix mensuel simple
                <>
                  <div className="flex items-baseline gap-2">
                    <motion.span
                      key={`${displayPrice}-monthly`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="text-5xl font-bold text-gray-900"
                    >
                      {isFree ? "Gratuit" : `${displayPrice}€`}
                    </motion.span>
                    {!isFree && (
                      <motion.span
                        key="period-mois-monthly"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-gray-500 text-base"
                      >
                        /mois
                      </motion.span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4 mb-8 flex-1">
              {(planKey === "free"
                ? [
                    { text: "10 minutes offertes", delay: 0.3 },
                    { text: "Transcription + résumé + points clés et notions à retenir", delay: 0.35 },
                    { text: "Packs de minutes disponibles", delay: 0.4 },
                  ]
                : [
                    { text: <><strong>{plan.minutesPerMonth} minutes</strong> par mois</>, delay: 0.3 },
                    { text: <>Maximum <strong>60 minutes</strong> par enregistrement</>, delay: 0.35 },
                    { text: "Transcription + résumés illimités + points clés et notions à retenir", delay: 0.4 },
                  ]
              ).map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: item.delay, duration: 0.4 }}
                  className="flex items-start gap-3 group"
                >
                  <motion.div
                    whileHover={isMobile ? {} : { scale: 1.1, rotate: 3 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    style={{ willChange: isMobile ? 'auto' : 'transform' }}
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

          {!isFree ? (
            <motion.button
              whileHover={isMobile || isLoading ? {} : {
                scale: 1.02,
                y: -2,
              }}
              whileTap={{ scale: 0.98 }}
              onClick={onSelect}
              disabled={isLoading}
              style={{ willChange: isMobile ? 'auto' : 'transform' }}
              className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 relative overflow-hidden mt-auto ${
                isMostPopular
                  ? "bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:from-gray-800 hover:to-gray-700 shadow-xl hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-emerald-500/20"
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
                  Choisir ce plan
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
          ) : (
            // Espacement pour Free pour aligner avec les autres cartes (hauteur du bouton)
            <div className="h-[50px] mt-auto" aria-hidden="true" />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default memo(PlanCard);
