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
        window.location.reload(); // Rafraîchir pour mettre à jour l'UI
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
      
      if (!res.ok) {
        throw new Error("Erreur lors de la récupération des données");
      }

      const data = await res.json();
      setBillingData(data);
      if (typeof window !== "undefined" && data?.plan) {
        sessionStorage.setItem("eco_billing_plan", data.plan);
      }
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

  // Règles d'affichage des boutons selon le type d'abonnement
  const isManualPlan = Boolean(
    billingData && billingData.plan !== "free" && !billingData.stripeSubscriptionId
  );
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
      alert(
        err instanceof Error ? err.message : "Une erreur est survenue lors de la suppression du compte."
      );
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

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
            Gère ton abonnement et tes quotas
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

        {/* Paiement échoué — accès suspendu */}
        {billingData?.paymentBlocked && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm font-medium flex items-center gap-2"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            Paiement échoué — accès suspendu. Mets à jour ton moyen de paiement pour réactiver l&apos;accès.
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
            {billingData?.commitmentEndAt && !billingData?.canCancel && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50/80 border border-amber-200/60 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Engagement jusqu&apos;au {new Date(billingData.commitmentEndAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
            )}
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
            {/* Bouton gauche : upgrade (Free / plan manuel) ou résilier (mensuel sans engagement) */}
            {showUpgradeButton && (
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/pricing")}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-base bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl font-semibold hover:from-gray-800 hover:to-gray-700 shadow-lg hover:shadow-xl transition-all"
              >
                <CreditCard className="w-4 h-4" />
                Passer au forfait supérieur
              </motion.button>
            )}

            {showCancelButton && (
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-base bg-red-50 border-2 border-red-200 text-red-600 rounded-xl font-semibold hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-50"
              >
                {cancelling ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
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

            {/* Bouton droite : toujours visible */}
            {showPackButton && (
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/pricing#packs")}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-base bg-white border-2 border-gray-300 text-gray-900 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
              >
                <Package className="w-4 h-4" />
                Acheter un pack
              </motion.button>
            )}
          </div>

          {billingData && isAnnualOrCommit && (
            <div className="mt-6 pt-6 border-t border-white/40">
              <p className="text-sm text-gray-500">
                L&apos;annulation sera possible après la date d&apos;engagement.
              </p>
            </div>
          )}
        </motion.div>

        {/* Section Compte : infos + déconnexion et suppression */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="floating-card rounded-3xl border border-white/40 p-8 bg-white/70 backdrop-blur-md mb-6"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Compte</h2>

          {/* Infos compte */}
          <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Nom</p>
              <p className="text-lg font-medium text-gray-900">
                {user?.firstName ? `${user.firstName}${user?.lastName ? " " + user.lastName : ""}` : "Non renseigné"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Email</p>
              <p className="text-lg font-medium text-gray-900">
                {user?.primaryEmailAddress?.emailAddress || "Non renseigné"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">Tu es sur le plan</p>
              <span className="inline-block px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold">
                {billingData?.planName || "Free"}
              </span>
            </div>
          </div>

          {/* Boutons Se déconnecter + Supprimer mon compte */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Se déconnecter
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowDeleteModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              Supprimer mon compte
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Modale de confirmation de résiliation */}
      <AnimatePresence>
        {showCancelModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCancelModal(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 z-[51] w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-confirm-title"
            >
              <div className="bg-white rounded-3xl p-8 shadow-2xl border border-white/40">
                <h3 id="cancel-confirm-title" className="text-xl font-bold text-gray-900 mb-4">
                  Résilier ton abonnement ?
                </h3>
                <p className="text-gray-600 mb-6">
                  Ton abonnement sera annulé à la fin de la période en cours.
                  Tu ne seras pas débité le mois prochain.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 px-4 py-2 min-h-[44px] text-base bg-gray-100 rounded-xl font-medium text-gray-900 hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={confirmCancel}
                    disabled={cancelling}
                    className="flex-1 px-4 py-2 min-h-[44px] text-base bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {cancelling ? "Résiliation..." : "Oui, résilier"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modale confirmation suppression compte */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isDeleting && setShowDeleteModal(false)}
            className="fixed inset-0 min-h-[100dvh] bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain"
            aria-hidden="true"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <h3 id="delete-account-title" className="text-xl font-bold text-red-600 mb-2">
                Supprimer mon compte
              </h3>
              <p className="text-gray-600 mb-6">
                ⚠️ Cette action est <strong>irréversible</strong>. Toutes tes données (enregistrements, résumés, abonnement) seront définitivement supprimées.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 px-6 py-3 min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="flex-1 px-6 py-3 min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
