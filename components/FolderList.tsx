"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const folderEcosRef = useRef<Record<string, Eco[]>>({});
  folderEcosRef.current = folderEcos;

  const loadFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/folders");
      if (!response.ok) throw new Error("Erreur lors du chargement des dossiers");
      const data = await response.json();
      setFolders(data.folders || []);
    } catch { setFolders([]); }
    finally { setIsLoading(false); }
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
    loadFolders();
    const handleFoldersUpdated = () => loadFolders();
    window.addEventListener("folders-updated", handleFoldersUpdated);
    return () => window.removeEventListener("folders-updated", handleFoldersUpdated);
  }, [loadFolders]);

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
      if (!response.ok) throw new Error("Erreur lors de la création du dossier");
      const newFolder = await response.json();
      setNewName("");
      setIsAdding(false);
      await loadFolders();
      setExpandedFolderId(newFolder.id);
      window.dispatchEvent(new Event("folders-updated"));
    } catch {
      alert("Erreur lors de la création du dossier.");
    }
  };

  const handleCancel = () => { setIsAdding(false); setNewName(""); };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-4 mb-1">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: "rgba(237,236,232,0.28)" }}
        >
          Dossiers
        </p>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAdding(true)}
          className="p-1 rounded-lg transition-colors"
          style={{ color: "rgba(237,236,232,0.3)" }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            e.currentTarget.style.color = "rgba(237,236,232,0.7)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "rgba(237,236,232,0.3)";
          }}
          aria-label="Nouveau dossier"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </motion.button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-2 mb-2 overflow-hidden flex items-center gap-2"
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
              className="flex-1 rounded-xl px-3 py-1.5 text-xs outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(139,92,246,0.3)",
                color: "#EDECE8",
              }}
              autoFocus
            />
            <button
              onClick={handleAdd}
              className="py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all"
              style={{ color: "rgba(139,92,246,0.9)", background: "rgba(139,92,246,0.1)" }}
            >
              OK
            </button>
            <button
              onClick={handleCancel}
              className="py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all"
              style={{ color: "rgba(237,236,232,0.4)" }}
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-0.5 px-2">
        {isLoading ? (
          <div className="px-1 py-2 space-y-1.5">
            {[0, 1].map(i => (
              <div key={i} className="h-7 rounded-lg eco-skeleton" />
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
                      <div
                        className="pl-5 pr-1 py-1 space-y-0.5 ml-3 border-l"
                        style={{ borderColor: "rgba(255,255,255,0.06)" }}
                      >
                        {isLoadingEcos ? (
                          <div className="py-2 space-y-1.5">
                            <div className="h-6 rounded eco-skeleton" />
                          </div>
                        ) : ecos.length === 0 ? (
                          <p className="py-2 text-xs" style={{ color: "rgba(237,236,232,0.25)" }}>
                            Aucun ECO dans ce dossier
                          </p>
                        ) : (
                          ecos.map((eco) => (
                            <motion.div
                              key={eco.id}
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
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
