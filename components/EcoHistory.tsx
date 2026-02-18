"use client";

import { useState, useEffect, useCallback } from "react";
import { getEcos } from "@/lib/storage";
import { Eco } from "@/types";
import EcoItem from "./EcoItem";

interface EcoHistoryProps {
  selectedFolderId: string | null;
  selectedEcoId: string | null;
  onSelectEco: (eco: Eco) => void;
  onClose?: () => void;
  refreshKey?: number;
}

export default function EcoHistory({
  selectedFolderId,
  selectedEcoId,
  onSelectEco,
  onClose,
  refreshKey = 0,
}: EcoHistoryProps) {
  const [search, setSearch] = useState("");
  const [ecos, setEcos] = useState<Eco[]>([]);

  const loadEcos = useCallback(() => {
    let list = getEcos();
    if (selectedFolderId) {
      list = list.filter((e) => e.folder === selectedFolderId);
    }
    setEcos(list);
  }, [selectedFolderId]);

  useEffect(() => {
    loadEcos();
  }, [loadEcos, refreshKey]);

  useEffect(() => {
    window.addEventListener("eco-updated", loadEcos);
    return () => window.removeEventListener("eco-updated", loadEcos);
  }, [loadEcos]);

  const filtered = search.trim()
    ? ecos.filter((e) =>
        e.title.toLowerCase().includes(search.trim().toLowerCase())
      )
    : ecos;

  return (
    <div className="mt-6 flex flex-col min-h-0">
      <p className="text-xs font-black uppercase tracking-widest text-gray-400 px-4 mb-2">
        Vos ECOs
      </p>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher…"
        className="w-full bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-sm outline-none focus:bg-white/30 transition-all mb-2 mx-4"
      />
      <div className="overflow-y-auto max-h-64 px-2 space-y-0.5">
        {filtered.map((eco) => (
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
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-3 text-gray-500 text-sm">Aucun ECO</p>
        )}
      </div>
    </div>
  );
}
