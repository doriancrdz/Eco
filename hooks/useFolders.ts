"use client";

import { useEffect, useState } from "react";
import type { Folder } from "@/types";

// Cache partagé : une seule requête /api/folders pour toute l'app, au lieu d'une par ligne de la sidebar.
let cache: Folder[] | null = null;
let inflight: Promise<Folder[]> | null = null;
const listeners = new Set<(folders: Folder[]) => void>();

async function fetchFolders(): Promise<Folder[]> {
  if (!inflight) {
    inflight = fetch("/api/folders")
      .then((res) => (res.ok ? res.json() : { folders: [] }))
      .then((data) => (data.folders as Folder[]) || [])
      .catch(() => [] as Folder[])
      .then((folders) => {
        cache = folders;
        listeners.forEach((l) => l(folders));
        return folders;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

let eventBound = false;
function bindRefreshEvent() {
  if (eventBound || typeof window === "undefined") return;
  eventBound = true;
  window.addEventListener("folders-updated", () => {
    fetchFolders();
  });
}

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>(cache ?? []);
  const [isLoading, setIsLoading] = useState(cache === null);

  useEffect(() => {
    bindRefreshEvent();
    const listener = (next: Folder[]) => {
      setFolders(next);
      setIsLoading(false);
    };
    listeners.add(listener);
    if (cache === null) fetchFolders();
    else setIsLoading(false);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { folders, isLoading };
}
