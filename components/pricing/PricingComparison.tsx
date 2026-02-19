"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { PLANS, PlanType } from "@/lib/billingConfig";

const comparisonData = [
  {
    label: "Minutes/mois",
    free: "10 min",
    student: "800 min",
    pro: "2000 min",
    business: "6000 min",
  },
  {
    label: "Packs",
    free: "✅ Disponibles",
    student: "✅ Disponibles",
    pro: "✅ Disponibles",
    business: "✅ Disponibles",
  },
  {
    label: "Support",
    free: "Communauté",
    student: "Email",
    pro: "Email prioritaire",
    business: "Dédié",
  },
  {
    label: "Idéal pour",
    free: "Essai",
    student: "Étudiants",
    pro: "Professionnels",
    business: "Équipes",
  },
];

export default function PricingComparison() {
  const [openRow, setOpenRow] = useState<number | null>(null);

  return (
    <div className="w-full">
      {/* Desktop: Tableau */}
      <div className="hidden md:block overflow-x-auto">
        <div className="floating-card rounded-3xl border border-white/40 p-6 bg-white/70 backdrop-blur-md">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/30">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600"></th>
                {Object.entries(PLANS).map(([key, plan]) => (
                  <th
                    key={key}
                    className={`text-center py-3 px-4 text-sm font-semibold ${
                      key === "pro"
                        ? "text-gray-900 bg-gradient-to-b from-aura-emerald/10 to-transparent"
                        : "text-gray-700"
                    }`}
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, idx) => (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  className="border-b border-white/20 last:border-0"
                >
                  <td className="py-4 px-4 text-sm font-medium text-gray-700">
                    {row.label}
                  </td>
                  {(["free", "student", "pro", "business"] as PlanType[]).map((planKey) => (
                    <td
                      key={planKey}
                      className={`text-center py-4 px-4 text-sm text-gray-600 ${
                        planKey === "pro" ? "bg-gradient-to-b from-aura-emerald/5 to-transparent" : ""
                      }`}
                    >
                      {row[planKey as keyof typeof row]}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: Accordéon */}
      <div className="md:hidden space-y-3">
        {comparisonData.map((row, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.3 }}
            className="floating-card rounded-2xl border border-white/40 overflow-hidden bg-white/70 backdrop-blur-md"
          >
            <button
              onClick={() => setOpenRow(openRow === idx ? null : idx)}
              className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-white/30 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-900">{row.label}</span>
              <motion.div
                animate={{ rotate: openRow === idx ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </motion.div>
            </button>
            <AnimatePresence>
              {openRow === idx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-white/20"
                >
                  <div className="px-4 py-4 space-y-3">
                    {Object.entries(PLANS).map(([key, plan]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between py-2 border-b border-white/10 last:border-0"
                      >
                        <span className="text-xs font-medium text-gray-600">{plan.name}</span>
                        <span className="text-sm text-gray-900">{row[key as PlanType]}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
