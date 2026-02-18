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

const planBadgeStyles: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  student: "bg-blue-50 text-blue-600",
  pro: "bg-emerald-50 text-emerald-600",
  business: "bg-purple-50 text-purple-600",
};

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
  const totalMinutes =
    (data?.minutesPerMonth ?? 0) + (data?.extraMinutesMonth ?? 0);
  const planLabel =
    plan === "free"
      ? "Free"
      : plan === "student"
      ? "Student"
      : plan === "pro"
      ? "Pro"
      : plan === "business"
      ? "Business"
      : plan;

  if (loading) {
    return (
      <div
        className="bg-white/30 backdrop-blur-md border border-white/30 rounded-full px-4 py-2 flex items-center gap-2 h-9 animate-pulse"
        style={{ minWidth: 120 }}
      >
        <div className="w-4 h-4 rounded bg-white/40" />
        <div className="h-3 bg-white/40 rounded w-8" />
        <div className="h-3 bg-white/40 rounded w-12" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => router.push("/settings")}
      className="bg-white/30 backdrop-blur-md border border-white/30 rounded-full px-4 py-2 flex items-center gap-2 text-sm font-bold cursor-pointer hover:bg-white/40 transition-all"
    >
      <Clock className="w-4 h-4 text-gray-600" />
      <span>{minutesLeft} min</span>
      <span className="text-gray-400">|</span>
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${planBadgeStyles[plan] || planBadgeStyles.free}`}>
        {planLabel}
      </span>
    </motion.button>
  );
}
