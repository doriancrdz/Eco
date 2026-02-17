export interface Summary {
  titre: string;
  resume: string;
  pointsCles: string[];
  notions: string[];
}

export interface TranscriptionResult {
  recordingId: string;
  transcription: string;
  summary: Summary | null;
  status: "TRANSCRIBED" | "DONE" | "PROCESSING" | "ERROR";
  aiStatus?: "IDLE" | "GENERATING" | "DONE" | "FAILED";
  aiError?: string;
  demoMode?: boolean;
  warning?: string;
}

/**
 * PHASE A: Transcription rapide uniquement
 * Retourne immédiatement avec la transcription
 */
export async function transcribeAudio(
  audioBlob: Blob,
  durationSeconds: number,
  mimeType: string = "audio/webm"
): Promise<TranscriptionResult> {
  const perfStart = performance.now();
  console.log("[transcribeAudio] ⏱️ Début PHASE A", {
    blobSize: audioBlob.size,
    blobType: audioBlob.type,
    mimeType,
    durationSeconds,
    timestamp: Date.now(),
  });

  // Déterminer l'extension du fichier
  let extension = "webm";
  if (mimeType.includes("webm")) {
    extension = "webm";
  } else if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
    extension = "mp4";
  } else if (mimeType.includes("wav")) {
    extension = "wav";
  } else if (mimeType.includes("mp3") || mimeType.includes("mpeg") || mimeType.includes("mpga")) {
    extension = "mp3";
  }

  const fileName = `recording.${extension}`;
  const formDataStart = performance.now();
  const formData = new FormData();
  formData.append("audio", audioBlob, fileName);
  formData.append("durationSeconds", durationSeconds.toString());
  const formDataDuration = performance.now() - formDataStart;

  console.log("[transcribeAudio] ⏱️ FormData créé", {
    fileName,
    durationMs: formDataDuration.toFixed(2),
  });

  console.log("[transcribeAudio] ⏱️ Envoi à /api/transcribe...");
  const uploadStart = performance.now();
  let res: Response;
  try {
    res = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });
    const uploadDuration = performance.now() - uploadStart;
    console.log("[transcribeAudio] ⏱️ Réponse PHASE A reçue", {
      status: res.status,
      ok: res.ok,
      uploadDurationMs: uploadDuration.toFixed(2),
    });
  } catch (fetchError) {
    console.error("[transcribeAudio] Erreur fetch:", fetchError);
    throw new Error(
      `Erreur réseau lors de l'appel API: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
    );
  }

  if (!res.ok) {
    let message = "Erreur lors de la transcription.";
    try {
      const errorData = await res.json();
      if (errorData && typeof errorData.error === "string") {
        message = errorData.error;
      }
    } catch {
      // Ignore parse error
    }
    throw new Error(message);
  }

  const parseStart = performance.now();
  const data = await res.json();
  const parseDuration = performance.now() - parseStart;
  const totalDuration = performance.now() - perfStart;

  console.log("[transcribeAudio] ⏱️ PHASE A terminée", {
    recordingId: data.recordingId,
    hasTranscription: !!data.transcription,
    status: data.status,
    parseDurationMs: parseDuration.toFixed(2),
    totalDurationMs: totalDuration.toFixed(2),
  });

  if (data.timings) {
    console.log("[transcribeAudio] ⏱️ Timings serveur:", data.timings);
  }

  return {
    recordingId: data.recordingId,
    transcription: data.transcription,
    summary: null, // Pas encore disponible
    status: data.status,
  };
}

/**
 * PHASE B: Génération du résumé (asynchrone)
 * - 200 + summary → retourne le résumé
 * - 202 (GENERATING) → retourne null, le polling récupérera le résultat
 * - erreur → throw
 */
export async function generateSummary(recordingId: string): Promise<Summary | null> {
  const perfStart = performance.now();
  console.log("[generateSummary] Début PHASE B", { recordingId });

  const res = await fetch("/api/generate-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordingId }),
  });

  if (res.status === 202) {
    console.log("[generateSummary] 202 — génération déjà en cours, polling prendra le relais");
    return null;
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erreur lors de la génération du résumé");
  }

  const data = await res.json();
  const duration = performance.now() - perfStart;

  console.log("[generateSummary] PHASE B terminée", {
    recordingId: data.recordingId,
    status: data.status,
    hasSummary: !!data.summary,
    durationMs: duration.toFixed(2),
  });

  return data.summary ?? null;
}

/**
 * Polling: Récupère l'état d'un Recording
 */
export async function pollRecordingStatus(recordingId: string): Promise<TranscriptionResult> {
  const res = await fetch(`/api/recording/${recordingId}`);

  if (!res.ok) {
    throw new Error("Erreur lors de la récupération du Recording");
  }

  const data = await res.json();

  return {
    recordingId: data.recordingId,
    transcription: data.transcription || "",
    summary: data.summary,
    status: data.status,
    aiStatus: data.aiStatus,
    aiError: data.aiError,
  };
}

/**
 * Fonction legacy pour compatibilité (appelle transcribeAudio)
 */
export async function transcribeAndSummarize(
  audioBlob: Blob,
  durationSeconds: number,
  mimeType: string = "audio/webm"
): Promise<TranscriptionResult> {
  // Appeler PHASE A uniquement
  return transcribeAudio(audioBlob, durationSeconds, mimeType);
}
