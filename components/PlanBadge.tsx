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
        className={`rounded-full px-4 py-2 flex items-center gap-2 h-9 animate-pulse ${
          isPaid
            ? "bg-gradient-to-r from-[#99f6e4] via-[#7dd3fc] to-[#a5b4fc]"
            : "bg-white/30 backdrop-blur-md border border-white/30"
        }`}
        style={{ minWidth: 120 }}
      >
        <div className={`w-4 h-4 rounded ${isPaid ? "bg-gray-900/20" : "bg-white/40"}`} />
        <div className={`h-3 rounded w-8 ${isPaid ? "bg-gray-900/20" : "bg-white/40"}`} />
        <div className={`h-3 rounded w-12 ${isPaid ? "bg-gray-900/20" : "bg-white/40"}`} />
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
      className={`
        relative overflow-hidden rounded-full px-4 pt-2 pb-3 flex items-center gap-2 text-sm font-bold
        cursor-pointer transition-all hover:scale-105
        ${isPaid
          ? "bg-gradient-to-r from-[#99f6e4] via-[#7dd3fc] to-[#a5b4fc] text-gray-900 shadow-lg hover:shadow-xl"
          : "bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/40 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-white/15"
        }
      `}
    >
      <Clock className={`w-4 h-4 shrink-0 ${isPaid ? "text-gray-900" : "text-gray-600"}`} />

      {/* Mobile : minutes seules */}
      <span className={`sm:hidden ${isPaid ? "font-extrabold" : "font-bold"}`}>
        {minutesLeft} min
      </span>

      {/* Desktop : minutes / total */}
      <span className={`hidden sm:inline ${isPaid ? "font-extrabold" : "font-bold"}`}>
        {minutesLeft} / {totalMinutes} min
      </span>

      <span className={isPaid ? "text-gray-700 opacity-60" : "text-gray-400"}>|</span>
      <span className={isPaid ? "font-extrabold" : "font-bold"}>{planLabel}</span>

      {/* Barre de progression — desktop uniquement */}
      <div className="hidden sm:block absolute bottom-0 left-0 right-0 h-1.5 bg-black/10">
        <div
          className="h-full bg-gradient-to-r from-[#99f6e4] via-[#7dd3fc] to-[#a5b4fc] opacity-75 transition-[width] duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </motion.button>
  );
}
