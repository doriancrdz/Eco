"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Package, CreditCard, Calendar, Clock } from "lucide-react";
import Link from "next/link";

interface BillingData {
  plan: string;
  planName: string;
  minutesPerMonth: number;
  minutesUsedMonth: number;
  extraMinutesMonth: number;
  availableMinutes: number;
  monthKey: string;
  quotaResetAt: string | null;
}

export default function SettingsPage() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const router = useRouter();
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in?redirect_url=/settings");
      return;
    }

    fetchBillingData();
  }, [isLoaded, isSignedIn, router]);

  const fetchBillingData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/billing/me", { credentials: "include" });
      
      if (!res.ok) {
        throw new Error("Erreur lors de la récupération des données");
      }

      const data = await res.json();
      setBillingData(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Une erreur est survenue"
      );
    } finally {
      setIsLoading(false);
    }
  };


  if (isLoaded && !isSignedIn) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen aura-gradient flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-600"
        >
          Chargement...
        </motion.div>
      </div>
    );
  }

  const totalMinutes = billingData
    ? billingData.minutesPerMonth + billingData.extraMinutesMonth
    : 0;
  const usedMinutes = billingData?.minutesUsedMonth || 0;
  const availableMinutes = billingData?.availableMinutes || 0;
  const usagePercent = totalMinutes > 0 ? (usedMinutes / totalMinutes) * 100 : 0;

  return (
    <div className="min-h-screen aura-gradient relative">
      {/* Overlay noise subtil */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Header avec retour */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Retour à l&apos;accueil</span>
          </Link>

          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-2">
            Paramètres
          </h1>
          <p className="text-gray-600">
            Gérez votre abonnement et vos quotas
          </p>
        </motion.div>

        {/* Message d'erreur */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Carte principale */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="floating-card rounded-3xl border border-white/40 p-8 bg-white/70 backdrop-blur-md mb-6"
        >
          {/* Plan actuel */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Plan actuel
            </h2>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-gradient-to-r from-aura-emerald/20 to-aura-blue/20 rounded-xl border border-white/40">
                <span className="text-2xl font-bold text-gray-900">
                  {billingData?.planName || "Free"}
                </span>
              </div>
            </div>
          </div>

          {/* Quotas */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Minutes disponibles
            </h2>

            {/* Barre de progression */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  {usedMinutes} / {totalMinutes} minutes utilisées
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {Math.floor(availableMinutes)} min restantes
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(usagePercent, 100)}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    usagePercent > 80
                      ? "bg-gradient-to-r from-amber-500 to-orange-500"
                      : usagePercent > 50
                      ? "bg-gradient-to-r from-blue-500 to-blue-600"
                      : "bg-gradient-to-r from-emerald-500 to-emerald-600"
                  }`}
                />
              </div>
            </div>

            {/* Détails */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white/50 rounded-xl border border-white/30">
                <div className="text-xs text-gray-600 mb-1">Incluses</div>
                <div className="text-lg font-semibold text-gray-900">
                  {billingData?.minutesPerMonth || 0} min
                </div>
              </div>
              {billingData && billingData.extraMinutesMonth > 0 && (
                <div className="p-4 bg-white/50 rounded-xl border border-white/30">
                  <div className="text-xs text-gray-600 mb-1">Supplémentaires</div>
                  <div className="text-lg font-semibold text-gray-900">
                    +{billingData.extraMinutesMonth} min
                  </div>
                </div>
              )}
              <div className="p-4 bg-white/50 rounded-xl border border-white/30">
                <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Reset
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {billingData?.quotaResetAt
                    ? new Date(billingData.quotaResetAt).toLocaleDateString(
                        "fr-FR",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }
                      )
                    : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/pricing")}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl font-semibold hover:from-gray-800 hover:to-gray-700 shadow-lg hover:shadow-xl transition-all"
            >
              <CreditCard className="w-4 h-4" />
              Passer au forfait supérieur
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/pricing#packs")}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
            >
              <Package className="w-4 h-4" />
              Acheter un pack
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
