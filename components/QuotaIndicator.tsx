"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

interface QuotaData {
  availableMinutes: number;
  plan: string;
}

export default function QuotaIndicator() {
  const { isSignedIn } = useAuth();
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    const fetchQuota = async () => {
      try {
        const res = await fetch("/api/billing/me");
        if (res.ok) {
          const data = await res.json();
          setQuotaData({
            availableMinutes: data.availableMinutes || 0,
            plan: data.plan || "free",
          });
        }
      } catch (error) {
        console.error("Erreur récupération quota:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuota();
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchQuota, 30000);
    return () => clearInterval(interval);
  }, [isSignedIn]);

  if (!isSignedIn || isLoading || !quotaData) {
    return null;
  }

  const isLowQuota = quotaData.availableMinutes < 20;
  const minutes = Math.floor(quotaData.availableMinutes);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
        isLowQuota
          ? "bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 text-amber-700"
          : "bg-white/60 backdrop-blur-sm border border-white/40 text-gray-700"
      }`}
    >
      {isLowQuota && (
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
      )}
      <span className="whitespace-nowrap">
        {minutes} min restantes
      </span>
    </motion.div>
  );
}
