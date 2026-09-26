"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { BrainCircuit, CreditCard, Gem, Home, Library, LogOut, MoreHorizontal, PanelLeftClose, Plus, Settings, X } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import FolderList from "./FolderList";
import EcoHistory from "./EcoHistory";
import UserAvatar from "./UserAvatar";
import DropdownMenu from "./ui/DropdownMenu";
import Dialog from "./ui/Dialog";
import type { Eco } from "@/types";

export interface SidebarBilling {
  plan: string;
  minutesPerMonth: number;
  availableMinutes: number;
  bonusMinutes: number;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: "home" | "all" | "review" | "detail" | "other";
  selectedFolder: string | null;
  selectedEco: string | null;
  onSelectEco: (eco: Eco) => void;
  onNavigateHome: () => void;
  onNewRecording: () => void;
  onViewAll: () => void;
  onReview: () => void;
  isPro: boolean;
  onNavigatePricing: () => void;
  onManageSubscription: () => void;
  onNavigateSettings: () => void;
  onUpgrade: (packs: boolean) => void;
  recentEcos: Eco[];
  isEcosLoading: boolean;
  billing: SidebarBilling | null;
  billingLoading: boolean;
  userName?: string;
}

const PLAN_LABEL: Record<string, string> = { free: "Offre gratuite", student: "Student", pro: "Pro", business: "Business" };

