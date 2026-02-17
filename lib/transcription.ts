export interface Summary {
  titre: string;
  resume: string;
  pointsCles: string[];
  notions: string[];
}

export interface TranscriptionResult {
  transcription: string;
  summary: Summary;
  demoMode?: boolean;
  warning?: string;
}

/**
 * Envoie le fichier audio au backend pour transcription (Whisper) + résumé (GPT).
 * Cette fonction est appelée côté client et ne contient aucun appel direct à OpenAI.
 */
export async function transcribeAndSummarize(
  audioBlob: Blob,
  durationSeconds: number
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.webm");
  formData.append("durationSeconds", durationSeconds.toString());

  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let message = "Erreur lors de la transcription.";
    try {
      const data = await res.json();
      if (data && typeof data.error === "string") {
        message = data.error;
      }
    } catch {
      // ignore JSON parse error, garder le message générique
    }
    throw new Error(message);
  }

  const data = await res.json();

  return {
    transcription: data.transcription as string,
    summary: data.summary as Summary,
    demoMode: data.demoMode === true,
    warning: data.warning as string | undefined,
  };
}

