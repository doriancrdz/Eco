"use client";

import { useState } from "react";
import { FolderPlus, Folder } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder as FolderType } from "@/types";
import { DEFAULT_FOLDERS } from "@/types";

interface FolderListProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
}

export default function FolderList({ selectedFolderId, onSelectFolder }: FolderListProps) {
  const [folders, setFolders] = useState<FolderType[]>(DEFAULT_FOLDERS);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) {
      setIsAdding(false);
      setNewName("");
      return;
    }
    const id = `folder-${Date.now()}`;
    setFolders((prev) => [...prev, { id, name }]);
    setNewName("");
    setIsAdding(false);
    onSelectFolder(id);
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
        {folders.map((folder) => (
          <motion.button
            key={folder.id}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectFolder(selectedFolderId === folder.id ? null : folder.id)}
            className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              selectedFolderId === folder.id
                ? "bg-white/25 text-gray-900"
                : "text-gray-700 hover:bg-white/20"
            }`}
          >
            <Folder className="w-4 h-4 shrink-0" />
            <span className="truncate flex-1">{folder.name}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
