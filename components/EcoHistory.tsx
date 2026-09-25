"use client";

import { Eco } from "@/types";
import EcoItem from "./EcoItem";

interface EcoHistoryProps {
  ecos: Eco[];
  isLoading: boolean;
  selectedEcoId: string | null;
  onSelectEco: (eco: Eco) => void;
}

const MAX_RECENTS = 15;

export default function EcoHistory({ ecos, isLoading, selectedEcoId, onSelectEco }: EcoHistoryProps) {
  const recents = ecos.slice(0, MAX_RECENTS);

  return (
    <div className="mt-5">
      <p className="app-section-label mb-1.5">Récents</p>
      <div className="space-y-px px-2">
        {isLoading ? (
          [0, 1, 2, 3].map((i) => <div key={i} className="mx-1 my-1.5 h-5 rounded-md eco-skeleton" />)
        ) : recents.length === 0 ? (
          <p className="px-3 py-1.5 text-[13px]" style={{ color: "#6E6C68" }}>
            Tes cours apparaîtront ici.
          </p>
        ) : (
          recents.map((eco) => (
            <EcoItem key={eco.id} eco={eco} isSelected={selectedEcoId === eco.id} onSelect={onSelectEco} />
          ))
        )}
      </div>
    </div>
  );
}
