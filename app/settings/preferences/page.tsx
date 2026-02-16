"use client";

import { useState, useEffect } from "react";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type TabId = "general" | "notifications" | "personalization" | "applications" | "data" | "security" | "account";

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: "general", label: "Général" },
  { id: "notifications", label: "Notifications" },
  { id: "personalization", label: "Personnalisation" },
  { id: "applications", label: "Applications" },
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
                <p className="text-gray-500">Préférences générales à venir</p>
              </div>
            )}

            {activeTab === "notifications" && (
              <div>
                <h2 className="text-xl font-bold mb-6 text-gray-900">Notifications</h2>
                <p className="text-gray-500">Préférences de notifications à venir</p>
              </div>
            )}

            {activeTab === "personalization" && (
              <div>
                <h2 className="text-xl font-bold mb-6 text-gray-900">Personnalisation</h2>
                <p className="text-gray-500">Options de personnalisation à venir</p>
              </div>
            )}

            {activeTab === "applications" && (
              <div>
                <h2 className="text-xl font-bold mb-6 text-gray-900">Applications</h2>
                <p className="text-gray-500">Gestion des applications à venir</p>
              </div>
            )}

            {activeTab === "data" && (
              <div>
                <h2 className="text-xl font-bold mb-6 text-gray-900">Gestion des données</h2>
                <p className="text-gray-500">Gestion des données à venir</p>
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
    </div>
  );
}
