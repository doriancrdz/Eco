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
  customContent?: React.ReactNode;
  icon?: React.ReactNode;
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

  const calculateMenuPosition = () => {
    if (!triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = items.length * 40 + 16;
    const gap = 8;
    let left: number;
    if (align === "right") {
      left = rect.right - menuWidth;
      if (left < 8) left = window.innerWidth - menuWidth - 8;
    } else {
      left = rect.left;
      if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
    }
    let top = rect.bottom + gap;
    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - gap;
      if (top < 8) top = 8;
    }
    return { top, left };
  };

  const calculateSubmenuPosition = (index: number) => {
    if (!menuRef.current) return null;
    const menuRect = menuRef.current.getBoundingClientRect();
    const submenuWidth = 180;
    const gap = 4;
    const itemHeight = 40;
    const itemTop = menuRect.top + index * itemHeight + 4;
    let left = menuRect.right + gap;
    if (left + submenuWidth > window.innerWidth - 8) left = menuRect.left - submenuWidth - gap;
    let top = itemTop;
    const estimatedSubmenuHeight = (items[index]?.submenu?.length || 0) * 40 + 16;
    if (top + estimatedSubmenuHeight > window.innerHeight - 8) {
      top = window.innerHeight - estimatedSubmenuHeight - 8;
    }
    return { top, left };
  };

  const handleOpen = () => {
    setIsOpen(true);
    requestAnimationFrame(() => {
      const pos = calculateMenuPosition();
      if (pos) setMenuPosition(pos);
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    setSubmenuOpen(null);
    setMenuPosition(null);
    setSubmenuPosition(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent | MouseEvent) => {
      if (!isOpen) return;
      const target = event.target as Node;
      const isClickInMenu = menuRef.current?.contains(target);
      const isClickInSubmenu = submenuRef.current?.contains(target);
      const isClickInTrigger = triggerRef.current?.contains(target);
      const isInputInSubmenu = target instanceof HTMLInputElement && submenuRef.current?.contains(target);
      if (!isClickInMenu && !isClickInSubmenu && !isClickInTrigger && !isInputInSubmenu) handleClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) handleClose();
    };
    if (isOpen) {
      document.addEventListener("pointerdown", handleClickOutside, { capture: true });
      document.addEventListener("mousedown", handleClickOutside, { capture: true });
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside, { capture: true });
      document.removeEventListener("mousedown", handleClickOutside, { capture: true });
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = () => handleClose();
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen]);

  const handleSubmenuOpen = (index: number) => {
    setSubmenuOpen(index);
    requestAnimationFrame(() => {
      const pos = calculateSubmenuPosition(index);
      if (pos) setSubmenuPosition(pos);
    });
  };

  const handleItemClick = async (item: DropdownMenuItem) => {
    if (item.submenu) return;
    if (item.onClick) {
      try { await item.onClick(); } catch { /* silent */ }
    }
    handleClose();
  };

  const handleSubmenuItemClick = async (subItem: DropdownMenuItem) => {
    if (subItem.onClick) {
      try {
        await subItem.onClick();
        if (!subItem.label.includes("Nouveau dossier")) handleClose();
      } catch { /* silent */ }
    } else {
      handleClose();
    }
  };

  const menuPanelStyle = {
    background: "#141619",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
    borderRadius: 14,
    overflow: "hidden",
  };

  const itemBase = "w-full text-left px-4 py-2 text-sm transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) handleClose(); else handleOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (isOpen) handleClose(); else handleOpen();
          }
        }}
        className="focus:outline-none rounded-lg p-1"
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
                {/* Main menu */}
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, scale: 0.95, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -6 }}
                  transition={{ duration: 0.14 }}
                  className="fixed z-[9999] min-w-[220px] pointer-events-auto"
                  style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
                >
                  <div style={menuPanelStyle}>
                    <div className="py-1.5">
                      {items.map((item, index) => (
                        <div key={index}>
                          {item.submenu ? (
                            <div
                              className="relative"
                              onMouseEnter={() => handleSubmenuOpen(index)}
                              onMouseLeave={(e) => {
                                const relatedTarget = e.relatedTarget as Node | null;
                                if (submenuRef.current && relatedTarget && submenuRef.current.contains(relatedTarget)) return;
                                setTimeout(() => {
                                  if (submenuOpen === index) {
                                    const isHoveringSubmenu = submenuRef.current?.matches(":hover") ||
                                      document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-submenu]');
                                    if (!isHoveringSubmenu) setSubmenuOpen(null);
                                  }
                                }, 150);
                              }}
                            >
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSubmenuOpen(index); }}
                                className={`${itemBase} flex items-center justify-between`}
                                style={{ color: "rgba(237,236,232,0.75)" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                disabled={item.disabled}
                              >
                                <span>{item.label}</span>
                                <ChevronRight className="w-4 h-4" style={{ color: "rgba(237,236,232,0.35)" }} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                              className={itemBase}
                              style={{
                                color: item.danger ? "rgba(239,68,68,0.8)" : "rgba(237,236,232,0.75)",
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = item.danger ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.07)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
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

                {/* Submenu */}
                {submenuOpen !== null && submenuPosition && items[submenuOpen]?.submenu && (
                  <motion.div
                    ref={submenuRef}
                    data-submenu
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.13 }}
                    className="fixed z-[10000] min-w-[180px] pointer-events-auto"
                    style={{ top: `${submenuPosition.top}px`, left: `${submenuPosition.left}px` }}
                    onMouseEnter={() => { if (submenuOpen !== null) setSubmenuOpen(submenuOpen); }}
                    onMouseLeave={(e) => {
                      const relatedTarget = e.relatedTarget as Node | null;
                      if (menuRef.current && relatedTarget && menuRef.current.contains(relatedTarget)) return;
                      setSubmenuOpen(null);
                    }}
                  >
                    <div style={menuPanelStyle}>
                      <div className="py-1.5">
                        {items[submenuOpen].submenu!.map((subItem, subIndex) => {
                          if (subItem.customContent) {
                            return (
                              <div key={subIndex} onClick={(e) => e.stopPropagation()}>
                                {subItem.customContent}
                              </div>
                            );
                          }
                          return (
                            <button
                              key={subIndex}
                              onClick={(e) => { e.stopPropagation(); handleSubmenuItemClick(subItem); }}
                              className={`${itemBase} flex items-center gap-2`}
                              style={{
                                color: subItem.danger ? "rgba(239,68,68,0.8)" : "rgba(237,236,232,0.75)",
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = subItem.danger ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.07)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              disabled={subItem.disabled}
                            >
                              {subItem.icon && <span className="shrink-0" style={{ color: "rgba(237,236,232,0.5)" }}>{subItem.icon}</span>}
                              <span>{subItem.label}</span>
                            </button>
                          );
                        })}
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
