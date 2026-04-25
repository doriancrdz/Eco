"use client";

import { useState, useEffect, useCallback } from "react";
import { Eco } from "@/types";
import EcoItem from "./EcoItem";
import { Search } from "lucide-react";

interface EcoHistoryProps {
  selectedEcoId: string | null;
  onSelectEco: (eco: Eco) => void;
  onClose?: () => void;
  refreshKey?: number;
}

export default function EcoHistory({
  selectedEcoId,
  onSelectEco,
  onClose,
  refreshKey = 0,
}: EcoHistoryProps) {
  const [search, setSearch] = useState("");
  const [ecos, setEcos] = useState<Eco[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEcos = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/ecos?folderId=null&limit=30");
      if (!response.ok) throw new Error("Erreur chargement");
      const data = await response.json();
      setEcos(data.ecos || []);
    } catch {
      setEcos([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadEcos(); }, [loadEcos, refreshKey]);

  useEffect(() => {
    const handleEcoUpdated = () => loadEcos();
    window.addEventListener("eco-updated", handleEcoUpdated);
    return () => window.removeEventListener("eco-updated", handleEcoUpdated);
  }, [loadEcos]);

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const filtered = search.trim()
    ? ecos.filter((e) => normalize(e.title).includes(normalize(search.trim())))
    : ecos;

  return (
    <div className="mt-4 flex flex-col min-h-0">
      <p
        className="text-[10px] font-bold uppercase tracking-[0.12em] px-4 mb-2"
        style={{ color: "rgba(237,236,232,0.28)" }}
      >
        Mes ECOs
      </p>

      {/* Search */}
      <div className="relative px-2 mb-2">
        <Search
          className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
          style={{ color: "rgba(237,236,232,0.22)" }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="w-full rounded-xl py-1.5 text-xs outline-none transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#EDECE8",
            paddingLeft: 28,
            paddingRight: 12,
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = "rgba(139,92,246,0.3)";
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          }}
        />
      </div>

      {/* Items */}
      <div className="overflow-y-auto flex-1 px-2 space-y-0.5 scrollbar-hide">
        {isLoading ? (
          <div className="px-3 py-2 space-y-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-7 rounded-lg eco-skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-3 text-xs" style={{ color: "rgba(237,236,232,0.28)" }}>
            {search ? "Aucun résultat" : "Aucun ECO"}
          </p>
        ) : (
          filtered.map((eco) => (
            <EcoItem
              key={eco.id}
              eco={eco}
              isSelected={selectedEcoId === eco.id}
              onSelect={(e) => {
                onSelectEco(e);
                onClose?.();
              }}
              onUpdate={loadEcos}
              onDelete={loadEcos}
            />
          ))
        )}
      </div>
    </div>
  );
}
