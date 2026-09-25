"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FolderPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Eco } from "@/types";
import FolderItem from "./FolderItem";
import { useFolders } from "@/hooks/useFolders";
import EcoItem from "./EcoItem";

interface FolderListProps {
  onSelectEco?: (eco: Eco) => void;
  onClose?: () => void;
  selectedEcoId?: string | null;
  expandFolderId?: string | null;
}

export default function FolderList({
  onSelectEco,
  onClose,
  selectedEcoId = null,
  expandFolderId = null,
}: FolderListProps) {
  const { folders, isLoading } = useFolders();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [folderEcos, setFolderEcos] = useState<Record<string, Eco[]>>({});
  const [loadingFolderId, setLoadingFolderId] = useState<string | null>(null);
  const folderEcosRef = useRef<Record<string, Eco[]>>({});
  folderEcosRef.current = folderEcos;

  const loadFolders = useCallback(() => {
    window.dispatchEvent(new Event("folders-updated"));
  }, []);

  const loadFolderEcos = useCallback(async (folderId: string) => {
    setLoadingFolderId(folderId);
    try {
      const response = await fetch(`/api/ecos?folderId=${folderId}&limit=30`);
      if (!response.ok) throw new Error("Erreur chargement ECOs");
      const data = await response.json();
      setFolderEcos((prev) => ({ ...prev, [folderId]: data.ecos || [] }));
    } catch {
      setFolderEcos((prev) => ({ ...prev, [folderId]: [] }));
    } finally { setLoadingFolderId(null); }
  }, []);

  const handleToggleFolder = useCallback(
    (folderId: string) => {
      setExpandedFolderId((prev) => {
        const next = prev === folderId ? null : folderId;
        if (next && !folderEcos[next]) loadFolderEcos(next);
        return next;
      });
    },
    [folderEcos, loadFolderEcos]
  );

  const refreshFolderEcos = useCallback((folderId: string) => { loadFolderEcos(folderId); }, [loadFolderEcos]);

  useEffect(() => {
    if (expandFolderId) {
      setExpandedFolderId(expandFolderId);
      loadFolderEcos(expandFolderId);
    }
  }, [expandFolderId, loadFolderEcos]);

  useEffect(() => {
    const handleEcoUpdated = () => {
      Object.keys(folderEcosRef.current).forEach((folderId) => loadFolderEcos(folderId));
    };
    window.addEventListener("eco-updated", handleEcoUpdated);
    return () => window.removeEventListener("eco-updated", handleEcoUpdated);
  }, [loadFolderEcos]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) { setIsAdding(false); setNewName(""); return; }
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("Erreur lors de la création de la matière");
      const newFolder = await response.json();
      setNewName("");
      setIsAdding(false);
      setExpandedFolderId(newFolder.id);
      window.dispatchEvent(new Event("folders-updated"));
    } catch {
      toast.error("Erreur lors de la création de la matière.");
    }
  };

  const handleCancel = () => { setIsAdding(false); setNewName(""); };

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between pr-2">
        <p className="app-section-label">Matières</p>
        <button type="button" onClick={() => setIsAdding(true)} className="app-icon-btn app-icon-btn-sm" aria-label="Nouvelle matière">
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-1 overflow-hidden px-2"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") handleCancel();
              }}
              onBlur={() => (newName.trim() ? handleAdd() : handleCancel())}
              placeholder="Nom de la matière, puis Entrée"
              className="w-full rounded-lg px-3 py-1.5 text-[13px] outline-none"
              style={{ background: "#1A1A1D", border: "1px solid rgba(201,184,255,0.4)", color: "#EDECE8" }}
              autoFocus
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-px px-2">
        {isLoading ? (
          <div className="space-y-2 px-1 py-1.5">
            {[0, 1].map((i) => (
              <div key={i} className="h-5 rounded-md eco-skeleton" />
            ))}
          </div>
        ) : (
          folders.map((folder) => {
            const isExpanded = expandedFolderId === folder.id;
            const ecos = folderEcos[folder.id] ?? [];
            const isLoadingEcos = loadingFolderId === folder.id;
            return (
              <div key={folder.id} className="space-y-0.5">
                <FolderItem
                  folder={folder}
                  isExpanded={isExpanded}
                  onToggle={() => handleToggleFolder(folder.id)}
                  onUpdate={loadFolders}
                />
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="ml-[18px] space-y-px border-l py-0.5 pl-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                        {isLoadingEcos ? (
                          <div className="py-2 space-y-1.5">
                            <div className="h-6 rounded eco-skeleton" />
                          </div>
                        ) : ecos.length === 0 ? (
                          <p className="px-2.5 py-1.5 text-[12.5px]" style={{ color: "#6E6C68" }}>
                            Aucun cours dans cette matière
                          </p>
                        ) : (
                          ecos.map((eco) => (
                            <div key={eco.id}>
                              <EcoItem
                                eco={eco}
                                isSelected={selectedEcoId === eco.id}
                                onSelect={(e) => {
                                  onSelectEco?.(e);
                                  onClose?.();
                                }}
                                onUpdate={() => refreshFolderEcos(folder.id)}
                                onDelete={() => refreshFolderEcos(folder.id)}
                              />
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
