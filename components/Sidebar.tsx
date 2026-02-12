"use client";

import { useState, useEffect } from "react";
import { Folder, Eco, DEFAULT_FOLDERS } from "@/types";
import { getFolders, getEcosByFolder, getEcos } from "@/lib/storage";
import { FolderIcon, Mic } from "lucide-react";
import { motion } from "framer-motion";

interface SidebarProps {
  selectedFolder: string | null;
  onSelectFolder: (folderId: string | null) => void;
  selectedEco: string | null;
  onSelectEco: (ecoId: string | null) => void;
}

export default function Sidebar({
  selectedFolder,
  onSelectFolder,
  selectedEco,
  onSelectEco,
}: SidebarProps) {
  const [folders, setFolders] = useState<Folder[]>(DEFAULT_FOLDERS);
  const [ecosByFolder, setEcosByFolder] = useState<Record<string, Eco[]>>({});

  const loadData = () => {
    const loadedFolders = getFolders();
    setFolders(loadedFolders);

    const ecosMap: Record<string, Eco[]> = {};
    loadedFolders.forEach((folder) => {
      ecosMap[folder.id] = getEcosByFolder(folder.id);
    });
    setEcosByFolder(ecosMap);
  };

  const hasAnyEco = () => {
    const allEcos = getEcos();
    return allEcos.length > 0;
  };

  useEffect(() => {
    loadData();

    // Écouter les changements de stockage
    const handleStorageChange = () => {
      loadData();
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Écouter un événement personnalisé pour les changements dans le même onglet
    window.addEventListener("eco-updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("eco-updated", handleStorageChange);
    };
  }, []);

  return (
    <div className="w-72 glass-panel rounded-r-3xl mr-6 h-full flex flex-col shadow-glass hidden md:flex">
      <div className="p-8 border-b border-white/20">
        <h1 className="text-2xl font-semibold text-gray-800 tracking-tight">ECO</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {folders.map((folder, index) => {
          const ecos = ecosByFolder[folder.id] || [];
          const isSelected = selectedFolder === folder.id;

          return (
            <div key={folder.id}>
              {index > 0 && <div className="h-px bg-white/10 mb-4"></div>}
              <div className="space-y-2">
                <motion.button
                  whileHover={{ x: 1 }}
                  whileTap={{ x: 0 }}
                  onClick={() => onSelectFolder(isSelected ? null : folder.id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 transition-all duration-300 ${
                    isSelected
                      ? "bg-gradient-to-r from-white/70 to-white/50 text-gray-900 shadow-md backdrop-blur-sm border border-white/30"
                      : "text-gray-600 hover:bg-white/25 hover:text-gray-800"
                  }`}
                >
                  <FolderIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 font-medium">{folder.name}</span>
                  <span className={`text-sm px-2 py-0.5 rounded-full transition-all ${
                    isSelected 
                      ? "bg-white/60 text-gray-700" 
                      : "bg-white/30 text-gray-500"
                  }`}>{ecos.length}</span>
                </motion.button>

                {isSelected && ecos.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="ml-6 space-y-1.5 pt-2"
                  >
                    {ecos.map((eco) => (
                      <motion.button
                        key={eco.id}
                        whileHover={{ x: 2 }}
                        whileTap={{ x: 0 }}
                        onClick={() => onSelectEco(eco.id)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all duration-300 flex items-center gap-2.5 ${
                          selectedEco === eco.id
                            ? "bg-gradient-to-r from-gray-800 to-gray-700 text-white shadow-lg border border-gray-700/50"
                            : "text-gray-600 hover:bg-white/25 hover:text-gray-800"
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{eco.title}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          );
        })}
        
        {!hasAnyEco() && (
          <div className="mt-12 px-4 pt-6 border-t border-white/10">
            <p className="text-gray-500 text-sm text-center leading-relaxed">Aucun Eco pour l&apos;instant</p>
          </div>
        )}
      </div>
    </div>
  );
}
