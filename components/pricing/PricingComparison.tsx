"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { PLANS, PlanType } from "@/lib/billingConfig";

const comparisonData = [
  { label: "Minutes/mois", free: "10 min", student: "800 min", pro: "2000 min", business: "6000 min" },
  { label: "Support", free: "Communauté", student: "Email", pro: "Email prioritaire", business: "Dédié" },
  { label: "Idéal pour", free: "Essai", student: "Étudiants", pro: "Professionnels", business: "Équipes" },
];

export default function PricingComparison() {
  const [openRow, setOpenRow] = useState<number | null>(null);

  return (
    <div className="w-full">
      {/* Desktop: Table */}
      <div className="hidden md:block overflow-x-auto">
        <div
          className="rounded-2xl p-6"
          style={{ background: "#141619", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: "rgba(237,236,232,0.35)" }}></th>
                {Object.entries(PLANS).map(([key, plan]) => (
                  <th
                    key={key}
                    className="text-center py-3 px-4 text-sm font-semibold"
                    style={{ color: key === "student" ? "#A78BFA" : "rgba(237,236,232,0.75)" }}
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
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  style={{ borderBottom: idx < comparisonData.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                >
                  <td className="py-4 px-4 text-sm font-medium" style={{ color: "rgba(237,236,232,0.6)" }}>
                    {row.label}
                  </td>
                  {(["free", "student", "pro", "business"] as PlanType[]).map((planKey) => (
                    <td
                      key={planKey}
                      className="text-center py-4 px-4 text-sm"
                      style={{
                        color: planKey === "student" ? "rgba(167,139,250,0.9)" : "rgba(237,236,232,0.6)",
                        background: planKey === "student" ? "rgba(139,92,246,0.04)" : "transparent",
                      }}
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

      {/* Mobile: Accordion */}
      <div className="md:hidden space-y-3">
        {comparisonData.map((row, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.3 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "#141619", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <button
              onClick={() => setOpenRow(openRow === idx ? null : idx)}
              className="w-full px-4 py-4 flex items-center justify-between text-left transition-colors"
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span className="text-sm font-semibold" style={{ color: "#EDECE8" }}>{row.label}</span>
              <motion.div animate={{ rotate: openRow === idx ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4" style={{ color: "rgba(237,236,232,0.35)" }} />
              </motion.div>
            </button>
            <AnimatePresence>
              {openRow === idx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="px-4 py-4 space-y-3">
                    {Object.entries(PLANS).map(([key, plan]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between py-2"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <span className="text-xs font-medium" style={{ color: "rgba(237,236,232,0.45)" }}>{plan.name}</span>
                        <span className="text-sm" style={{ color: key === "student" ? "#A78BFA" : "rgba(237,236,232,0.75)" }}>
                          {row[key as PlanType]}
                        </span>
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
