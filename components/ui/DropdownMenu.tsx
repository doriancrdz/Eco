"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface DropdownMenuItem {
  label: string;
  onClick?: () => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
  submenu?: DropdownMenuItem[];
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  children: React.ReactNode;
  align?: "left" | "right";
}

export default function DropdownMenu({ items, children, align = "right" }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Calculer la position du menu principal
  const calculateMenuPosition = () => {
    if (!triggerRef.current) return null;

    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = items.length * 40 + 16; // Estimation approximative
    const gap = 8;

    let left: number;
    if (align === "right") {
      left = rect.right - menuWidth;
      // Si le menu dépasse à gauche, le coller à droite de l'écran
      if (left < 8) {
        left = window.innerWidth - menuWidth - 8;
      }
    } else {
      left = rect.left;
      // Si le menu dépasse à droite, le coller à gauche de l'écran
      if (left + menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - menuWidth - 8;
      }
    }

    let top = rect.bottom + gap;
    // Si le menu dépasse en bas, l'ouvrir vers le haut
    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - gap;
      // Si ça dépasse toujours en haut, le coller en haut
      if (top < 8) {
        top = 8;
      }
    }

    return { top, left };
  };

  // Calculer la position du sous-menu
  const calculateSubmenuPosition = (index: number) => {
    if (!menuRef.current) return null;

    const menuRect = menuRef.current.getBoundingClientRect();
    const submenuWidth = 180;
    const gap = 4;
    const itemHeight = 40;
    const itemTop = menuRect.top + index * itemHeight + 4;

    let left = menuRect.right + gap;
    // Si le sous-menu dépasse à droite, l'ouvrir à gauche
    if (left + submenuWidth > window.innerWidth - 8) {
      left = menuRect.left - submenuWidth - gap;
    }

    let top = itemTop;
    // Si le sous-menu dépasse en bas, ajuster vers le haut
    const estimatedSubmenuHeight = (items[index]?.submenu?.length || 0) * 40 + 16;
    if (top + estimatedSubmenuHeight > window.innerHeight - 8) {
      top = window.innerHeight - estimatedSubmenuHeight - 8;
    }

    return { top, left };
  };

  // Ouvrir le menu et calculer la position
  const handleOpen = () => {
    setIsOpen(true);
    // Attendre le prochain frame pour que le menu soit rendu
    requestAnimationFrame(() => {
      const pos = calculateMenuPosition();
      if (pos) {
        setMenuPosition(pos);
      }
    });
  };

  // Fermer le menu
  const handleClose = () => {
    setIsOpen(false);
    setSubmenuOpen(null);
    setMenuPosition(null);
    setSubmenuPosition(null);
  };

  // Gérer les clics extérieurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(target) &&
        submenuRef.current &&
        !submenuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        handleClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // Gérer le scroll pour fermer le menu
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => {
      handleClose();
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen]);

  // Ouvrir le sous-menu et calculer sa position
  const handleSubmenuOpen = (index: number) => {
    setSubmenuOpen(index);
    requestAnimationFrame(() => {
      const pos = calculateSubmenuPosition(index);
      if (pos) {
        setSubmenuPosition(pos);
      }
    });
  };

  // Gérer le clic sur un item
  const handleItemClick = async (item: DropdownMenuItem) => {
    if (item.submenu) {
      // Ne pas fermer si sous-menu
      return;
    }
    if (item.onClick) {
      try {
        await item.onClick();
      } catch (error) {
        console.error("Erreur dans onClick:", error);
      }
    }
    handleClose();
  };

  // Gérer le clic sur un item de sous-menu
  const handleSubmenuItemClick = async (subItem: DropdownMenuItem) => {
    if (subItem.onClick) {
      try {
        await subItem.onClick();
      } catch (error) {
        console.error("Erreur dans onClick:", error);
      }
    }
    handleClose();
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) {
            handleClose();
          } else {
            handleOpen();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (isOpen) {
              handleClose();
            } else {
              handleOpen();
            }
          }
        }}
        className="focus:outline-none focus:ring-2 focus:ring-white/40 rounded-lg p-1"
        aria-label="Menu d'actions"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {children}
      </button>

      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && menuPosition && (
              <>
                {/* Menu principal */}
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="fixed z-[9999] min-w-[220px] pointer-events-auto"
                  style={{
                    top: `${menuPosition.top}px`,
                    left: `${menuPosition.left}px`,
                  }}
                >
                  <div className="bg-white/20 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl ring-1 ring-white/10 overflow-hidden">
                    <div className="py-1">
                      {items.map((item, index) => (
                        <div key={index}>
                          {item.submenu ? (
                            <div
                              className="relative"
                              onMouseEnter={() => handleSubmenuOpen(index)}
                              onMouseLeave={(e) => {
                                // Vérifier si on survole le sous-menu avant de fermer
                                const relatedTarget = e.relatedTarget as Node | null;
                                if (submenuRef.current && relatedTarget && submenuRef.current.contains(relatedTarget)) {
                                  return; // On survole le sous-menu, ne pas fermer
                                }
                                // Petit délai pour permettre le passage vers le sous-menu
                                setTimeout(() => {
                                  if (submenuOpen === index) {
                                    const isHoveringSubmenu = submenuRef.current?.matches(":hover") || 
                                      document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-submenu]');
                                    if (!isHoveringSubmenu) {
                                      setSubmenuOpen(null);
                                    }
                                  }
                                }, 150);
                              }}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSubmenuOpen(index);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleSubmenuOpen(index);
                                  }
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-white/30 transition-colors flex items-center justify-between focus:outline-none focus:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={item.disabled}
                              >
                                <span>{item.label}</span>
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleItemClick(item);
                                }
                              }}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors focus:outline-none focus:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed ${
                                item.danger
                                  ? "text-red-600 hover:bg-red-500/20 hover:text-red-700"
                                  : "text-gray-800 hover:bg-white/30"
                              }`}
                              disabled={item.disabled}
                            >
                              {item.label}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Sous-menu */}
                {submenuOpen !== null && submenuPosition && items[submenuOpen]?.submenu && (
                  <motion.div
                    ref={submenuRef}
                    data-submenu
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                    className="fixed z-[10000] min-w-[180px] pointer-events-auto"
                    style={{
                      top: `${submenuPosition.top}px`,
                      left: `${submenuPosition.left}px`,
                    }}
                    onMouseEnter={() => {
                      // Garder le sous-menu ouvert quand on survole
                      if (submenuOpen !== null) {
                        setSubmenuOpen(submenuOpen);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Vérifier si on survole le menu principal avant de fermer
                      const relatedTarget = e.relatedTarget as Node | null;
                      if (menuRef.current && relatedTarget && menuRef.current.contains(relatedTarget)) {
                        return; // On survole le menu principal, ne pas fermer
                      }
                      setSubmenuOpen(null);
                    }}
                  >
                    <div className="bg-white/20 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl ring-1 ring-white/10 overflow-hidden">
                      <div className="py-1">
                        {items[submenuOpen].submenu!.map((subItem, subIndex) => (
                          <button
                            key={subIndex}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubmenuItemClick(subItem);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleSubmenuItemClick(subItem);
                              }
                            }}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors focus:outline-none focus:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed ${
                              subItem.danger
                                ? "text-red-600 hover:bg-red-500/20 hover:text-red-700"
                                : "text-gray-800 hover:bg-white/30"
                            }`}
                            disabled={subItem.disabled}
                          >
                            {subItem.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
