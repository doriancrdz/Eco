"use client";

import { useState, useEffect, useCallback } from "react";
import { Eco } from "@/types";
import EcoItem from "./EcoItem";

interface EcoHistoryProps {
  selectedFolderId: string | null;
  selectedEcoId: string | null;
  onSelectEco: (eco: Eco) => void;
  onSelectFolder?: (folderId: string | null) => void;
  onClose?: () => void;
  refreshKey?: number;
}

export default function EcoHistory({
  selectedFolderId,
  selectedEcoId,
  onSelectEco,
  onSelectFolder,
  onClose,
  refreshKey = 0,
}: EcoHistoryProps) {
  const [search, setSearch] = useState("");
  const [ecos, setEcos] = useState<Eco[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEcos = useCallback(async () => {
    setIsLoading(true);
    try {
      // Règle type ChatGPT :
      // - selectedFolderId === null => afficher UNFILED (folderId = null)
      // - selectedFolderId !== null => afficher les ECOs du dossier
      const url = selectedFolderId
        ? `/api/ecos?folderId=${selectedFolderId}`
        : `/api/ecos?folderId=null`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error("Erreur lors du chargement des ECOs");
      }

      const data = await response.json();
      
      // REMPLACER le state, pas append
      setEcos(data.ecos || []);
    } catch (error) {
      console.error("Erreur lors du chargement des ECOs:", error);
      setEcos([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFolderId]);

  useEffect(() => {
    loadEcos();
  }, [loadEcos, refreshKey]);

  useEffect(() => {
    const handleEcoUpdated = () => {
      loadEcos();
    };
    
    window.addEventListener("eco-updated", handleEcoUpdated);
    return () => window.removeEventListener("eco-updated", handleEcoUpdated);
  }, [loadEcos]);

  const filtered = search.trim()
    ? ecos.filter((e) =>
        e.title.toLowerCase().includes(search.trim().toLowerCase())
      )
    : ecos;

  return (
    <div className="mt-6 flex flex-col min-h-0">
      <button
        type="button"
        onClick={() => selectedFolderId !== null && onSelectFolder?.(null)}
        className={`text-left text-xs font-black uppercase tracking-widest px-4 mb-2 transition-colors ${
          selectedFolderId === null
            ? "text-gray-900"
            : "text-gray-400 hover:text-gray-600 cursor-pointer"
        }`}
        title={selectedFolderId !== null ? "Revenir aux ECOs non classés" : undefined}
      >
        Vos ECOs
      </button>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher…"
        className="w-full bg-white/20 border border-white/30 rounded-xl px-3 py-2 text-sm outline-none focus:bg-white/30 transition-all mb-2 mx-4"
      />
      <div className="overflow-y-auto max-h-64 px-2 space-y-0.5">
        {isLoading ? (
          <p className="px-4 py-3 text-gray-500 text-sm">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-3 text-gray-500 text-sm">Aucun ECO</p>
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
