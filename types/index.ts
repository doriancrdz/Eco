export interface QuizQuestion {
  type: "mcq" | "open";
  question: string;
  options?: string[];
  answer: string;
}

export interface Eco {
  id: string;
  title: string;
  audio_url: string;
  transcription_text: string;
  summary_text: string | null; // Peut être null si résumé pas encore généré
  folder: string;
  created_at: string;
  duration_seconds?: number | null; // Durée de l'enregistrement en secondes
  quiz?: QuizQuestion[] | null;
}

export interface Folder {
  id: string;
  name: string;
  isDefault?: boolean;
}

export const DEFAULT_FOLDERS: Folder[] = [
  { id: "travail", name: "Travail" },
  { id: "etudes", name: "Études" },
  { id: "personnel", name: "Personnel" },
];
