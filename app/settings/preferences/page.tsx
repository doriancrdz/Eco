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
interface Tab { id: TabId; label: string; }

const tabs: Tab[] = [
  { id: "general", label: "Général" },
  { id: "data", label: "Gestion des données" },
  { id: "security", label: "Sécurité" },
  { id: "account", label: "Compte" },
];

interface BillingData { plan: string; planName: string; }

/* ─── Shared styles ─────────────────────────────────── */
const cardStyle: React.CSSProperties = { background: "#141619", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 };
const rowBorderStyle: React.CSSProperties = { borderBottom: "1px solid rgba(255,255,255,0.06)" };
const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#EDECE8",
  borderRadius: 12,
  padding: "8px 12px",
  fontSize: 14,
  fontWeight: 500,
  outline: "none",
  cursor: "pointer",
};
const actionBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "rgba(237,236,232,0.7)",
  borderRadius: 12,
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background 0.15s",
};

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
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [showArchiveAllModal, setShowArchiveAllModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [archivedEcos, setArchivedEcos] = useState<Eco[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [isLoadingDelete, setIsLoadingDelete] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) { router.push("/sign-in?redirect_url=/settings/preferences"); return; }
    if (isSignedIn) {
      fetch("/api/billing/me", { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setBillingData(data); })
        .catch(() => {});
    }
  }, [isLoaded, isSignedIn, router]);

  if (isLoaded && !isSignedIn) return null;

  const handleAppearanceChange = (value: string) => setAppearance(value);
  const handleOpenArchived = async () => {
    setShowArchivedModal(true);
    const allEcos = getEcos();
    setArchivedEcos(allEcos.filter((eco: Eco & { archived?: boolean }) => eco.archived === true));
  };
  const handleArchiveAll = async () => {
    setIsLoadingArchive(true);
    try {
      const res = await fetch("/api/ecos/archive-all", { method: "PATCH", credentials: "include" });
      if (res.ok) { const d = await res.json(); setShowArchiveAllModal(false); window.dispatchEvent(new Event("eco-updated")); alert(`${d.count || 0} ECOs archivés`); }
    } finally { setIsLoadingArchive(false); }
  };
  const handleDeleteAll = async () => {
    if (deleteConfirmText !== "SUPPRIMER") return;
    setIsLoadingDelete(true);
    try {
      const res = await fetch("/api/ecos/delete-all", { method: "DELETE", credentials: "include" });
      if (res.ok) { const d = await res.json(); setShowDeleteAllModal(false); setDeleteConfirmText(""); if (typeof window !== "undefined") localStorage.removeItem("eco_recordings"); window.dispatchEvent(new Event("eco-updated")); alert(`${d.count || 0} ECOs supprimés`); }
    } finally { setIsLoadingDelete(false); }
  };

  const plan = billingData?.plan || "free";
  const planName = billingData?.planName || "Free";

  /* ── Row helper ──────────────────────────────────────── */
  const Row = ({ label, desc, action }: { label: string; desc?: string; action: React.ReactNode }) => (
    <div className="flex items-center justify-between py-5" style={rowBorderStyle}>
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium" style={{ color: "rgba(237,236,232,0.8)" }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: "rgba(237,236,232,0.4)" }}>{desc}</p>}
      </div>
      {action}
    </div>
  );

  return (
    <div className="min-h-screen eco-bg relative">
      {/* Glows */}
      <div className="fixed inset-0 pointer-events-none -z-10" aria-hidden>
        <div className="absolute top-0 right-1/4 w-96 h-96" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-6 group transition-colors text-sm font-medium"
            style={{ color: "rgba(237,236,232,0.4)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(237,236,232,0.8)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(237,236,232,0.4)")}
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Retour à l&apos;accueil
          </Link>
          <h1 className="text-3xl font-extrabold mb-2 tracking-[-0.02em]" style={{ color: "#EDECE8" }}>Paramètres</h1>
        </motion.div>

        {/* Layout */}
        <div className="flex gap-6">
          {/* Tab sidebar */}
          <div className="w-52 shrink-0 rounded-2xl p-2" style={cardStyle}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: activeTab === tab.id ? "rgba(139,92,246,0.14)" : "transparent",
                  color: activeTab === tab.id ? "#EDECE8" : "rgba(237,236,232,0.5)",
                  fontWeight: activeTab === tab.id ? 600 : 500,
                }}
                onMouseEnter={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 rounded-2xl p-7" style={cardStyle}>
            {activeTab === "general" && (
              <div>
                <h2 className="text-lg font-bold mb-5" style={{ color: "#EDECE8" }}>Général</h2>
                <div>
                  <Row
                    label="Apparence"
                    action={
                      <select value={appearance} onChange={e => handleAppearanceChange(e.target.value)} style={selectStyle}>
                        <option value="system">Système</option>
                        <option value="light">Clair</option>
                        <option value="dark">Sombre</option>
                      </select>
                    }
                  />
                  <Row
                    label="Langue de l'interface"
                    action={
                      <select value={language} onChange={e => setLanguage(e.target.value)} style={selectStyle}>
                        <option value="auto">Détection automatique</option>
                      </select>
                    }
                  />
                  <div className="flex items-start justify-between py-5">
                    <div className="flex-1 mr-4">
                      <p className="text-sm font-medium" style={{ color: "rgba(237,236,232,0.8)" }}>Langue parlée</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(237,236,232,0.4)" }}>
                        La langue dans laquelle tu parles lors de tes enregistrements ECO.
                      </p>
                    </div>
                    <select value={spokenLanguage} onChange={e => setSpokenLanguage(e.target.value)} style={selectStyle}>
                      <option value="auto">Détection automatique</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "data" && (
              <div>
                <h2 className="text-lg font-bold mb-5" style={{ color: "#EDECE8" }}>Gestion des données</h2>
                <div>
                  <Row label="ECOs archivés" desc="Consulte et gère tes ECOs archivés." action={
                    <button style={actionBtnStyle} onClick={handleOpenArchived}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    >Gérer</button>
                  } />
                  <Row label="Archiver tous les ECOs" desc="Déplacer tous tes ECOs vers les archives. Réversible." action={
                    <button style={actionBtnStyle} onClick={() => setShowArchiveAllModal(true)}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    >Archiver tout</button>
                  } />
                  <div className="flex items-center justify-between py-5">
                    <div className="flex-1 mr-4">
                      <p className="text-sm font-medium" style={{ color: "rgba(237,236,232,0.8)" }}>Supprimer tous les ECOs</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(237,236,232,0.4)" }}>Supprimer définitivement tous tes ECOs. Irréversible.</p>
                    </div>
                    <button
                      onClick={() => setShowDeleteAllModal(true)}
                      className="rounded-xl px-4 py-2 text-sm font-medium transition-all"
                      style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)", color: "#F87171" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.18)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.10)")}
                    >Supprimer tout</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div>
                <h2 className="text-lg font-bold mb-5" style={{ color: "#EDECE8" }}>Sécurité</h2>
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(237,236,232,0.35)" }}>Mot de passe</p>
                    <button
                      onClick={() => openUserProfile()}
                      style={actionBtnStyle}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    >Modifier le mot de passe</button>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(237,236,232,0.35)" }}>Authentification à deux facteurs</p>
                    <button
                      onClick={() => openUserProfile()}
                      style={actionBtnStyle}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    >Configurer le MFA</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "account" && (
              <div>
                <h2 className="text-lg font-bold mb-5" style={{ color: "#EDECE8" }}>Compte</h2>
                <div className="space-y-5">
                  {[
                    { label: "Nom", value: user?.firstName || user?.username || "—" },
                    { label: "Email", value: user?.primaryEmailAddress?.emailAddress || "—" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: "rgba(237,236,232,0.3)" }}>{label}</p>
                      <p className="text-base font-semibold" style={{ color: "rgba(237,236,232,0.8)" }}>{value}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "rgba(237,236,232,0.3)" }}>Plan</p>
                    {plan === "free" ? (
                      <div>
                        <p className="text-sm mb-3" style={{ color: "rgba(237,236,232,0.5)" }}>Tu es sur le plan gratuit</p>
                        <motion.button
                          whileHover={{ scale: 1.02, y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => router.push("/pricing")}
                          className="px-6 py-3 rounded-xl font-bold text-sm"
                          style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)", color: "white" }}
                        >
                          Passer au forfait supérieur
                        </motion.button>
                      </div>
                    ) : (
                      <span className="inline-block px-4 py-1.5 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)", color: "white" }}>
                        {planName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal: ECOs archivés ──────────────────────────── */}
      <AnimatePresence>
        {showArchivedModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowArchivedModal(false)}
              className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
                className="max-w-md w-full rounded-2xl p-7"
                style={{ background: "#141619", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 32px 64px rgba(0,0,0,0.7)" }}
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold mb-4" style={{ color: "#EDECE8" }}>ECOs archivés</h3>
                <div className="overflow-y-auto max-h-80 space-y-2">
                  {archivedEcos.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: "rgba(237,236,232,0.35)" }}>Aucun ECO archivé</p>
                  ) : archivedEcos.map(eco => (
                    <div key={eco.id} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="text-sm font-medium" style={{ color: "#EDECE8" }}>{eco.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(237,236,232,0.4)" }}>{new Date(eco.created_at).toLocaleDateString("fr-FR")}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowArchivedModal(false)} className="mt-5 w-full rounded-xl py-2.5 text-sm font-medium transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(237,236,232,0.7)" }}
                >Fermer</button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modal: Archiver tout ──────────────────────────── */}
      <AnimatePresence>
        {showArchiveAllModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowArchiveAllModal(false)}
              className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
                className="max-w-md w-full rounded-2xl p-7"
                style={{ background: "#141619", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 32px 64px rgba(0,0,0,0.7)" }}
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold mb-2" style={{ color: "#EDECE8" }}>Archiver tous les ECOs ?</h3>
                <p className="text-sm mb-6" style={{ color: "rgba(237,236,232,0.5)" }}>
                  Cette action archivera tous tes ECOs. Tu pourras les restaurer depuis la section ECOs archivés.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowArchiveAllModal(false)} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(237,236,232,0.7)" }}
                  >Annuler</button>
                  <button onClick={handleArchiveAll} disabled={isLoadingArchive} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                    style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)", color: "#FCD34D" }}
                  >{isLoadingArchive ? "Archivage..." : "Archiver"}</button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modal: Supprimer tout ─────────────────────────── */}
      <AnimatePresence>
        {showDeleteAllModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowDeleteAllModal(false); setDeleteConfirmText(""); }}
              className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
                className="max-w-md w-full rounded-2xl p-7"
                style={{ background: "#141619", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 32px 64px rgba(0,0,0,0.8)" }}
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold mb-2" style={{ color: "#EF4444" }}>Supprimer définitivement tous tes ECOs ?</h3>
                <p className="text-sm mb-4" style={{ color: "rgba(237,236,232,0.5)" }}>
                  Cette action est irréversible. Tape <strong style={{ color: "#EDECE8" }}>SUPPRIMER</strong> pour confirmer.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="SUPPRIMER"
                  className="w-full rounded-xl px-3 py-2.5 min-h-[44px] text-base outline-none mt-3 mb-5"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(239,68,68,0.25)", color: "#EDECE8" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(239,68,68,0.25)")}
                />
                <div className="flex gap-3">
                  <button onClick={() => { setShowDeleteAllModal(false); setDeleteConfirmText(""); }}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(237,236,232,0.7)" }}
                  >Annuler</button>
                  <button onClick={handleDeleteAll} disabled={deleteConfirmText !== "SUPPRIMER" || isLoadingDelete}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", color: "#EF4444" }}
                    onMouseEnter={e => !isLoadingDelete && deleteConfirmText === "SUPPRIMER" && (e.currentTarget.style.background = "rgba(239,68,68,0.25)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
                  >{isLoadingDelete ? "Suppression..." : "Supprimer définitivement"}</button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
