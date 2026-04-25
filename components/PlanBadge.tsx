"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { motion } from "framer-motion";

interface BillingMeResponse {
  plan?: string;
  availableMinutes?: number;
  minutesPerMonth?: number;
  minutesUsedMonth?: number;
  extraMinutesMonth?: number;
}

export default function PlanBadge() {
  const router = useRouter();
  const [data, setData] = useState<BillingMeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBilling = async () => {
      try {
        const res = await fetch("/api/billing/me", { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          setData(json);
          if (process.env.NODE_ENV !== "production") {
            console.log("[PlanBadge] quota after fetch", { availableMinutes: json.availableMinutes });
          }
        }
      } catch {
        // Erreur silencieuse
      } finally {
        setLoading(false);
      }
    };

    fetchBilling();
    const onQuotaUpdated = () => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[PlanBadge] quota-updated, refetch");
      }
      fetchBilling();
    };
    window.addEventListener("quota-updated", onQuotaUpdated);
    return () => window.removeEventListener("quota-updated", onQuotaUpdated);
  }, []);

  const plan = data?.plan || "free";
  const minutesLeft = Math.floor(data?.availableMinutes ?? 0);
  const totalMinutes = (data?.minutesPerMonth ?? 0) + (data?.extraMinutesMonth ?? 0);
  const percentage = totalMinutes > 0 ? Math.min(100, (minutesLeft / totalMinutes) * 100) : 0;

  const planLabel =
    plan === "free" ? "Free" :
    plan === "student" ? "Student" :
    plan === "pro" ? "Pro" :
    plan === "business" ? "Business" :
    plan;

  const isPaid = plan !== "free";

  if (loading) {
    return (
      <div
        className="rounded-full px-4 py-2 flex items-center gap-2 h-9 animate-pulse bg-[#f6f5f4] border border-[#e7e6e4]"
        style={{ minWidth: 120 }}
      >
        <div className="w-4 h-4 rounded bg-[#e7e6e4]" />
        <div className="h-3 rounded w-8 bg-[#e7e6e4]" />
        <div className="h-3 rounded w-12 bg-[#e7e6e4]" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => router.push("/settings")}
      className="relative overflow-hidden rounded-full px-4 pt-2 pb-3 flex items-center gap-2 text-sm font-bold cursor-pointer transition-all hover:scale-105 bg-[#f6f5f4] border border-[#e7e6e4] text-[#131211] hover:bg-[#eeede9]"
    >
      <Clock className="w-4 h-4 shrink-0 text-[#8b8884]" />

      {/* Mobile : minutes seules */}
      <span className="sm:hidden font-bold">
        {minutesLeft} min
      </span>

      {/* Desktop : minutes / total */}
      <span className="hidden sm:inline font-bold">
        {minutesLeft} / {totalMinutes} min
      </span>

      <span className="text-[#8b8884]">|</span>
      <span className="font-bold">{planLabel}</span>

      {/* Barre de progression — desktop uniquement */}
      <div className="hidden sm:block absolute bottom-0 left-0 right-0 h-1 bg-[#e7e6e4]">
        <div
          className="h-full bg-gradient-to-r from-teal-400 via-blue-400 to-indigo-400 transition-[width] duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </motion.button>
  );
}
