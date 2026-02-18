"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, FolderPlus } from "lucide-react";
import { motion } from "framer-motion";
import { Eco, Folder as FolderType } from "@/types";
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
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Charger les dossiers depuis l'API
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const response = await fetch("/api/folders");
        if (response.ok) {
          const data = await response.json();
          setFolders(data.folders || []);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des dossiers:", error);
      }
    };
    
    loadFolders();
    window.addEventListener("folders-updated", loadFolders);
    return () => window.removeEventListener("folders-updated", loadFolders);
  }, []);

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
      const response = await fetch(`/api/ecos/${eco.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors du renommage");
      }

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
      const payload = { folderId: folderId && folderId !== "" ? folderId : null };
      const response = await fetch(`/api/ecos/${eco.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors du déplacement");
      }

      window.dispatchEvent(new Event("eco-updated"));
      onUpdate?.();
    } catch (error) {
      console.error("Erreur lors du déplacement:", error);
      alert(error instanceof Error ? error.message : "Erreur lors du déplacement de l'ECO.");
    }
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    try {
      // Créer le dossier
      const folderResponse = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!folderResponse.ok) {
        throw new Error("Erreur lors de la création du dossier");
      }

      const newFolder = await folderResponse.json();
      
      // Déplacer l'ECO dans le nouveau dossier
      const moveResponse = await fetch(`/api/ecos/${eco.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: newFolder.id }),
      });

      if (!moveResponse.ok) {
        throw new Error("Erreur lors du déplacement de l'ECO");
      }

      // Déclencher les événements de mise à jour
      window.dispatchEvent(new Event("folders-updated"));
      window.dispatchEvent(new Event("eco-updated"));
      
      // Réinitialiser l'état
      setIsCreatingFolder(false);
      setNewFolderName("");
      onUpdate?.();
      
      // Le menu se fermera automatiquement via le click outside handler
    } catch (error) {
      console.error("Erreur lors de la création du dossier:", error);
      alert("Erreur lors de la création du dossier.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateFolderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateFolder();
    } else if (e.key === "Escape") {
      setIsCreatingFolder(false);
      setNewFolderName("");
    }
  };

  useEffect(() => {
    if (isCreatingFolder && folderInputRef.current) {
      folderInputRef.current.focus();
    }
  }, [isCreatingFolder]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/ecos/${eco.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la suppression");
      }

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

  // Construire les items du sous-menu "Déplacer vers…"
  const moveToFolderSubmenu = [
    ...(isCreatingFolder
      ? [
          {
            label: "",
            onClick: undefined,
            customContent: (
              <div className="px-4 py-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <FolderPlus className="w-4 h-4 text-gray-600 shrink-0" />
                <input
                  ref={folderInputRef}
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={handleCreateFolderKeyDown}
                  onBlur={() => {
                    // Ne pas fermer si on clique ailleurs dans le menu
                    setTimeout(() => {
                      if (!folderInputRef.current?.matches(":focus")) {
                        setIsCreatingFolder(false);
                        setNewFolderName("");
                      }
                    }, 200);
                  }}
                  placeholder="Nom du dossier"
                  disabled={isCreating}
                  className="flex-1 bg-white/30 border border-white/40 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-white/40 text-gray-800 disabled:opacity-50"
                  onClick={(e) => e.stopPropagation()}
                />
                {isCreating && (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin shrink-0" />
                )}
              </div>
            ),
          },
        ]
      : [
          {
            label: "Nouveau dossier…",
            onClick: async () => {
              setIsCreatingFolder(true);
              // Ne pas fermer le menu ici
            },
            icon: <FolderPlus className="w-4 h-4" />,
          },
        ]),
    ...(eco.folder ? [{ label: "Aucun dossier", onClick: () => handleMoveToFolder(null) }] : []),
    ...folders
      .filter((f) => f.id !== eco.folder)
      .map((folder) => ({
        label: folder.name,
        onClick: () => handleMoveToFolder(folder.id),
      })),
  ];

  const menuItems = [
    {
      label: "Renommer",
      onClick: () => {
        setIsRenaming(true);
      },
    },
    {
      label: "Déplacer vers…",
      submenu: moveToFolderSubmenu,
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
