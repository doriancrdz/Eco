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
 * PHASE A: Init (rapide) + Upload en fire-and-forget
 * Retourne immédiatement avec recordingId. La transcription arrive via polling.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  durationSeconds: number,
  mimeType: string = "audio/webm"
): Promise<TranscriptionResult> {
  const initRes = await fetch("/api/recordings/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      durationSeconds,
      mimeType: audioBlob.type || mimeType,
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(err.error || "Erreur init recording");
  }

  const initData = await initRes.json();
  const recordingId = initData.recordingId;

  let extension = "webm";
  if (mimeType.includes("webm")) extension = "webm";
  else if (mimeType.includes("mp4") || mimeType.includes("m4a")) extension = "mp4";
  else if (mimeType.includes("wav")) extension = "wav";
  else if (mimeType.includes("mp3") || mimeType.includes("mpeg")) extension = "mp3";

  const formData = new FormData();
  formData.append("audio", audioBlob, `recording.${extension}`);

  fetch(`/api/recordings/${recordingId}/transcribe`, {
    method: "POST",
    body: formData,
  }).catch((e) => console.error("[transcribeAudio] Upload error:", e));

  return {
    recordingId,
    transcription: "",
    summary: null,
    status: "PROCESSING",
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
