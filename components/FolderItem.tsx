"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Folder, ChevronRight } from "lucide-react";
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
      toast.success("Matière renommée");
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
      toast.error(error instanceof Error ? error.message : "Erreur lors de la suppression de la matière.");
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
      <div className="group app-row !py-0 pr-1" style={{ minHeight: 32 }}>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left" onClick={onToggle} aria-expanded={isExpanded}>
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
            style={{ transform: isExpanded ? "rotate(90deg)" : "none", color: "#6E6C68" }}
          />
          <Folder className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: "#8A8782" }} />
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded-md px-2 py-0.5 text-[13.5px] outline-none"
              style={{ background: "#1A1A1D", border: "1px solid rgba(201,184,255,0.4)", color: "#EDECE8" }}
            />
          ) : (
            <span className="truncate">{folder.name}</span>
          )}
        </button>
        {!isDefault && (
          <div className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu items={menuItems} align="right" triggerClassName="app-icon-btn app-icon-btn-sm">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenu>
          </div>
        )}
      </div>

      <Dialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Supprimer cette matière ?"
        description="Les cours de cette matière ne sont pas supprimés : ils restent accessibles dans Tous mes cours."
      >
        <div className="flex gap-3 justify-end mt-6">
          <button onClick={() => setShowDeleteDialog(false)} disabled={isDeleting} className="app-btn app-btn-ghost">
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
