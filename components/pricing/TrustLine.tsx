import { CreditCard, Lock, RotateCcw } from "lucide-react";

const ITEMS = [
  { icon: CreditCard, label: "Paiement sécurisé par Stripe", description: "Tes coordonnées bancaires ne transitent jamais par nos serveurs." },
  { icon: RotateCcw, label: "Mensuel sans engagement", description: "Résiliable à tout moment depuis tes paramètres." },
  { icon: Lock, label: "Audio supprimé après transcription", description: "Tes fiches restent privées, visibles par toi seul." },
];

export default function TrustLine() {
  return (
    <div
      className="grid overflow-hidden rounded-[20px] border md:grid-cols-3"
      style={{ borderColor: "var(--mk-line)", background: "var(--mk-line)", gap: "1px" }}
    >
      {ITEMS.map(({ icon: Icon, label, description }) => (
        <div key={label} className="flex gap-4 p-6" style={{ background: "var(--mk-bg)" }}>
          <Icon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.6} style={{ color: "var(--mk-lilac)" }} />
          <div>
            <p className="text-[14.5px] font-medium" style={{ color: "var(--mk-text)" }}>
              {label}
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
              {description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
