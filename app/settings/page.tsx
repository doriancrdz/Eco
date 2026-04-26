"use client";

import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Package, CreditCard, Calendar, Clock, AlertCircle, LogOut, Trash2 } from "lucide-react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";

interface BillingData {
  plan: string;
  planName: string;
  minutesPerMonth: number;
  minutesUsedMonth: number;
  extraMinutesMonth: number;
  availableMinutes: number;
  monthKey: string;
  quotaResetAt: string | null;
  commitmentEndAt: string | null;
  canCancel: boolean;
  subscriptionStatus: string | null;
  subscriptionType: "monthly" | "annual" | null;
  stripeSubscriptionId: string | null;
  isCommit: boolean;
  paymentBlocked: boolean;
}

/* ─── Shared dark card style ─────────────────────────────────────── */
const card: React.CSSProperties = {
  background: "#141619",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
};

export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in?redirect_url=/settings");
      return;
    }
    fetchBillingData();
  }, [isLoaded, isSignedIn, router]);

  const handleCancelSubscription = () => {
    if (!billingData?.canCancel) return;
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!billingData?.canCancel) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'annulation");
      if (data.success) {
        alert(data.message || "Abonnement résilié avec succès");
        await fetchBillingData();
        window.location.reload();
      } else {
        throw new Error(data.error || "Erreur lors de l'annulation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setCancelling(false);
      setShowCancelModal(false);
    }
  };

  const fetchBillingData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/billing/me", { credentials: "include" });
      if (!res.ok) throw new Error("Erreur lors de la récupération des données");
      const data = await res.json();
      setBillingData(data);
      if (typeof window !== "undefined" && data?.plan) {
        sessionStorage.setItem("eco_billing_plan", data.plan);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoaded && !isSignedIn) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen eco-bg flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm font-medium"
          style={{ color: "rgba(237,236,232,0.4)" }}
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

  const isManualPlan = Boolean(billingData && billingData.plan !== "free" && !billingData.stripeSubscriptionId);
  const isFree = billingData?.plan === "free" || isManualPlan;
  const isMonthlyNoCommit =
    Boolean(billingData && billingData.plan !== "free") &&
    billingData?.subscriptionType === "monthly" &&
    !billingData?.isCommit;
  const isAnnualOrCommit =
    Boolean(billingData && billingData.plan !== "free") &&
    (billingData?.subscriptionType === "annual" || Boolean(billingData?.isCommit));

  const showUpgradeButton = isFree;
  const showCancelButton = isMonthlyNoCommit;
  const showPackButton = true;

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la suppression des données");
      }
      await signOut();
      router.push("/");
    } catch (err) {
      console.error("Erreur suppression compte:", err);
      alert(err instanceof Error ? err.message : "Une erreur est survenue lors de la suppression du compte.");
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="min-h-screen eco-bg relative">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none -z-10" aria-hidden>
        <div className="absolute top-0 left-1/4 w-96 h-96" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80" style={{ background: "radial-gradient(circle, rgba(20,184,166,0.05) 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-12">

        {/* Back link */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-6 group transition-colors"
            style={{ color: "rgba(237,236,232,0.4)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(237,236,232,0.8)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(237,236,232,0.4)")}
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">Retour à l&apos;accueil</span>
          </Link>
          <h1 className="text-4xl md:text-5xl font-semibold mb-2 tracking-[-0.02em]" style={{ color: "#EDECE8" }}>
            Paramètres
          </h1>
          <p className="text-sm" style={{ color: "rgba(237,236,232,0.45)" }}>
            Gère ton abonnement et tes quotas
          </p>
        </motion.div>

        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl text-sm flex items-center gap-2"
            style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#FCD34D" }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}

        {/* Payment blocked */}
        {billingData?.paymentBlocked && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-2"
            style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.22)", color: "#FCA5A5" }}
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            Paiement échoué — accès suspendu. Mets à jour ton moyen de paiement pour réactiver l&apos;accès.
          </motion.div>
        )}

        {/* ── Billing card ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3 }}
          className="p-6 md:p-8 mb-4"
          style={card}
        >
          {/* Plan actuel */}
          <div className="mb-7">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "#EDECE8" }}>
              <CreditCard className="w-4.5 h-4.5" style={{ width: 18, height: 18, color: "#A78BFA" }} />
              Plan actuel
            </h2>
            <div className="flex items-center gap-3">
              <div
                className="px-4 py-2 rounded-xl"
                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}
              >
                <span className="text-2xl font-bold" style={{ color: "#EDECE8" }}>
                  {billingData?.planName || "Free"}
                </span>
              </div>
            </div>
            {billingData?.commitmentEndAt && !billingData?.canCancel && (
              <div
                className="mt-3 flex items-center gap-2 text-sm rounded-xl px-3 py-2"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", color: "#FCD34D" }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Engagement jusqu&apos;au {new Date(billingData.commitmentEndAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
            )}
          </div>

          {/* Quotas */}
          <div className="mb-7">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "#EDECE8" }}>
              <Clock className="w-4.5 h-4.5" style={{ width: 18, height: 18, color: "#5EEAD4" }} />
              Minutes disponibles
            </h2>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "rgba(237,236,232,0.5)" }}>
                  {usedMinutes} / {totalMinutes} min utilisées
                </span>
                <span className="text-sm font-semibold" style={{ color: "#EDECE8" }}>
                  {Math.floor(availableMinutes)} min restantes
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(usagePercent, 100)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{
                    background: usagePercent > 80
                      ? "linear-gradient(90deg, #F59E0B 0%, #EF4444 100%)"
                      : usagePercent > 50
                      ? "linear-gradient(90deg, #8B5CF6 0%, #06B6D4 100%)"
                      : "linear-gradient(90deg, #8B5CF6 0%, #14B8A6 100%)",
                  }}
                />
              </div>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "Incluses", value: `${billingData?.minutesPerMonth || 0} min`, icon: <Clock className="w-4 h-4" /> },
                ...(billingData && billingData.extraMinutesMonth > 0
                  ? [{ label: "Supplémentaires", value: `+${billingData.extraMinutesMonth} min`, icon: <Package className="w-4 h-4" /> }]
                  : []),
                {
                  label: "Reset",
                  value: billingData?.quotaResetAt
                    ? new Date(billingData.quotaResetAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
                    : "—",
                  icon: <Calendar className="w-4 h-4" />,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "rgba(237,236,232,0.4)" }}>
                    {stat.icon}
                    {stat.label}
                  </div>
                  <div className="text-lg font-semibold" style={{ color: "#EDECE8" }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {showUpgradeButton && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/pricing")}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-sm font-semibold rounded-xl transition-all"
                style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)", color: "white" }}
              >
                <CreditCard className="w-4 h-4" />
                Passer au forfait supérieur
              </motion.button>
            )}

            {showCancelButton && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
                style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)", color: "#F87171" }}
              >
                {cancelling ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-t-transparent rounded-full"
                      style={{ borderColor: "#F87171", borderTopColor: "transparent" }}
                    />
                    Annulation...
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    Résilier mon abonnement
                  </>
                )}
              </motion.button>
            )}

            {showPackButton && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/pricing#packs")}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-sm font-semibold rounded-xl transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(237,236,232,0.7)",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              >
                <Package className="w-4 h-4" />
                Acheter un pack
              </motion.button>
            )}
          </div>

          {billingData && isAnnualOrCommit && (
            <div className="mt-6 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-sm" style={{ color: "rgba(237,236,232,0.35)" }}>
                L&apos;annulation sera possible après la date d&apos;engagement.
              </p>
            </div>
          )}
        </motion.div>

        {/* ── Account card ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.3 }}
          className="p-6 md:p-8 mb-4"
          style={card}
        >
          <h2 className="text-xl font-bold mb-6" style={{ color: "#EDECE8" }}>Compte</h2>

          {/* Infos */}
          <div className="space-y-4 mb-6 pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { label: "Nom", value: user?.firstName ? `${user.firstName}${user?.lastName ? " " + user.lastName : ""}` : "Non renseigné" },
              { label: "Email", value: user?.primaryEmailAddress?.emailAddress || "Non renseigné" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs uppercase tracking-wide mb-1 font-semibold" style={{ color: "rgba(237,236,232,0.3)" }}>{label}</p>
                <p className="text-base font-medium" style={{ color: "rgba(237,236,232,0.8)" }}>{value}</p>
              </div>
            ))}
            <div>
              <p className="text-xs uppercase tracking-wide mb-2 font-semibold" style={{ color: "rgba(237,236,232,0.3)" }}>Plan</p>
              <span
                className="inline-block px-4 py-1.5 rounded-xl text-sm font-bold"
                style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)", color: "white" }}
              >
                {billingData?.planName || "Free"}
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-sm font-medium rounded-xl transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(237,236,232,0.7)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowDeleteModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-sm font-medium rounded-xl transition-all"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#F87171" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
            >
              <Trash2 className="w-4 h-4" />
              Supprimer mon compte
            </motion.button>
          </div>
        </motion.div>

      </div>

      {/* ── Modal résiliation ─────────────────────────────────────── */}
      <AnimatePresence>
        {showCancelModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCancelModal(false)}
              className="fixed inset-0 z-50"
              style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
              aria-hidden="true"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.93, y: 8 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
                className="w-full max-w-md rounded-2xl p-7"
                style={{ background: "#141619", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 32px 64px rgba(0,0,0,0.7)" }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <h3 className="text-xl font-bold mb-3" style={{ color: "#EDECE8" }}>Résilier ton abonnement ?</h3>
                <p className="text-sm mb-6" style={{ color: "rgba(237,236,232,0.5)" }}>
                  Ton abonnement sera annulé à la fin de la période en cours. Tu ne seras pas débité le mois prochain.
                </p>
                <div className="flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-xl transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(237,236,232,0.7)" }}
                  >
                    Annuler
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={confirmCancel}
                    disabled={cancelling}
                    className="flex-1 px-4 py-2.5 min-h-[44px] text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
                    style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", color: "#EF4444" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.25)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
                  >
                    {cancelling ? "Résiliation..." : "Oui, résilier"}
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modal suppression compte ──────────────────────────────── */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isDeleting && setShowDeleteModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            aria-hidden="true"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 8 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl p-7"
              style={{ background: "#141619", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 32px 64px rgba(0,0,0,0.8)" }}
              role="dialog"
              aria-modal="true"
            >
              <h3 className="text-xl font-bold mb-2" style={{ color: "#EF4444" }}>Supprimer mon compte</h3>
              <p className="text-sm mb-6" style={{ color: "rgba(237,236,232,0.55)" }}>
                ⚠️ Cette action est <strong style={{ color: "rgba(237,236,232,0.8)" }}>irréversible</strong>. Toutes tes données (enregistrements, résumés, abonnement) seront définitivement supprimées.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 px-6 py-3 min-h-[44px] text-sm font-medium rounded-xl transition-all disabled:opacity-50"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(237,236,232,0.7)" }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="flex-1 px-6 py-3 min-h-[44px] text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", color: "#EF4444" }}
                  onMouseEnter={e => !isDeleting && (e.currentTarget.style.background = "rgba(239,68,68,0.25)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
                >
                  {isDeleting ? "Suppression…" : "Supprimer définitivement"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
