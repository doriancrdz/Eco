import { getDurationMsFromBlob } from "./audio";

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
 * À appeler avant de créer l'Eco côté client, pour que l'Eco existe quand la transcription met à jour la DB.
 */
export async function initRecording(
  durationSeconds: number,
  mimeType: string = "audio/webm"
): Promise<{ recordingId: string }> {
  const initRes = await fetch("/api/recordings/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      durationSeconds,
      mimeType,
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(err.error || "Erreur init recording");
  }

  const initData = await initRes.json();
  return { recordingId: initData.recordingId };
}

/**
 * Upload audio + complete (débit quota). À appeler après avoir créé l'Eco avec le même id que recordingId.
 */
export async function uploadAndComplete(
  recordingId: string,
  audioBlob: Blob,
  durationSeconds: number,
  mimeType: string = "audio/webm"
): Promise<void> {
  let durationMs: number;
  try {
    durationMs = await getDurationMsFromBlob(audioBlob);
  } catch (err) {
    console.warn("[uploadAndComplete] getDurationMsFromBlob failed, fallback to 1000ms", err);
    durationMs = 1000;
  }
  durationMs = Math.max(1, Math.round(durationMs));

  let extension = "webm";
  if (mimeType.includes("webm")) extension = "webm";
  else if (mimeType.includes("mp4") || mimeType.includes("m4a")) extension = "mp4";
  else if (mimeType.includes("wav")) extension = "wav";
  else if (mimeType.includes("mp3") || mimeType.includes("mpeg")) extension = "mp3";

  const formData = new FormData();
  formData.append("audio", audioBlob, `recording.${extension}`);

  const transcribeUrl = `/api/recordings/${recordingId}/transcribe`;
  if (process.env.NODE_ENV !== "production") {
    console.log("[DEBUG uploadAndComplete] Upload transcribe", { url: transcribeUrl, recordingId, ecoId: recordingId });
  }
  const uploadPromise = fetch(transcribeUrl, {
    method: "POST",
    body: formData,
  })
    .then((res) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[DEBUG uploadAndComplete] ✅ Transcribe appelé", { url: transcribeUrl, status: res.status, recordingId, ecoId: recordingId });
      }
      return res;
    })
    .catch((e) => {
      console.error("[uploadAndComplete] Upload error:", e);
      if (process.env.NODE_ENV !== "production") {
        console.log("[DEBUG uploadAndComplete] ❌ Transcribe erreur", { url: transcribeUrl, recordingId, ecoId: recordingId, error: e });
      }
    });

  const completeUrl = `/api/recordings/${recordingId}/complete`;
  if (process.env.NODE_ENV !== "production") {
    console.log("[DEBUG uploadAndComplete] Complete", { url: completeUrl, recordingId, ecoId: recordingId });
  }
  const completeRes = await fetch(completeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationMs }),
  });
  if (process.env.NODE_ENV !== "production") {
    console.log("[DEBUG uploadAndComplete] ✅ Complete", { url: completeUrl, status: completeRes.status, recordingId, ecoId: recordingId });
  }

  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({}));
    const errorMsg = err.error || "Erreur lors du débit du quota";
    if (completeRes.status === 403) {
      throw new Error(
        err.remainingFormatted
          ? `Quota insuffisant. Il vous reste ${err.remainingFormatted}.`
          : errorMsg
      );
    }
    throw new Error(errorMsg);
  }

  const completeData = await completeRes.json();
  console.log("[uploadAndComplete] Quota débité", {
    recordingId,
    secondsDebited: completeData.secondsDebited,
    remainingSeconds: completeData.remainingSeconds,
    remainingFormatted: completeData.remainingFormatted,
  });

  uploadPromise.catch(() => {});
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
export async function generateSummary(recordingId: string): Promise<Summary | null> {
  const perfStart = performance.now();
  const url = "/api/generate-summary";
  if (process.env.NODE_ENV !== "production") {
    console.log("[DEBUG generateSummary] Appel", { url, recordingId, ecoId: recordingId });
  }
  console.log("[generateSummary] Début PHASE B", { recordingId });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordingId }),
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
