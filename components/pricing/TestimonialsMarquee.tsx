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
  },
  {
    id: "2",
    name: "Sofia M.",
    stars: 4,
    text: "L'application est super pratique pour réviser rapidement avant un examen. Les notions à retenir sont vraiment utiles. Peut-être ajouter un mode \"révision rapide\" encore plus synthétique serait top, mais globalement je recommande.",
  },
  {
    id: "3",
    name: "Thibault V.",
    stars: 5,
    text: "J'enregistre mes réunions et ECO me sort un résumé clair avec les actions à retenir. Je suis beaucoup plus organisé et je ne perds plus d'idées importantes.",
  },
  {
    id: "4",
    name: "Élise V.",
    stars: 5,
    text: "Mon fils écoute beaucoup plus en cours et révise plus efficacement depuis que je lui paye ECO. C'est rassurant de savoir qu'il peut revoir les notions importantes après.",
  },
  {
    id: "5",
    name: "Léa M.",
    stars: 4,
    text: "Très bonne application, surtout pour les étudiants. La transcription est fiable et les résumés sont clairs. J'aimerais juste une option pour exporter directement vers Notion ou Google Docs, mais sinon rien à redire.",
  },
  {
    id: "6",
    name: "Lucas M.",
    stars: 5,
    text: "J'utilise ECO tous les jours en amphi. Le fait d'avoir un résumé structuré et les points essentiels me fait gagner un temps fou en période de partiels.",
  },
  {
    id: "7",
    name: "Daniel C.",
    stars: 5,
    text: "ECO m'a vraiment aidé à rester concentré en cours. Le fait d'avoir les points clés automatiquement change tout. J'aimerais juste pouvoir personnaliser un peu plus la mise en forme des résumés, mais sinon c'est devenu indispensable pour moi.",
  },
  {
    id: "8",
    name: "Camille L.",
    stars: 5,
    text: "La transcription est hyper propre, mais surtout les points clés me sauvent la vie. Au lieu de relire 15 pages de notes, j'ai l'essentiel en quelques secondes.",
  },
  {
    id: "9",
    name: "Adrien R.",
    stars: 5,
    text: "Je l'utilise pour mes réunions clients et ça m'évite de perdre des informations importantes. Le résumé structuré est clair et bien organisé. C'est simple et efficace.",
  },
  {
    id: "10",
    name: "Mathieu C.",
    stars: 4,
    text: "Je prends moins de notes pendant les formations et je suis plus concentré. Le résumé généré est souvent plus clair que mes propres notes. Une petite option de personnalisation supplémentaire serait un plus.",
  },
  {
    id: "11",
    name: "Sophie L.",
    stars: 5,
    text: "Les notions à retenir sont incroyables. Ça m'aide à structurer mes cours et à voir directement ce qui est vraiment important pour les examens.",
  },
  {
    id: "12",
    name: "Hugo M.",
    stars: 5,
    text: "Ce que j'aime, c'est la simplicité. J'enregistre, et tout est organisé automatiquement. Ça me permet de rester focus pendant mes rendez-vous sans penser à écrire.",
  },
];

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex-shrink-0 w-[380px] md:w-[420px]">
      <div className="testimonial-card-glass relative rounded-card p-6 hover:border-white/70 hover:shadow-xl transition-all duration-300 h-full flex flex-col">
        <div className="flex items-start gap-4 mb-4 relative z-10">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {testimonial.avatarSrc ? (
              <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white/50">
                <Image
                  src={testimonial.avatarSrc}
                  alt={testimonial.name}
                  width={48}
                  height={48}
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-aura-emerald/30 via-aura-blue/30 to-aura-sand/30 border-2 border-white/50 flex items-center justify-center backdrop-blur-sm">
                <span className="text-sm font-semibold text-gray-700">
                  {getInitials(testimonial.name)}
                </span>
              </div>
            )}
          </div>

          {/* Nom et étoiles */}
          <div className="flex-1 min-w-0 relative z-10">
            <h4 className="font-semibold text-gray-900 mb-1.5 text-base">
              {testimonial.name}
            </h4>
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < testimonial.stars
                      ? "text-pink-500 fill-pink-500"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Texte de l'avis */}
        <p className="text-gray-700 text-sm leading-relaxed flex-1 relative z-10">
          {testimonial.text}
        </p>
      </div>
    </div>
  );
}

export default function TestimonialsMarquee() {
  // Dupliquer les testimonials pour créer un loop infini sans saut
  // On duplique 2 fois pour garantir un défilement fluide
  const duplicatedTestimonials = [...testimonials, ...testimonials];

  return (
    <div className="w-full overflow-hidden py-8">
      <div className="relative">
        <div className="flex gap-6 marquee-container" style={{ width: "fit-content" }}>
          {duplicatedTestimonials.map((testimonial, index) => (
            <TestimonialCard key={`${testimonial.id}-${index}`} testimonial={testimonial} />
          ))}
        </div>
      </div>
    </div>
  );
}
