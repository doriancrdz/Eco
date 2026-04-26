"use client";

import { motion } from "framer-motion";
import { Shield, XCircle, Headphones } from "lucide-react";

const trustItems = [
  { icon: Shield, label: "Données chiffrées", description: "Sécurité maximale", color: "#A78BFA" },
  { icon: XCircle, label: "Annulation en 1 clic", description: "Sans engagement", color: "#5EEAD4" },
  { icon: Headphones, label: "Support réactif", description: "Réponse sous 24h", color: "#93C5FD" },
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
            className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
          >
            <div
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Icon className="w-5 h-5" style={{ color: item.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: "#EDECE8" }}>{item.label}</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(237,236,232,0.45)" }}>{item.description}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
