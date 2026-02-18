"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { Eco, Folder as FolderType, DEFAULT_FOLDERS } from "@/types";
import { updateEco, deleteEco, getFolders } from "@/lib/storage";
import DropdownMenu from "./ui/DropdownMenu";
import Dialog from "./ui/Dialog";

interface EcoItemProps {
  eco: Eco;
  isSelected: boolean;
  onSelect: (eco: Eco) => void;
  onUpdate?: () => void;
  onDelete?: () => void;
}

export default function EcoItem({ eco, isSelected, onSelect, onUpdate, onDelete }: EcoItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(eco.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const folders = getFolders();

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  // Mettre à jour la valeur du rename si l'ECO change
  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(eco.title);
    }
  }, [eco.title, isRenaming]);

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === eco.title) {
      setRenameValue(eco.title);
      setIsRenaming(false);
      return;
    }

    try {
      updateEco(eco.id, { title: trimmed });
      window.dispatchEvent(new Event("eco-updated"));
      onUpdate?.();
      setIsRenaming(false);
    } catch (error) {
      console.error("Erreur lors du renommage:", error);
      setRenameValue(eco.title);
      setIsRenaming(false);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRename();
    } else if (e.key === "Escape") {
      setRenameValue(eco.title);
      setIsRenaming(false);
    }
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    try {
      updateEco(eco.id, { folder: folderId || "" });
      window.dispatchEvent(new Event("eco-updated"));
      onUpdate?.();
    } catch (error) {
      console.error("Erreur lors du déplacement:", error);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      deleteEco(eco.id);
      window.dispatchEvent(new Event("eco-updated"));
      onDelete?.();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      alert("Erreur lors de la suppression de l'ECO.");
    } finally {
      setIsDeleting(false);
    }
  };

  const menuItems = [
    {
      label: "Renommer",
      onClick: () => {
        setIsRenaming(true);
      },
    },
    {
      label: "Déplacer vers…",
      submenu: [
        {
          label: "Aucun dossier",
          onClick: () => handleMoveToFolder(null),
        },
        ...folders.map((folder) => ({
          label: folder.name,
          onClick: () => handleMoveToFolder(folder.id),
        })),
      ],
    },
    {
      label: "Supprimer",
      onClick: () => setShowDeleteDialog(true),
      danger: true,
    },
  ];

  return (
    <>
      <motion.div
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        className={`group relative w-full text-left px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
          isSelected ? "bg-white/25" : "hover:bg-white/20"
        }`}
      >
        <div
          className="flex-1 flex flex-col gap-0.5 min-w-0"
          onClick={() => onSelect(eco)}
        >
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleRenameKeyDown}
              className="font-medium text-sm text-gray-800 bg-white/30 border border-white/40 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-white/40 w-full"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="font-medium text-sm text-gray-800 truncate">
              {eco.title}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {new Date(eco.created_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu items={menuItems} align="right">
            <button
              className="p-1 rounded-lg hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
              aria-label="Menu d'actions"
            >
              <MoreHorizontal className="w-4 h-4 text-gray-600" />
            </button>
          </DropdownMenu>
        </div>
      </motion.div>

      <Dialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Supprimer cet ECO ?"
        description="Cette action est irréversible."
      >
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={() => setShowDeleteDialog(false)}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white/20 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
          >
            {isDeleting ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
