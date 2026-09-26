"use client";

import { Check } from "lucide-react";
import Dialog from "@/components/ui/Dialog";

interface UpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  points: string[];
  ctaLabel: string;
  onCta: () => void;
}

export default function UpsellModal({ open, onOpenChange, title, description, points, ctaLabel, onCta }: UpsellModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <ul className="mt-2 space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-[14px]" style={{ color: "#C9C6C0" }}>
            <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#C9B8FF" }} />
            {p}
          </li>
        ))}
      </ul>
      <div className="mt-7 flex justify-end gap-2">
        <button type="button" onClick={() => onOpenChange(false)} className="app-btn app-btn-ghost">
          Plus tard
        </button>
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            onCta();
          }}
          className="app-btn app-btn-primary"
        >
          {ctaLabel}
        </button>
      </div>
    </Dialog>
  );
}
