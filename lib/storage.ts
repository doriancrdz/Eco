import { Eco, Folder, DEFAULT_FOLDERS } from "@/types";

const STORAGE_KEY_ECOS = "eco_recordings";
const STORAGE_KEY_FOLDERS = "eco_folders";

export function getEcos(): Eco[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY_ECOS);
  return stored ? JSON.parse(stored) : [];
}

export function saveEco(eco: Eco): void {
  if (typeof window === "undefined") return;
  const ecos = getEcos();
  ecos.push(eco);
  localStorage.setItem(STORAGE_KEY_ECOS, JSON.stringify(ecos));
}

export function getEcoById(id: string): Eco | undefined {
  const ecos = getEcos();
  return ecos.find((eco) => eco.id === id);
}

export function getFolders(): Folder[] {
  if (typeof window === "undefined") return DEFAULT_FOLDERS;
  const stored = localStorage.getItem(STORAGE_KEY_FOLDERS);
  return stored ? JSON.parse(stored) : DEFAULT_FOLDERS;
}

export function getEcosByFolder(folderId: string): Eco[] {
  const ecos = getEcos();
  return ecos.filter((eco) => eco.folder === folderId);
}
