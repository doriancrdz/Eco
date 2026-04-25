"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, FolderPlus } from "lucide-react";
import { Eco, Folder as FolderType } from "@/types";
import DropdownMenu from "./ui/DropdownMenu";
import Dialog from "./ui/Dialog";
import { toast } from "sonner";

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
      toast.success("ECO renommé");
    } catch {
      toast.error("Erreur lors du renommage.");
    }
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
      const folderName = folderId ? folders.find((f) => f.id === folderId)?.name : null;
      toast.success(folderName ? `Déplacé vers ${folderName}` : "Retiré du dossier");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors du déplacement de l'ECO.");
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
      toast.success("Dossier créé");
    } catch {
      toast.error("Erreur lors de la création du dossier.");
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
      toast.success("ECO supprimé");
    } catch {
      toast.error("Erreur lors de la suppression de l'ECO.");
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
                <FolderPlus className="w-4 h-4 shrink-0" style={{ color: "rgba(237,236,232,0.5)" }} />
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
                  className="flex-1 rounded-lg px-2 py-1 text-sm outline-none disabled:opacity-50"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#EDECE8" }}
                  onClick={(e) => e.stopPropagation()}
                />
                {isCreating && (
                  <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin shrink-0" style={{ borderColor: "rgba(139,92,246,0.6)", borderTopColor: "transparent" }} />
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
            className="w-full font-bold rounded-xl px-3 py-1.5 text-sm outline-none shadow-sm"
            style={{ background: "#1A1C22", border: "1px solid rgba(139,92,246,0.3)", color: "#EDECE8" }}
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
            className="p-1.5 rounded-xl transition-all focus:outline-none"
            style={{ background: "rgba(20,22,25,0.8)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(8px)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(30,32,38,0.9)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(20,22,25,0.8)")}
            aria-label="Menu d'actions"
          >
            <MoreHorizontal className="w-4 h-4" style={{ color: "rgba(237,236,232,0.5)" }} />
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
            className="px-4 py-2 text-sm font-medium rounded-xl transition-all focus:outline-none disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(237,236,232,0.7)" }}
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-semibold rounded-xl transition-all focus:outline-none disabled:opacity-50"
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", color: "#EF4444" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.25)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
          >
            {isDeleting ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
