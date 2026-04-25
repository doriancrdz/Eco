"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export default function Dialog({ open, onOpenChange, title, description, children }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              ref={dialogRef}
              initial={{ opacity: 0, scale: 0.93, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 8 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="max-w-md w-full rounded-2xl p-6"
              style={{
                background: "#141619",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 32px 64px rgba(0,0,0,0.7)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: "#EDECE8" }}>{title}</h2>
                  {description && (
                    <p className="text-sm mt-1" style={{ color: "rgba(237,236,232,0.5)" }}>{description}</p>
                  )}
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="transition-colors focus:outline-none rounded-lg p-1"
                  style={{ color: "rgba(237,236,232,0.35)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(237,236,232,0.7)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(237,236,232,0.35)")}
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