function NavRow({
  icon: Icon,
  label,
  active,
  onClick,
  tag,
}: {
  icon: typeof Home;
  label: string;
  active?: boolean;
  onClick: () => void;
  tag?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`app-row ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
      {tag && (
        <span className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-medium" style={{ background: "rgba(201,184,255,0.12)", color: "var(--mk-lilac)" }}>
          {tag}
        </span>
      )}
    </button>
  );
}

function UsageCard({
  billing,
  loading,
  onUpgrade,
  onManage,
}: {
  billing: SidebarBilling | null;
  loading: boolean;
  onUpgrade: (packs: boolean) => void;
  onManage: () => void;
}) {
  if (!billing) {
    return loading ? <div className="mx-2 h-[64px] rounded-xl eco-skeleton" /> : null;
  }
  const total = Math.max(1, billing.minutesPerMonth + billing.bonusMinutes);
  const left = Math.max(0, Math.floor(billing.availableMinutes));
  const pct = Math.min(100, Math.round((left / total) * 100));
  const isFree = billing.plan === "free";
  const low = pct <= 15;

  return (
    <div className="mx-2 rounded-xl border p-3" style={{ borderColor: "var(--mk-line)", background: "rgba(255,255,255,0.02)" }}>
      <button type="button" onClick={onManage} className="block w-full text-left" aria-label="Gérer mon abonnement et mes minutes">
        <span className="flex items-center justify-between text-[12.5px]">
          <span style={{ color: "var(--mk-text)" }}>{PLAN_LABEL[billing.plan] ?? billing.plan}</span>
          <span className="tabular-nums" style={{ color: low ? "#FCD34D" : "var(--mk-muted)" }}>
            {left} min restantes
          </span>
        </span>
        <span className="mt-2 block h-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
          <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: low ? "#FCD34D" : "var(--mk-lilac)" }} />
        </span>
      </button>
      {(isFree || low) && (
        <button
          type="button"
          onClick={() => onUpgrade(!isFree)}
          className="mt-3 w-full rounded-lg py-1.5 text-[12.5px] font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--mk-text)", color: "#0A0A0B" }}
        >
          {isFree ? "Passer à Student" : "Ajouter des minutes"}
        </button>
      )}
    </div>
  );
}

export default function Sidebar({
  isOpen,
  onClose,
  activeView,
  selectedFolder,
  selectedEco,
  onSelectEco,
  onNavigateHome,
  onNewRecording,
  onViewAll,
  onReview,
  isPro,
  onNavigatePricing,
  onManageSubscription,
  onNavigateSettings,
  onUpgrade,
  recentEcos,
  isEcosLoading,
  billing,
  billingLoading,
  userName,
}: SidebarProps) {
  const { signOut } = useClerk();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 1024;
    document.body.style.overflow = isOpen && mobile ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const closeOnMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) onClose();
  };
  const run = (fn: () => void) => () => {
    fn();
    closeOnMobile();
  };
  const selectEco = (e: Eco) => {
    onSelectEco(e);
    closeOnMobile();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <motion.aside
        className="fixed inset-y-0 left-0 z-40 h-full shrink-0 overflow-hidden lg:static lg:z-auto"
        initial={false}
        animate={{ width: isOpen ? 264 : 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Navigation de l'application"
      >
        <div className="flex h-full w-[264px] max-w-[85vw] flex-col border-r" style={{ background: "#0E0E10", borderColor: "var(--mk-line)" }}>
          <div className="flex h-[52px] shrink-0 items-center justify-between pl-4 pr-2">
            <button type="button" onClick={run(onNavigateHome)} className="flex items-center gap-2" aria-label="Accueil ECO">
              <Image src="/logo-eco-v2.png" alt="" width={22} height={22} className="rounded-full" />
              <span className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: "var(--mk-text)" }}>
                ECO
              </span>
            </button>
            <button type="button" onClick={onClose} className="app-icon-btn" aria-label="Masquer la barre latérale">
              <PanelLeftClose className="hidden h-4 w-4 lg:block" strokeWidth={1.75} />
              <X className="h-4 w-4 lg:hidden" strokeWidth={1.75} />
            </button>
          </div>

          <div className="shrink-0 space-y-0.5 px-2 pb-2 pt-1">
            <button type="button" onClick={run(onNewRecording)} className="app-row app-row-strong">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--mk-text)", color: "#0A0A0B" }}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              Nouvel enregistrement
            </button>
            <NavRow icon={Home} label="Accueil" active={activeView === "home"} onClick={run(onNavigateHome)} />
            <NavRow icon={Library} label="Tous mes cours" active={activeView === "all"} onClick={run(onViewAll)} />
            <NavRow icon={BrainCircuit} label="Réviser" active={activeView === "review"} onClick={run(onReview)} tag={isPro ? undefined : "Pro"} />
            <NavRow icon={Gem} label="Abonnement" onClick={run(onNavigatePricing)} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-4 scrollbar-hide">
            <FolderList onSelectEco={selectEco} selectedEcoId={selectedEco} expandFolderId={selectedFolder} />
            <EcoHistory ecos={recentEcos} isLoading={isEcosLoading} selectedEcoId={selectedEco} onSelectEco={selectEco} />
          </div>

          <div className="shrink-0 space-y-2 border-t pb-3 pt-3" style={{ borderColor: "var(--mk-line)" }}>
            <UsageCard billing={billing} loading={billingLoading} onManage={run(onManageSubscription)} onUpgrade={(packs) => { onUpgrade(packs); closeOnMobile(); }} />
            <div className="px-2">
              <DropdownMenu
                align="left"
                triggerClassName="app-row"
                triggerLabel="Menu du compte"
                items={[
                  { label: "Paramètres", onClick: run(onNavigateSettings), icon: <Settings className="h-4 w-4" /> },
                  { label: "Gérer mon abonnement", onClick: run(onManageSubscription), icon: <CreditCard className="h-4 w-4" /> },
                  { label: "Se déconnecter", onClick: () => setShowLogoutConfirm(true), danger: true, icon: <LogOut className="h-4 w-4" /> },
                ]}
              >
                <UserAvatar size="sm" />
                <span className="flex-1 truncate text-left">{userName || "Mon compte"}</span>
                <MoreHorizontal className="h-4 w-4 shrink-0 opacity-60" />
              </DropdownMenu>
            </div>
          </div>
        </div>
      </motion.aside>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm} title="Se déconnecter ?" description="Tu pourras te reconnecter à tout moment.">
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setShowLogoutConfirm(false)} className="app-btn app-btn-ghost">
            Annuler
          </button>
          <button type="button" onClick={() => signOut({ redirectUrl: "/" })} className="app-btn app-btn-primary">
            Se déconnecter
          </button>
        </div>
      </Dialog>
    </>
  );
}
