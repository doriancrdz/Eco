"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface DropdownMenuItem {
  label: string;
  onClick?: () => void;
  danger?: boolean;
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
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSubmenuOpen(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSubmenuOpen(null);
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

  const handleItemClick = (item: DropdownMenuItem) => {
    if (item.submenu) {
      // Ne pas fermer si sous-menu
      return;
    }
    if (item.onClick) {
      item.onClick();
    }
    setIsOpen(false);
    setSubmenuOpen(null);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className="focus:outline-none focus:ring-2 focus:ring-white/40 rounded-lg p-1"
        aria-label="Menu d'actions"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {children}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 mt-1 min-w-[180px] ${
              align === "right" ? "right-0" : "left-0"
            }`}
            style={{ top: "100%" }}
          >
            <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl shadow-glass overflow-hidden">
              <div className="py-1">
                {items.map((item, index) => (
                  <div key={index}>
                    {item.submenu ? (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubmenuOpen(submenuOpen === index ? null : index);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSubmenuOpen(submenuOpen === index ? null : index);
                            }
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-white/20 transition-colors flex items-center justify-between focus:outline-none focus:bg-white/20"
                        >
                          <span>{item.label}</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                          {submenuOpen === index && (
                            <motion.div
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -8 }}
                              transition={{ duration: 0.15 }}
                              className="absolute left-full top-0 ml-1 min-w-[160px] bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl shadow-glass overflow-hidden"
                            >
                              <div className="py-1">
                                {item.submenu.map((subItem, subIndex) => (
                                  <button
                                    key={subIndex}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleItemClick(subItem);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        handleItemClick(subItem);
                                      }
                                    }}
                                    className={`w-full text-left px-4 py-2 text-sm transition-colors focus:outline-none focus:bg-white/20 ${
                                      subItem.danger
                                        ? "text-red-600 hover:bg-red-500/20"
                                        : "text-gray-800 hover:bg-white/20"
                                    }`}
                                  >
                                    {subItem.label}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
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
                        className={`w-full text-left px-4 py-2 text-sm transition-colors focus:outline-none focus:bg-white/20 ${
                          item.danger
                            ? "text-red-600 hover:bg-red-500/20"
                            : "text-gray-800 hover:bg-white/20"
                        }`}
                      >
                        {item.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
