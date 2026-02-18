"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Folder, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { Folder as FolderType } from "@/types";
import DropdownMenu from "./ui/DropdownMenu";
import Dialog from "./ui/Dialog";

interface FolderItemProps {
  folder: FolderType;
  isSelected: boolean;
  onSelect: (folderId: string | null) => void;
  onUpdate?: () => void;
}

export default function FolderItem({ folder, isSelected, onSelect, onUpdate }: FolderItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const isDefault = folder.isDefault || false;

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(folder.name);
    }
  }, [folder.name, isRenaming]);

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === folder.name || isDefault) {
      setRenameValue(folder.name);
      setIsRenaming(false);
      return;
    }

    try {
      const response = await fetch(`/api/folders/${folder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors du renommage");
      }

      window.dispatchEvent(new Event("folders-updated"));
      onUpdate?.();
      setIsRenaming(false);
    } catch (error) {
      console.error("Erreur lors du renommage:", error);
      setRenameValue(folder.name);
      setIsRenaming(false);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRename();
    } else if (e.key === "Escape") {
      setRenameValue(folder.name);
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/folders/${folder.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la suppression");
      }

      window.dispatchEvent(new Event("folders-updated"));
      window.dispatchEvent(new Event("eco-updated"));
      onUpdate?.();
      setShowDeleteDialog(false);
      
      // Si le dossier supprimé était sélectionné, désélectionner
      if (isSelected) {
        onSelect(null);
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      alert(error instanceof Error ? error.message : "Erreur lors de la suppression du dossier.");
    } finally {
      setIsDeleting(false);
    }
  };

  const menuItems = [
    {
      label: "Renommer",
      onClick: () => {
        if (!isDefault) {
          setIsRenaming(true);
        }
      },
      disabled: isDefault,
    },
    {
      label: "Supprimer",
      onClick: () => setShowDeleteDialog(true),
      danger: true,
      disabled: isDefault,
    },
  ];

  return (
    <>
      <motion.div
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        className={`group relative w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
          isSelected
            ? "bg-white/25 text-gray-900"
            : "text-gray-700 hover:bg-white/20"
        }`}
      >
        <div
          className="flex-1 flex items-center gap-3 min-w-0"
          onClick={() => onSelect(isSelected ? null : folder.id)}
        >
          <Folder className="w-4 h-4 shrink-0" />
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleRenameKeyDown}
              className="flex-1 bg-white/30 border border-white/40 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-white/40 text-gray-800"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate flex-1">{folder.name}</span>
          )}
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
        title="Supprimer ce dossier ?"
        description="Les ECOs de ce dossier seront déplacés vers 'Aucun dossier'. Cette action est irréversible."
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
