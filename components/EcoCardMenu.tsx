"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, FolderPlus } from "lucide-react";
import { Eco, Folder as FolderType } from "@/types";
import DropdownMenu from "./ui/DropdownMenu";
import Dialog from "./ui/Dialog";

interface EcoCardMenuProps {
  eco: Eco;
  onUpdate: () => void;
  onDelete: () => void;
}

export default function EcoCardMenu({ eco, onUpdate, onDelete }: EcoCardMenuProps) {
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

  useEffect(() => {
    const loadFolders = async () => {
      try {
        const response = await fetch("/api/folders");
        if (response.ok) {
          const data = await response.json();
          setFolders(data.folders || []);
        }
      } catch { /* ignore */ }
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

  useEffect(() => {
    if (!isRenaming) setRenameValue(eco.title);
  }, [eco.title, isRenaming]);

  useEffect(() => {
    if (isCreatingFolder && folderInputRef.current) {
      folderInputRef.current.focus();
    }
  }, [isCreatingFolder]);

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
      if (!response.ok) throw new Error("Erreur lors du renommage");
      window.dispatchEvent(new Event("eco-updated"));
      onUpdate();
    } catch { /* ignore */ }
    setIsRenaming(false);
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    try {
      const response = await fetch(`/api/ecos/${eco.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folderId ?? null }),
      });
      if (!response.ok) throw new Error("Erreur lors du déplacement");
      window.dispatchEvent(new Event("eco-updated"));
      onUpdate();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erreur lors du déplacement de l'ECO.");
    }
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    try {
      const folderRes = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!folderRes.ok) throw new Error("Erreur lors de la création du dossier");
      const newFolder = await folderRes.json();
      const moveRes = await fetch(`/api/ecos/${eco.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: newFolder.id }),
      });
      if (!moveRes.ok) throw new Error("Erreur lors du déplacement de l'ECO");
      window.dispatchEvent(new Event("folders-updated"));
      window.dispatchEvent(new Event("eco-updated"));
      setIsCreatingFolder(false);
      setNewFolderName("");
      onUpdate();
    } catch {
      alert("Erreur lors de la création du dossier.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/ecos/${eco.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Erreur lors de la suppression");
      window.dispatchEvent(new Event("eco-updated"));
      onDelete();
      setShowDeleteDialog(false);
    } catch {
      alert("Erreur lors de la suppression de l'ECO.");
    } finally {
      setIsDeleting(false);
    }
  };

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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleCreateFolder(); }
                    else if (e.key === "Escape") { setIsCreatingFolder(false); setNewFolderName(""); }
                  }}
                  onBlur={() => {
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
            onClick: async () => { setIsCreatingFolder(true); },
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
      onClick: () => setIsRenaming(true),
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
      {isRenaming && (
        <div
          className="absolute inset-0 z-10 flex items-start justify-center pt-6 px-6"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleRename(); }
              else if (e.key === "Escape") { setRenameValue(eco.title); setIsRenaming(false); }
            }}
            className="w-full font-bold text-gray-900 bg-white/80 border border-gray-300 rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-gray-300 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu items={menuItems} align="right">
          <button
            className="p-1.5 rounded-xl bg-white/70 hover:bg-white/90 border border-white/60 shadow-sm backdrop-blur-sm transition-all focus:outline-none focus:ring-2 focus:ring-gray-300/50"
            aria-label="Menu d'actions"
          >
            <MoreHorizontal className="w-4 h-4 text-gray-600" />
          </button>
        </DropdownMenu>
      </div>

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
