export interface Eco {
  id: string;
  title: string;
  audio_url: string;
  transcription_text: string;
  summary_text: string;
  folder: string;
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
}

export const DEFAULT_FOLDERS: Folder[] = [
  { id: "travail", name: "Travail" },
  { id: "etudes", name: "Études" },
  { id: "personnel", name: "Personnel" },
];
