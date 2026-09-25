"use client";

import { ArrowLeft, PanelLeft, Share2, Sparkles } from "lucide-react";
import GuideDropdown from "./GuideDropdown";

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  title?: string;
  onBack?: () => void;
  onShare?: () => void;
  showUpgrade?: boolean;
  onUpgrade?: () => void;
}

export default function Header({ sidebarOpen, onToggleSidebar, title, onBack, onShare, showUpgrade, onUpgrade }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-20 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b px-3"
      style={{ background: "rgba(9,9,11,0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderColor: "var(--mk-line)" }}
    >
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`app-icon-btn ${sidebarOpen ? "lg:hidden" : ""}`}
          aria-label={sidebarOpen ? "Masquer la barre latérale" : "Afficher la barre latérale"}
        >
          <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        {onBack && (
          <button type="button" onClick={onBack} className="app-icon-btn" aria-label="Retour">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
        {title && (
          <p className="ml-1 truncate text-[14px]" style={{ color: "var(--mk-muted)" }}>
            {title}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {onShare && (
          <button type="button" onClick={onShare} className="app-icon-btn" aria-label="Partager">
            <Share2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
        <GuideDropdown />
        {showUpgrade && onUpgrade && (
          <button type="button" onClick={onUpgrade} className="app-btn app-btn-primary !h-8 !rounded-lg !px-3 !text-[13px]">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Passer à Student</span>
            <span className="sm:hidden">Offres</span>
          </button>
        )}
      </div>
    </header>
  );
}
