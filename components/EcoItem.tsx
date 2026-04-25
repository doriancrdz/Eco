"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, FolderPlus, Archive, Mic, Monitor, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { Eco, Folder as FolderType } from "@/types";
import DropdownMenu from "./ui/DropdownMenu";
import Dialog from "./ui/Dialog";
import { toast } from "sonner";

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

  useEffect(() => {
    const loadFolders = async () => {
      try {
        const response = await fetch("/api/folders");
        if (response.ok) {
          const data = await response.json();
          setFolders(data.folders || []);
        }
      } catch { /* silent */ }
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
      onUpdate?.();
      setIsRenaming(false);
      toast.success("ECO renommé");
    } catch {
      setRenameValue(eco.title);
      setIsRenaming(false);
      toast.error("Erreur lors du renommage.");
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleRename(); }
    else if (e.key === "Escape") { setRenameValue(eco.title); setIsRenaming(false); }
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
      toast.error(error instanceof Error ? error.message : "Erreur lors du déplacement de l'ECO.");
    }
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    try {
      const folderResponse = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!folderResponse.ok) throw new Error("Erreur lors de la création du dossier");
      const newFolder = await folderResponse.json();
      const moveResponse = await fetch(`/api/ecos/${eco.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: newFolder.id }),
      });
      if (!moveResponse.ok) throw new Error("Erreur lors du déplacement de l'ECO");
      window.dispatchEvent(new Event("folders-updated"));
      window.dispatchEvent(new Event("eco-updated"));
      setIsCreatingFolder(false);
      setNewFolderName("");
      onUpdate?.();
    } catch {
      toast.error("Erreur lors de la création du dossier.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateFolderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleCreateFolder(); }
    else if (e.key === "Escape") { setIsCreatingFolder(false); setNewFolderName(""); }
  };

  useEffect(() => {
    if (isCreatingFolder && folderInputRef.current) folderInputRef.current.focus();
  }, [isCreatingFolder]);

  const handleArchive = async () => {
    try {
      const response = await fetch(`/api/ecos/${eco.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      if (!response.ok) throw new Error("Erreur lors de l'archivage");
      window.dispatchEvent(new Event("eco-updated"));
      onUpdate?.();
      onDelete?.();
    } catch {
      toast.error("Erreur lors de l'archivage de l'ECO.");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/ecos/${eco.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Erreur lors de la suppression");
      window.dispatchEvent(new Event("eco-updated"));
      onDelete?.();
      setShowDeleteDialog(false);
    } catch {
      toast.error("Erreur lors de la suppression de l'ECO.");
    } finally {
      setIsDeleting(false);
    }
  };

  const inputDarkStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#EDECE8",
    borderRadius: 8,
    padding: "4px 8px",
    fontSize: 13,
    outline: "none",
    width: "100%",
  };

  const moveToFolderSubmenu = [
    ...(isCreatingFolder
      ? [{
          label: "",
          onClick: undefined,
          customContent: (
            <div className="px-3 py-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <FolderPlus className="w-4 h-4 shrink-0" style={{ color: "rgba(237,236,232,0.5)" }} />
              <input
                ref={folderInputRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={handleCreateFolderKeyDown}
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
                style={inputDarkStyle}
                onClick={(e) => e.stopPropagation()}
              />
              {isCreating && (
                <div
                  className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin shrink-0"
                  style={{ borderColor: "rgba(139,92,246,0.6)", borderTopColor: "transparent" }}
                />
              )}
            </div>
          ),
        }]
      : [{
          label: "Nouveau dossier…",
          onClick: async () => { setIsCreatingFolder(true); },
          icon: <FolderPlus className="w-4 h-4" />,
        }]
    ),
    ...(eco.folder ? [{ label: "Aucun dossier", onClick: () => handleMoveToFolder(null) }] : []),
    ...folders
      .filter((f) => f.id !== eco.folder)
      .map((folder) => ({
        label: folder.name,
        onClick: () => handleMoveToFolder(folder.id),
      })),
  ];

  const menuItems = [
    { label: "Renommer", onClick: () => { setIsRenaming(true); } },
    { label: "Déplacer vers…", submenu: moveToFolderSubmenu },
    { label: "Archiver", onClick: handleArchive, icon: <Archive className="w-4 h-4" /> },
    { label: "Supprimer", onClick: () => setShowDeleteDialog(true), danger: true },
  ];

  return (
    <>
      <motion.div
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        className="group relative w-full text-left px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2"
        style={{
          background: isSelected ? "rgba(139,92,246,0.12)" : "transparent",
          borderLeft: isSelected ? "2px solid rgba(139,92,246,0.4)" : "2px solid transparent",
        }}
        onMouseEnter={e => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
        }}
        onMouseLeave={e => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <div className="flex-1 flex flex-col gap-0.5 min-w-0" onClick={() => onSelect(eco)}>
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleRenameKeyDown}
              style={inputDarkStyle}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="font-medium text-sm truncate" style={{ color: isSelected ? "#EDECE8" : "rgba(237,236,232,0.75)" }}>
              {eco.title}
            </span>
          )}
          <div className="flex items-center gap-1 text-xs flex-wrap" style={{ color: "rgba(237,236,232,0.3)" }}>
            <span>
              {new Date(eco.created_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            {eco.duration_seconds != null && eco.duration_seconds > 0 && (
              <>
                <span style={{ color: "rgba(237,236,232,0.15)" }}>·</span>
                <span>{Math.max(1, Math.round(eco.duration_seconds / 60))} min</span>
              </>
            )}
            {eco.source_type === "screen" ? (
              <>
                <span style={{ color: "rgba(237,236,232,0.15)" }}>·</span>
                <Monitor className="w-3 h-3 shrink-0" />
              </>
            ) : (
              <>
                <span style={{ color: "rgba(237,236,232,0.15)" }}>·</span>
                <Mic className="w-3 h-3 shrink-0" />
              </>
            )}
            {eco.summary_text && (() => {
              try {
                const parsed = JSON.parse(eco.summary_text);
                const words = parsed?.resume?.trim().split(/\s+/).filter(Boolean).length ?? 0;
                return words > 0 ? (
                  <>
                    <span style={{ color: "rgba(237,236,232,0.15)" }}>·</span>
                    <span>{words} mots</span>
                  </>
                ) : null;
              } catch { return null; }
            })()}
            {eco.has_pdf_context && (
              <>
                <span style={{ color: "rgba(237,236,232,0.15)" }}>·</span>
                <FileText className="w-3 h-3 shrink-0" style={{ color: "#A78BFA" }} />
              </>
            )}
          </div>
        </div>
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu items={menuItems} align="right">
            <button
              className="p-1 rounded-lg transition-colors focus:outline-none"
              style={{ color: "rgba(237,236,232,0.35)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              aria-label="Menu d'actions"
            >
              <MoreHorizontal className="w-4 h-4" />
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
            className="px-4 py-2 text-sm font-medium rounded-xl transition-all disabled:opacity-50"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(237,236,232,0.7)",
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
            style={{
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#EF4444",
            }}
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
