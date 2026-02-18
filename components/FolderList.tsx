"use client";

import { useState, useEffect } from "react";
import { FolderPlus, Inbox } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder as FolderType } from "@/types";
import FolderItem from "./FolderItem";

interface FolderListProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
}

export default function FolderList({ selectedFolderId, onSelectFolder }: FolderListProps) {
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadFolders = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/folders");
      
      if (!response.ok) {
        throw new Error("Erreur lors du chargement des dossiers");
      }

      const data = await response.json();
      // REMPLACER le state, pas append
      setFolders(data.folders || []);
    } catch (error) {
      console.error("Erreur lors du chargement des dossiers:", error);
      setFolders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFolders();
    
    const handleFoldersUpdated = () => {
      loadFolders();
    };
    
    window.addEventListener("folders-updated", handleFoldersUpdated);
    return () => window.removeEventListener("folders-updated", handleFoldersUpdated);
  }, []);

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

      if (!response.ok) {
        throw new Error("Erreur lors de la création du dossier");
      }

      const newFolder = await response.json();
      setNewName("");
      setIsAdding(false);
      
      // Recharger la liste et sélectionner le nouveau dossier
      await loadFolders();
      onSelectFolder(newFolder.id);
      
      // Déclencher l'événement pour mettre à jour les autres composants
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
        {/* Unclassés : ECOs sans dossier (folderId = null) */}
        <motion.button
          type="button"
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectFolder(null)}
          className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            selectedFolderId === null
              ? "bg-white/25 text-gray-900"
              : "text-gray-700 hover:bg-white/20"
          }`}
        >
          <Inbox className="w-4 h-4 shrink-0" />
          <span className="truncate">Unclassés</span>
        </motion.button>
        {isLoading ? (
          <p className="px-4 py-3 text-gray-500 text-xs">Chargement...</p>
        ) : (
          folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              isSelected={selectedFolderId === folder.id}
              onSelect={onSelectFolder}
              onUpdate={loadFolders}
            />
          ))
        )}
      </div>
    </div>
  );
}
