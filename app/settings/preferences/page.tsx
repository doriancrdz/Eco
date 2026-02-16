"use client";

import { useState, useEffect } from "react";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getEcos } from "@/lib/storage";
import { Eco } from "@/types";

type TabId = "general" | "data" | "security" | "account";

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: "general", label: "Général" },
  { id: "data", label: "Gestion des données" },
  { id: "security", label: "Sécurité" },
  { id: "account", label: "Compte" },
];

interface BillingData {
  plan: string;
  planName: string;
}

export default function PreferencesPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [appearance, setAppearance] = useState<string>("system");
  const [language, setLanguage] = useState<string>("auto");
  const [spokenLanguage, setSpokenLanguage] = useState<string>("auto");
  
  // Modales
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [showArchiveAllModal, setShowArchiveAllModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [archivedEcos, setArchivedEcos] = useState<Eco[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in?redirect_url=/settings/preferences");
      return;
    }

    const fetchBilling = async () => {
      try {
        const res = await fetch("/api/billing/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setBillingData(data);
        }
      } catch {
        // Erreur silencieuse
      }
    };

    if (isSignedIn) {
      fetchBilling();
    }
  }, [isLoaded, isSignedIn, router]);

  if (isLoaded && !isSignedIn) {
    return null;
  }

  const handlePasswordChange = () => {
    openUserProfile();
  };

  const handleMFA = () => {
    openUserProfile();
  };

  const handleAppearanceChange = (value: string) => {
    setAppearance(value);
    // TODO: theme implementation
    // Si le dark mode n'est pas implémenté globalement, stocker uniquement la valeur sans effet visuel immédiat
  };

  const handleOpenArchived = async () => {
    setShowArchivedModal(true);
    // Récupérer les ECOs archivés depuis localStorage
    const allEcos = getEcos();
    const archived = allEcos.filter((eco: any) => eco.archived === true);
    setArchivedEcos(archived);
  };

  const handleArchiveAll = async () => {
    setIsLoadingArchive(true);
    try {
      const res = await fetch("/api/ecos/archive-all", {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setShowArchiveAllModal(false);
        // Rafraîchir la liste locale
        window.dispatchEvent(new Event("eco-updated"));
        // Toast de confirmation (simple alert pour l'instant)
        alert(`${data.count || 0} ECOs archivés avec succès`);
      }
    } catch (error) {
      console.error("Erreur lors de l'archivage:", error);
    } finally {
      setIsLoadingArchive(false);
    }
  };

  const handleDeleteAll = async () => {
    if (deleteConfirmText !== "SUPPRIMER") return;
    
    setIsLoadingDelete(true);
    try {
      const res = await fetch("/api/ecos/delete-all", {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setShowDeleteAllModal(false);
        setDeleteConfirmText("");
        // Vider la liste locale
        if (typeof window !== "undefined") {
          localStorage.removeItem("eco_recordings");
        }
        window.dispatchEvent(new Event("eco-updated"));
        // Toast de confirmation
        alert(`${data.count || 0} ECOs supprimés définitivement`);
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
    } finally {
      setIsLoadingDelete(false);
    }
  };

  const plan = billingData?.plan || "free";
  const planName = billingData?.planName || "Free";

  return (
    <div className="min-h-screen aura-gradient relative">
      {/* Overlay noise subtil */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
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

          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
            Paramètres
          </h1>
        </motion.div>

        {/* Layout principal */}
        <div className="flex gap-8 p-8">
          {/* Liste des onglets à gauche */}
          <div className="w-56 shrink-0 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-white/40 text-gray-900 font-bold"
                    : "text-gray-600 hover:bg-white/20"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Contenu de l'onglet actif à droite */}
          <div className="flex-1 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 p-8">
            {activeTab === "general" && (
              <div>
                <h2 className="text-xl font-bold mb-6 text-gray-900">Général</h2>
                <div className="space-y-0">
                  {/* Ligne 1: Apparence */}
                  <div className="flex items-center justify-between py-5 border-b border-white/20">
                    <label className="text-sm font-medium text-gray-800">Apparence</label>
                    <select
                      value={appearance}
                      onChange={(e) => handleAppearanceChange(e.target.value)}
                      className="bg-white/30 backdrop-blur-md border border-white/30 rounded-xl px-3 py-2 text-sm font-medium text-gray-800 outline-none cursor-pointer hover:bg-white/40 transition-all"
                    >
                      <option value="system">Système</option>
                      <option value="light">Clair</option>
                      <option value="dark">Sombre</option>
                    </select>
                  </div>

                  {/* Ligne 2: Langue */}
                  <div className="flex items-center justify-between py-5 border-b border-white/20">
                    <label className="text-sm font-medium text-gray-800">Langue</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="bg-white/30 backdrop-blur-md border border-white/30 rounded-xl px-3 py-2 text-sm font-medium text-gray-800 outline-none cursor-pointer hover:bg-white/40 transition-all"
                    >
                      <option value="auto">Détection automatique</option>
                    </select>
                  </div>

                  {/* Ligne 3: Langue parlée */}
                  <div className="flex items-start justify-between py-5">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-800 block">Langue parlée</label>
                      <p className="text-xs text-gray-500 mt-1">
                        La langue dans laquelle vous parlez lors de vos enregistrements ECO. Utilisée pour optimiser la transcription.
                      </p>
                    </div>
                    <div className="ml-4">
                      <select
                        value={spokenLanguage}
                        onChange={(e) => setSpokenLanguage(e.target.value)}
                        className="bg-white/30 backdrop-blur-md border border-white/30 rounded-xl px-3 py-2 text-sm font-medium text-gray-800 outline-none cursor-pointer hover:bg-white/40 transition-all"
                      >
                        <option value="auto">Détection automatique</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "data" && (
              <div>
                <h2 className="text-xl font-bold mb-6 text-gray-900">Gestion des données</h2>
                <div className="space-y-0">
                  {/* Bloc 1: ECOs archivés */}
                  <div className="flex items-center justify-between py-5 border-b border-white/20">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-800">ECOs archivés</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Consultez et gérez vos ECOs archivés.
                      </p>
                    </div>
                    <button
                      onClick={handleOpenArchived}
                      className="bg-white/40 border border-white/40 rounded-xl px-4 py-2 text-sm font-medium hover:bg-white/60 transition-all text-gray-900 ml-4"
                    >
                      Gérer
                    </button>
                  </div>

                  {/* Bloc 2: Archiver tous les ECOs */}
                  <div className="flex items-center justify-between py-5 border-b border-white/20">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-800">Archiver tous les ECOs</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Déplacer tous vos ECOs vers les archives. Cette action est réversible.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowArchiveAllModal(true)}
                      className="bg-white/40 border border-white/40 rounded-xl px-4 py-2 text-sm font-medium hover:bg-white/60 transition-all text-gray-900 ml-4"
                    >
                      Archiver tout
                    </button>
                  </div>

                  {/* Bloc 3: Supprimer tous les ECOs */}
                  <div className="flex items-center justify-between py-5">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-800">Supprimer tous les ECOs</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Supprimer définitivement tous vos ECOs. Cette action est irréversible.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDeleteAllModal(true)}
                      className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2 text-sm font-medium hover:bg-red-100 transition-all ml-4"
                    >
                      Supprimer tout
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div>
                <h2 className="text-xl font-bold mb-6 text-gray-900">Sécurité</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Mot de passe</h3>
                    <button
                      onClick={handlePasswordChange}
                      className="bg-white/40 border border-white/40 rounded-xl px-4 py-2 font-medium hover:bg-white/60 transition-all text-gray-900"
                    >
                      Modifier le mot de passe
                    </button>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Authentification à deux facteurs</h3>
                    <button
                      onClick={handleMFA}
                      className="bg-white/40 border border-white/40 rounded-xl px-4 py-2 font-medium hover:bg-white/60 transition-all text-gray-900"
                    >
                      Configurer le MFA
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "account" && (
              <div>
                <h2 className="text-xl font-bold mb-6 text-gray-900">Compte</h2>
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 block mb-2">
                      Nom
                    </label>
                    <div className="text-lg font-semibold text-gray-900">
                      {user?.firstName || user?.username || "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 block mb-2">
                      Email
                    </label>
                    <div className="text-lg font-semibold text-gray-900">
                      {user?.primaryEmailAddress?.emailAddress || "—"}
                    </div>
                  </div>
                  {plan === "free" ? (
                    <div className="pt-4">
                      <p className="text-gray-600 mb-4">Vous utilisez le plan gratuit</p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push("/pricing")}
                        className="bg-gradient-to-r from-[#99f6e4] via-[#7dd3fc] to-[#a5b4fc] text-gray-900 font-bold px-6 py-3 rounded-xl"
                      >
                        Passer au forfait supérieur
                      </motion.button>
                    </div>
                  ) : (
                    <div className="pt-4">
                      <p className="text-gray-600">
                        Vous êtes sur le plan {planName}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modale ECOs archivés */}
      <AnimatePresence>
        {showArchivedModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowArchivedModal(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl p-8 max-w-md w-full mx-4">
                <h3 className="text-xl font-bold text-gray-900 mb-4">ECOs archivés</h3>
                <div className="overflow-y-auto max-h-96">
                  {archivedEcos.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-8">Aucun ECO archivé</p>
                  ) : (
                    <div className="space-y-2">
                      {archivedEcos.map((eco) => (
                        <div key={eco.id} className="p-3 bg-white/40 rounded-xl">
                          <div className="text-sm font-medium text-gray-900">{eco.title}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(eco.created_at).toLocaleDateString("fr-FR")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowArchivedModal(false)}
                  className="mt-6 w-full bg-white/40 border border-white/40 rounded-xl px-4 py-2 text-sm font-medium hover:bg-white/60 transition-all text-gray-900"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modale Archiver tout */}
      <AnimatePresence>
        {showArchiveAllModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowArchiveAllModal(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl p-8 max-w-md w-full mx-4">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Archiver tous les ECOs ?</h3>
                <p className="text-gray-600 text-sm mb-6">
                  Cette action archivera tous vos ECOs. Vous pourrez les restaurer depuis la section ECOs archivés.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowArchiveAllModal(false)}
                    className="flex-1 bg-white/40 border border-white/40 rounded-xl px-4 py-2 text-sm font-medium hover:bg-white/60 transition-all text-gray-900"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleArchiveAll}
                    disabled={isLoadingArchive}
                    className="flex-1 bg-amber-500 text-white rounded-xl px-4 py-2 font-bold hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingArchive ? "Archivage..." : "Archiver"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modale Supprimer tout */}
      <AnimatePresence>
        {showDeleteAllModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowDeleteAllModal(false);
                setDeleteConfirmText("");
              }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl p-8 max-w-md w-full mx-4">
                <h3 className="text-xl font-bold text-red-600 mb-2">Supprimer définitivement tous vos ECOs ?</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Cette action est irréversible. Tous vos ECOs seront supprimés définitivement. Tapez SUPPRIMER pour confirmer.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Tapez SUPPRIMER"
                  className="w-full bg-white/40 border border-white/40 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-300 mt-4"
                />
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => {
                      setShowDeleteAllModal(false);
                      setDeleteConfirmText("");
                    }}
                    className="flex-1 bg-white/40 border border-white/40 rounded-xl px-4 py-2 text-sm font-medium hover:bg-white/60 transition-all text-gray-900"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDeleteAll}
                    disabled={deleteConfirmText !== "SUPPRIMER" || isLoadingDelete}
                    className="flex-1 bg-red-600 text-white rounded-xl px-4 py-2 font-bold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingDelete ? "Suppression..." : "Supprimer définitivement"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
