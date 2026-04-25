"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Folder, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Folder as FolderType } from "@/types";
import DropdownMenu from "./ui/DropdownMenu";
import Dialog from "./ui/Dialog";
import { toast } from "sonner";

interface FolderItemProps {
  folder: FolderType;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate?: () => void;
}

export default function FolderItem({
  folder,
  isExpanded,
  onToggle,
  onUpdate,
}: FolderItemProps) {
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
    if (!isRenaming) setRenameValue(folder.name);
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
      if (!response.ok) throw new Error("Erreur lors du renommage");
      window.dispatchEvent(new Event("folders-updated"));
      onUpdate?.();
      setIsRenaming(false);
      toast.success("Dossier renommé");
    } catch {
      setRenameValue(folder.name);
      setIsRenaming(false);
      toast.error("Erreur lors du renommage.");
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleRename(); }
    else if (e.key === "Escape") { setRenameValue(folder.name); setIsRenaming(false); }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la suppression");
      }
      window.dispatchEvent(new Event("folders-updated"));
      window.dispatchEvent(new Event("eco-updated"));
      onUpdate?.();
      setShowDeleteDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la suppression du dossier.");
    } finally {
      setIsDeleting(false);
    }
  };

  const menuItems = [
    { label: "Renommer", onClick: () => { if (!isDefault) setIsRenaming(true); }, disabled: isDefault },
    { label: "Supprimer", onClick: () => setShowDeleteDialog(true), danger: true, disabled: isDefault },
  ];

  return (
    <>
      <motion.div
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
        className="group relative w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer"
        style={{ color: "rgba(237,236,232,0.65)" }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
          (e.currentTarget as HTMLElement).style.color = "rgba(237,236,232,0.9)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "rgba(237,236,232,0.65)";
        }}
      >
        <div className="flex-1 flex items-center gap-2 min-w-0" onClick={onToggle}>
          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5" style={{ color: "rgba(237,236,232,0.3)" }} />
          </motion.span>
          <Folder className="w-4 h-4 shrink-0" style={{ color: "rgba(237,236,232,0.4)" }} />
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded-lg px-2 py-0.5 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(139,92,246,0.3)",
                color: "#EDECE8",
              }}
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
              className="p-1 rounded-lg transition-colors focus:outline-none"
              style={{ color: "rgba(237,236,232,0.3)" }}
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
        title="Supprimer ce dossier ?"
        description="Les ECOs de ce dossier seront déplacés vers 'Aucun dossier'. Cette action est irréversible."
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
