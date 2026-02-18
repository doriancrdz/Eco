import { getDurationMsFromBlob } from "./audio";

/** Génère un traceId pour suivre un enregistrement dans les logs (client + API). */
export function createPipelineTraceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `eco-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

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
 * Init uniquement : crée le Recording et retourne l'id.
 * traceId optionnel pour corrélation des logs.
 */
export async function initRecording(
  durationSeconds: number,
  mimeType: string = "audio/webm",
  traceId?: string
): Promise<{ recordingId: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (traceId) headers["x-eco-trace"] = traceId;
  const body = { durationSeconds, mimeType };
  if (traceId) (body as Record<string, unknown>).traceId = traceId;

  const initRes = await fetch("/api/recordings/init", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(err.error || "Erreur init recording");
  }

  const initData = await initRes.json();
  return { recordingId: initData.recordingId };
}

export interface PipelineLogStep {
  step: string;
  status: number;
  json?: unknown;
}

/**
 * Upload + complete (débit quota) puis transcribe (attendu).
 * Ordre garanti : 1) complete (si audioBlob.size > 0 et durationMs > 0), 2) transcribe (await).
 * traceId optionnel pour les logs.
 */
export async function uploadAndComplete(
  recordingId: string,
  audioBlob: Blob,
  durationSeconds: number,
  mimeType: string = "audio/webm",
  traceId?: string,
  pipelineLog?: (entry: PipelineLogStep) => void
): Promise<void> {
  let durationMs: number;
  try {
    durationMs = await getDurationMsFromBlob(audioBlob);
  } catch (err) {
    console.warn("[uploadAndComplete] getDurationMsFromBlob failed, fallback to 1000ms", err);
    durationMs = 1000;
  }
  durationMs = Math.max(1, Math.round(durationMs));

  if (audioBlob.size === 0 || durationMs <= 0) {
    const msg = "Audio invalide (size=0 ou duration=0). Impossible de continuer.";
    if (process.env.NODE_ENV !== "production") {
      console.error("[PIPELINE]", msg, { audioBlobSize: audioBlob.size, durationMs });
      pipelineLog?.({ step: "complete", status: 0, json: { error: msg } });
    }
    throw new Error(msg);
  }

  const completeHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (traceId) completeHeaders["x-eco-trace"] = traceId;
  const completeBody = { durationMs };
  if (traceId) (completeBody as Record<string, unknown>).traceId = traceId;

  const completeUrl = `/api/recordings/${recordingId}/complete`;
  const completeRes = await fetch(completeUrl, {
    method: "POST",
    headers: completeHeaders,
    body: JSON.stringify(completeBody),
  });
  const completeJson = await completeRes.json().catch(() => ({}));
  if (process.env.NODE_ENV !== "production") {
    console.log("[PIPELINE] complete", "status=" + completeRes.status, completeJson);
    pipelineLog?.({ step: "complete", status: completeRes.status, json: completeJson });
  }
  if (!completeRes.ok) {
    const errorMsg = completeJson.error || "Erreur lors du débit du quota";
    if (completeRes.status === 403) {
      throw new Error(
        completeJson.remainingFormatted
          ? `Quota insuffisant. Il vous reste ${completeJson.remainingFormatted}.`
          : errorMsg
      );
    }
    throw new Error(errorMsg);
  }

  let extension = "webm";
  if (mimeType.includes("webm")) extension = "webm";
  else if (mimeType.includes("mp4") || mimeType.includes("m4a")) extension = "mp4";
  else if (mimeType.includes("wav")) extension = "wav";
  else if (mimeType.includes("mp3") || mimeType.includes("mpeg")) extension = "mp3";

  const formData = new FormData();
  formData.append("audio", audioBlob, `recording.${extension}`);

  const transcribeUrl = `/api/recordings/${recordingId}/transcribe`;
  const transcribeHeaders: Record<string, string> = {};
  if (traceId) transcribeHeaders["x-eco-trace"] = traceId;

  const transcribeRes = await fetch(transcribeUrl, {
    method: "POST",
    headers: transcribeHeaders,
    body: formData,
  });
  const transcribeJson = await transcribeRes.json().catch(() => ({}));
  if (process.env.NODE_ENV !== "production") {
    console.log("[PIPELINE] transcribe", "status=" + transcribeRes.status, transcribeJson);
    pipelineLog?.({ step: "transcribe", status: transcribeRes.status, json: transcribeJson });
  }
  if (!transcribeRes.ok) {
    throw new Error(transcribeJson.error || "Erreur transcription");
  }
}

/**
 * PHASE A: Init (rapide) + Upload + Complete (débit quota)
 * Retourne après le débit du quota. La transcription arrive via polling.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  durationSeconds: number,
  mimeType: string = "audio/webm"
): Promise<TranscriptionResult> {
  const { recordingId } = await initRecording(durationSeconds, audioBlob.type || mimeType);
  await uploadAndComplete(recordingId, audioBlob, durationSeconds, mimeType);
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
export async function generateSummary(
  recordingId: string,
  traceId?: string
): Promise<Summary | null> {
  const perfStart = performance.now();
  const url = "/api/generate-summary";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (traceId) headers["x-eco-trace"] = traceId;
  const body: { recordingId: string; traceId?: string } = { recordingId };
  if (traceId) body.traceId = traceId;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[DEBUG generateSummary] ✅ Réponse", { url, status: res.status, recordingId, ecoId: recordingId });
  }

  if (res.status === 202) {
    console.log("[generateSummary] 202 — génération déjà en cours, polling prendra le relais");
    return null;
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEBUG generateSummary] ❌ Erreur", { url, status: res.status, recordingId, ecoId: recordingId, error: errorData });
    }
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
