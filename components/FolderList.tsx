"use client";

import { useState, useEffect, useCallback } from "react";
import { FolderPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder as FolderType } from "@/types";
import { Eco } from "@/types";
import FolderItem from "./FolderItem";
import EcoItem from "./EcoItem";

interface FolderListProps {
  onSelectEco?: (eco: Eco) => void;
  onClose?: () => void;
  selectedEcoId?: string | null;
  /** Optionnel : auto-expand ce dossier (ex. quand on sélectionne un ECO dedans) */
  expandFolderId?: string | null;
}

export default function FolderList({
  onSelectEco,
  onClose,
  selectedEcoId = null,
  expandFolderId = null,
}: FolderListProps) {
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [folderEcos, setFolderEcos] = useState<Record<string, Eco[]>>({});
  const [loadingFolderId, setLoadingFolderId] = useState<string | null>(null);

  const loadFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/folders");
      if (!response.ok) throw new Error("Erreur lors du chargement des dossiers");
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (error) {
      console.error("Erreur lors du chargement des dossiers:", error);
      setFolders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFolderEcos = useCallback(async (folderId: string) => {
    setLoadingFolderId(folderId);
    try {
      const response = await fetch(`/api/ecos?folderId=${folderId}&limit=30`);
      if (!response.ok) throw new Error("Erreur chargement ECOs");
      const data = await response.json();
      setFolderEcos((prev) => ({ ...prev, [folderId]: data.ecos || [] }));
    } catch (error) {
      console.error("Erreur chargement ECOs dossier:", error);
      setFolderEcos((prev) => ({ ...prev, [folderId]: [] }));
    } finally {
      setLoadingFolderId(null);
    }
  }, []);

  const handleToggleFolder = useCallback(
    (folderId: string) => {
      setExpandedFolderId((prev) => {
        const next = prev === folderId ? null : folderId;
        if (next && !folderEcos[next]) {
          loadFolderEcos(next);
        }
        return next;
      });
    },
    [folderEcos, loadFolderEcos]
  );

  const refreshFolderEcos = useCallback((folderId: string) => {
    loadFolderEcos(folderId);
  }, [loadFolderEcos]);

  useEffect(() => {
    loadFolders();
    const handleFoldersUpdated = () => loadFolders();
    window.addEventListener("folders-updated", handleFoldersUpdated);
    return () => window.removeEventListener("folders-updated", handleFoldersUpdated);
  }, [loadFolders]);

  // Auto-expand le dossier quand on sélectionne un ECO dedans
  useEffect(() => {
    if (expandFolderId) {
      setExpandedFolderId(expandFolderId);
      loadFolderEcos(expandFolderId);
    }
  }, [expandFolderId, loadFolderEcos]);

  useEffect(() => {
    const handleEcoUpdated = () => {
      if (expandedFolderId && folderEcos[expandedFolderId]) {
        loadFolderEcos(expandedFolderId);
      }
    };
    window.addEventListener("eco-updated", handleEcoUpdated);
    return () => window.removeEventListener("eco-updated", handleEcoUpdated);
  }, [expandedFolderId, folderEcos, loadFolderEcos]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      setIsAdding(false);
      setNewName("");
      return;
    }
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("Erreur lors de la création du dossier");
      const newFolder = await response.json();
      setNewName("");
      setIsAdding(false);
      await loadFolders();
      setExpandedFolderId(newFolder.id);
      window.dispatchEvent(new Event("folders-updated"));
    } catch (error) {
      console.error("Erreur lors de la création du dossier:", error);
      alert("Erreur lors de la création du dossier.");
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewName("");
  };

  return (
    <div className="mt-6">
      <p className="text-xs font-black uppercase tracking-widest text-gray-400 px-4 mb-2">
        Dossiers
      </p>
      <div className="px-4 mb-2">
        <motion.button
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsAdding(true)}
          className="text-xs font-bold text-gray-500 hover:text-gray-900 flex items-center gap-1 py-1 hover:bg-white/20 rounded-lg transition-all w-full"
        >
          <FolderPlus className="w-3.5 h-3.5 shrink-0" />
          Nouveau dossier
        </motion.button>
      </div>
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 mb-2 overflow-hidden flex items-center gap-2"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") handleCancel();
              }}
              placeholder="Nom du dossier"
              className="flex-1 bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-sm outline-none focus:bg-white/30 focus:ring-1 focus:ring-white/40"
              autoFocus
            />
            <button
              onClick={handleAdd}
              className="py-2 px-3 text-xs font-bold text-gray-800 hover:bg-white/20 rounded-lg transition-all"
            >
              OK
            </button>
            <button
              onClick={handleCancel}
              className="py-2 px-3 text-xs font-bold text-gray-500 hover:bg-white/20 rounded-lg transition-all"
            >
              Annuler
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="space-y-0.5">
        {isLoading ? (
          <p className="px-4 py-3 text-gray-500 text-xs">Chargement...</p>
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
                      <div className="pl-6 pr-2 py-1 space-y-0.5 border-l-2 border-white/20 ml-4">
                        {isLoadingEcos ? (
                          <p className="py-2 text-xs text-gray-500">Chargement…</p>
                        ) : ecos.length === 0 ? (
                          <p className="py-2 text-xs text-gray-500 opacity-75">
                            Aucun ECO dans ce dossier
                          </p>
                        ) : (
                          ecos.map((eco) => (
                            <motion.div
                              key={eco.id}
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="opacity-90"
                            >
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
                            </motion.div>
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
