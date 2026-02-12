"use client";

import { motion } from "framer-motion";
import { Shield, XCircle, Headphones } from "lucide-react";

const trustItems = [
  {
    icon: Shield,
    label: "Données chiffrées",
    description: "Sécurité maximale",
  },
  {
    icon: XCircle,
    label: "Annulation en 1 clic",
    description: "Sans engagement",
  },
  {
    icon: Headphones,
    label: "Support réactif",
    description: "Réponse sous 24h",
  },
];

export default function TrustLine() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      {trustItems.map((item, idx) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.3 }}
            className="flex items-center gap-4 p-4 rounded-2xl bg-white/50 backdrop-blur-sm border border-white/30 hover:bg-white/60 hover:border-white/40 transition-all duration-200"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-aura-emerald/20 to-aura-blue/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-gray-700" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">{item.label}</div>
              <div className="text-xs text-gray-600 mt-0.5">{item.description}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
