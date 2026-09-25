"use client";

import { Star } from "lucide-react";
import Image from "next/image";

interface Testimonial {
  id: string;
  name: string;
  stars: number;
  text: string;
  avatarSrc?: string;
}

const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "Thomas L.",
    stars: 5,
    text: "Depuis que j'utilise ECO, je n'ai plus peur de rater une info en cours. Au lieu de me concentrer à prendre des notes, je lance un enregistrement et ECO se charge de me sortir tout ce qui est important à retenir du cours.",
    avatarSrc: "/avatars/thomas-l.jpg",
  },
  {
    id: "2",
    name: "Sofia M.",
    stars: 4,
    text: "L'application est super pratique pour réviser rapidement avant un examen. Les notions à retenir sont vraiment utiles. Peut-être ajouter un mode \"révision rapide\" encore plus synthétique serait top, mais globalement je recommande.",
    avatarSrc: "/avatars/sofia-m.jpg",
  },
  {
    id: "3",
    name: "Thibault V.",
    stars: 5,
    text: "J'enregistre mes réunions et ECO me sort un résumé clair avec les actions à retenir. Je suis beaucoup plus organisé et je ne perds plus d'idées importantes.",
    avatarSrc: "/avatars/thibault-v.jpg",
  },
  {
    id: "4",
    name: "Élise V.",
    stars: 5,
    text: "Mon fils écoute beaucoup plus en cours et révise plus efficacement depuis que je lui paye ECO. C'est rassurant de savoir qu'il peut revoir les notions importantes après.",
    avatarSrc: "/avatars/elise-v.jpg",
  },
  {
    id: "5",
    name: "Léa M.",
    stars: 4,
    text: "Très bonne application, surtout pour les étudiants. La transcription est fiable et les résumés sont clairs. J'aimerais juste une option pour exporter directement vers Notion ou Google Docs, mais sinon rien à redire.",
    avatarSrc: "/avatars/lea-m.jpg",
  },
  {
    id: "6",
    name: "Lucas M.",
    stars: 5,
    text: "J'utilise ECO tous les jours en amphi. Le fait d'avoir un résumé structuré et les points essentiels me fait gagner un temps fou en période de partiels.",
    avatarSrc: "/avatars/lucas-m.jpg",
  },
  {
    id: "7",
    name: "Daniel C.",
    stars: 5,
    text: "ECO m'a vraiment aidé à rester concentré en cours. Le fait d'avoir les points clés automatiquement change tout. J'aimerais juste pouvoir personnaliser un peu plus la mise en forme des résumés, mais sinon c'est devenu indispensable pour moi.",
    avatarSrc: "/avatars/daniel-c.jpg",
  },
  {
    id: "8",
    name: "Camille L.",
    stars: 5,
    text: "La transcription est hyper propre, mais surtout les points clés me sauvent la vie. Au lieu de relire 15 pages de notes, j'ai l'essentiel en quelques secondes.",
    avatarSrc: "/avatars/camille-l.jpg",
  },
  {
    id: "9",
    name: "Adrien R.",
    stars: 5,
    text: "Je l'utilise pour mes réunions clients et ça m'évite de perdre des informations importantes. Le résumé structuré est clair et bien organisé. C'est simple et efficace.",
    avatarSrc: "/avatars/adrien-r.jpg",
  },
  {
    id: "10",
    name: "Mathieu C.",
    stars: 4,
    text: "Je prends moins de notes pendant les formations et je suis plus concentré. Le résumé généré est souvent plus clair que mes propres notes. Une petite option de personnalisation supplémentaire serait un plus.",
    avatarSrc: "/avatars/mathieu-c.jpg",
  },
  {
    id: "11",
    name: "Sophie L.",
    stars: 5,
    text: "Les notions à retenir sont incroyables. Ça m'aide à structurer mes cours et à voir directement ce qui est vraiment important pour les examens.",
    avatarSrc: "/avatars/sophie-l.jpg",
  },
  {
    id: "12",
    name: "Hugo M.",
    stars: 5,
    text: "Ce que j'aime, c'est la simplicité. J'enregistre, et tout est organisé automatiquement. Ça me permet de rester focus pendant mes rendez-vous sans penser à écrire.",
    avatarSrc: "/avatars/hugo-m.jpg",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="mk-card flex h-full w-[340px] shrink-0 flex-col p-6 md:w-[400px]">
      <div className="flex gap-0.5" aria-label={`${testimonial.stars} étoiles sur 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className="h-3.5 w-3.5"
            fill={i < testimonial.stars ? "#E8D9A8" : "transparent"}
            stroke={i < testimonial.stars ? "none" : "#4A4845"}
          />
        ))}
      </div>
      <blockquote className="mt-4 flex-1 text-[14.5px] leading-relaxed" style={{ color: "#C9C6C0" }}>
        «&nbsp;{testimonial.text}&nbsp;»
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        {testimonial.avatarSrc ? (
          <Image
            src={testimonial.avatarSrc}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover"
            sizes="32px"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-[12px]" style={{ background: "var(--mk-surface-2)", color: "var(--mk-muted)" }}>
            {initials(testimonial.name)}
          </span>
        )}
        <span className="text-[14px] font-medium" style={{ color: "var(--mk-text)" }}>
          {testimonial.name}
        </span>
      </figcaption>
    </figure>
  );
}

export default function TestimonialsMarquee() {
  const loop = [...testimonials, ...testimonials];
  return (
    <div
      className="w-full overflow-hidden py-2"
      style={{
        maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      }}
    >
      <div className="marquee-container flex items-stretch gap-5" style={{ width: "fit-content" }}>
        {loop.map((t, i) => (
          <TestimonialCard key={`${t.id}-${i}`} testimonial={t} />
        ))}
      </div>
    </div>
  );
}
