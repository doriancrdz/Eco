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
  console.log("[transcribeAndSummarize] Début", {
    blobSize: audioBlob.size,
    blobType: audioBlob.type,
    durationSeconds,
  });

  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.webm");
  formData.append("durationSeconds", durationSeconds.toString());

  console.log("[transcribeAndSummarize] FormData créé, envoi à /api/transcribe...");

  let res: Response;
  try {
    res = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });
    console.log("[transcribeAndSummarize] Réponse reçue", {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
    });
  } catch (fetchError) {
    console.error("[transcribeAndSummarize] Erreur fetch:", fetchError);
    throw new Error(
      `Erreur réseau lors de l'appel API: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
    );
  }

  if (!res.ok) {
    let message = "Erreur lors de la transcription.";
    let errorData: any = null;
    try {
      errorData = await res.json();
      console.error("[transcribeAndSummarize] Erreur API:", errorData);
      if (errorData && typeof errorData.error === "string") {
        message = errorData.error;
      } else {
        message = `Erreur ${res.status}: ${res.statusText}`;
      }
    } catch (parseError) {
      console.error("[transcribeAndSummarize] Impossible de parser la réponse d'erreur:", parseError);
      message = `Erreur ${res.status}: ${res.statusText}`;
    }
    throw new Error(message);
  }

  let data: any;
  try {
    data = await res.json();
    console.log("[transcribeAndSummarize] Données reçues", {
      hasTranscription: !!data.transcription,
      hasSummary: !!data.summary,
      transcriptionLength: data.transcription?.length,
      summaryTitle: data.summary?.titre,
    });
  } catch (parseError) {
    console.error("[transcribeAndSummarize] Impossible de parser la réponse JSON:", parseError);
    throw new Error("Réponse invalide du serveur (JSON invalide)");
  }

  if (!data.transcription || !data.summary) {
    console.error("[transcribeAndSummarize] Données incomplètes:", data);
    throw new Error("Réponse incomplète du serveur");
  }

  return {
    transcription: data.transcription as string,
    summary: data.summary as Summary,
    demoMode: data.demoMode === true,
    warning: data.warning as string | undefined,
  };
}

