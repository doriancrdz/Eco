"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
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
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    fetchBilling();
    const onQuotaUpdated = () => fetchBilling();
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

  if (loading) {
    return (
      <div
        className="eco-plan-badge"
        style={{ minWidth: 100, opacity: 0.5 }}
      >
        <div className="eco-skeleton w-3 h-3 rounded" />
        <div className="eco-skeleton h-3 w-16 rounded" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => router.push("/settings")}
      className="eco-plan-badge"
      style={{ position: "relative" }}
    >
      <Zap style={{ width: 13, height: 13, flexShrink: 0, color: "#8B5CF6" }} />

      {/* Mobile */}
      <span className="sm:hidden font-semibold text-xs" style={{ color: "#EDECE8" }}>
        {minutesLeft} min
      </span>

      {/* Desktop */}
      <span className="hidden sm:inline font-semibold text-xs" style={{ color: "#EDECE8" }}>
        {minutesLeft} / {totalMinutes} min
      </span>

      <span style={{ color: "rgba(237,236,232,0.25)", fontSize: 11 }}>·</span>
      <span className="font-bold text-xs" style={{ color: "#EDECE8" }}>{planLabel}</span>

      {/* Progress bar */}
      <div
        className="hidden sm:block absolute bottom-0 left-0 right-0 rounded-b-full overflow-hidden"
        style={{ height: 2, background: "rgba(255,255,255,0.08)" }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: "linear-gradient(90deg, #8B5CF6 0%, #06B6D4 100%)",
            transition: "width 0.5s ease",
          }}
        />
      </div>
    </motion.button>
  );
}
