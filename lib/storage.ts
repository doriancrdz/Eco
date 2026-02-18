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
  const idx = ecos.findIndex((e) => e.id === eco.id);
  if (idx >= 0) {
    ecos[idx] = eco;
  } else {
    ecos.push(eco);
  }
  localStorage.setItem(STORAGE_KEY_ECOS, JSON.stringify(ecos));
}

export function updateEco(ecoId: string, updates: Partial<Eco>): void {
  if (typeof window === "undefined") return;
  const ecos = getEcos();
  const idx = ecos.findIndex((e) => e.id === ecoId);
  if (idx >= 0) {
    ecos[idx] = { ...ecos[idx], ...updates };
    localStorage.setItem(STORAGE_KEY_ECOS, JSON.stringify(ecos));
  }
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

export function deleteEco(ecoId: string): void {
  if (typeof window === "undefined") return;
  const ecos = getEcos();
  const filtered = ecos.filter((e) => e.id !== ecoId);
  localStorage.setItem(STORAGE_KEY_ECOS, JSON.stringify(filtered));
}

export function saveFolder(folder: Folder): void {
  if (typeof window === "undefined") return;
  const folders = getFolders();
  const idx = folders.findIndex((f) => f.id === folder.id);
  if (idx >= 0) {
    folders[idx] = folder;
  } else {
    folders.push(folder);
  }
  localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
  window.dispatchEvent(new Event("folders-updated"));
}
