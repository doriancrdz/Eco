"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import Logo from "@/components/Logo";
import { Sparkles, ArrowRight, Settings, ArrowLeft, Mic } from "lucide-react";
import { useUser, useClerk } from "@clerk/nextjs";
import EcoView from "@/components/EcoView";
import RecordButton from "@/components/RecordButton";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { Eco } from "@/types";
import { getEcos } from "@/lib/storage";
import { createPipelineTraceId, uploadAndComplete, completeAndTranscribeFromR2 } from "@/lib/transcription";
import { MAX_RECORDING_DURATION_MINUTES } from "@/lib/billingConfig";
import { motion, AnimatePresence } from "framer-motion";

// Lazy load components non critiques
const FocusMode = dynamic(() => import("@/components/FocusMode"), {
  loading: () => null,
  ssr: false,
});

const Sidebar = dynamic(() => import("@/components/Sidebar"), {
  loading: () => null,
  ssr: false,
});

const ProfileView = dynamic(() => import("@/components/ProfileView"), {
  loading: () => null,
  ssr: false,
});

export type CurrentView = "home" | "recording" | "generating" | "detail" | "pricing" | "list";

export default function Home() {
  const router = useRouter();
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [paymentBlocked, setPaymentBlocked] = useState(false);
  const [upgradeHovered, setUpgradeHovered] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedEco, setSelectedEco] = useState<string | null>(null);
  const [currentEco, setCurrentEco] = useState<Eco | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [viewAllEcos, setViewAllEcos] = useState(false);
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);
  const [processingDurationMinutes, setProcessingDurationMinutes] = useState(0);
  const [ecos, setEcos] = useState<Eco[]>([]);

  const { soundLevel, frequencyData, isAvailable, startAudioLevel, stopAudioLevel, analyserRef } = useAudioLevel(isPaused);

  // Empêcher la fermeture accidentelle pendant l'enregistrement
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Seulement si un enregistrement est en cours
      if (isRecording) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRecording]);

  // Charger les ECOs depuis l'API (source unique)
  const loadEcos = useCallback(async () => {
    const t0 = performance.now();
    console.log("[loadEcos] Début");
    try {
      const res = await fetch("/api/ecos?limit=30", { cache: "no-store" });
      const t1 = performance.now();
      const duration = t1 - t0;
      if (res.ok) {
        const data = await res.json();
        const payloadSize = JSON.stringify(data).length;
        console.log(`[loadEcos] Succès - ${duration.toFixed(0)}ms - ${payloadSize} bytes - ${data.ecos?.length || 0} ECOs`);
        setEcos(data.ecos || []);
      } else {
        console.log(`[loadEcos] Erreur ${res.status} - ${duration.toFixed(0)}ms`);
        setEcos([]);
      }
    } catch (error) {
      const duration = performance.now() - t0;
      console.error(`[loadEcos] Exception - ${duration.toFixed(0)}ms`, error);
      setEcos([]);
    }
  }, []);

  // Migration localStorage → DB au premier chargement
  useEffect(() => {
    const migrateEcos = async () => {
      const localEcos = getEcos();
      if (localEcos.length > 0) {
        try {
          await fetch("/api/ecos/migrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ecos: localEcos }),
          });
          await loadEcos();
        } catch (error) {
          console.error("Erreur lors de la migration des ECOs:", error);
        }
      } else {
        loadEcos();
      }
    };
    migrateEcos();
  }, [loadEcos]);

  // Debounce pour éviter les refetch multiples
  const ecoUpdatedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEcoUpdatedRef = useRef<number>(0);
  
  useEffect(() => {
    const handleEcoUpdated = () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastEcoUpdatedRef.current;
      
      // Debounce : ne refetch que si > 300ms depuis le dernier
      if (ecoUpdatedTimeoutRef.current) {
        clearTimeout(ecoUpdatedTimeoutRef.current);
      }
      
      ecoUpdatedTimeoutRef.current = setTimeout(() => {
        console.log("[eco-updated] Déclenchement loadEcos (debounced)");
        lastEcoUpdatedRef.current = Date.now();
        loadEcos();
      }, Math.max(0, 300 - timeSinceLastUpdate));
    };
    
    window.addEventListener("eco-updated", handleEcoUpdated);
    return () => {
      window.removeEventListener("eco-updated", handleEcoUpdated);
      if (ecoUpdatedTimeoutRef.current) {
        clearTimeout(ecoUpdatedTimeoutRef.current);
      }
    };
  }, [loadEcos]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const elapsedAtStopRef = useRef(0);
  const mimeTypeRef = useRef<string>("audio/webm");

  // Cache pour éviter les refetch inutiles
  const currentEcoCacheRef = useRef<{ id: string; data: Eco; timestamp: number } | null>(null);
  const CACHE_TTL_MS = 5000; // 5 secondes

  // Navigation accueil: empêcher les effects de remettre selectedEco/isProcessing
  const isNavigatingHomeRef = useRef(false);
  const selectedEcoRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);
  const isFocusModeRef = useRef(false);
  const viewAllEcosRef = useRef(false);
  useEffect(() => {
    selectedEcoRef.current = selectedEco;
    isProcessingRef.current = isProcessing;
    isFocusModeRef.current = isFocusMode;
    viewAllEcosRef.current = viewAllEcos;
  }, [selectedEco, isProcessing, isFocusMode, viewAllEcos]);

  const snapshotState = useCallback(() => ({
    selectedEco: selectedEcoRef.current,
    isProcessing: isProcessingRef.current,
    isFocusMode: isFocusModeRef.current,
    viewAllEcos: viewAllEcosRef.current,
    isNavigatingHome: isNavigatingHomeRef.current,
  }), []);

  // Sécurité : garder selectedEco et currentEco cohérents (éviter fond vide / état cassé)
  useEffect(() => {
    if (!selectedEco && currentEco) {
      console.warn("[Safety] État incohérent détecté (selectedEco vide mais currentEco présent), sync currentEco → null");
      setCurrentEco(null);
    }
  }, [selectedEco, currentEco]);

  // Charger l'ECO sélectionné depuis l'API
  useEffect(() => {
    if (isNavigatingHomeRef.current) return;
    if (!selectedEco) {
      setCurrentEco(null);
      currentEcoCacheRef.current = null;
      return;
    }
    
    // Vérifier le cache
    const cached = currentEcoCacheRef.current;
    if (cached && cached.id === selectedEco && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[loadCurrentEco] Utilisation cache pour ${selectedEco}`);
      setCurrentEco(cached.data);
      return;
    }
    
    const loadCurrentEco = async () => {
      const t0 = performance.now();
      console.log(`[loadCurrentEco] Fetch ${selectedEco}`);
      try {
        const res = await fetch(`/api/ecos/${selectedEco}`, { cache: "no-store" });
        const t1 = performance.now();
        const duration = t1 - t0;
        if (res.ok) {
          const data = await res.json();
          const payloadSize = JSON.stringify(data).length;
          console.log(`[loadCurrentEco] Succès - ${duration.toFixed(0)}ms - ${payloadSize} bytes`);
          if (data.eco) {
            setCurrentEco(data.eco);
            // Mettre en cache
            currentEcoCacheRef.current = { id: selectedEco, data: data.eco, timestamp: Date.now() };
          }
        } else {
          console.log(`[loadCurrentEco] Erreur ${res.status} - ${duration.toFixed(0)}ms`);
          setSelectedEco(null);
          setSelectedFolder(null);
          setCurrentEco(null);
          currentEcoCacheRef.current = null;
        }
      } catch (error) {
        const duration = performance.now() - t0;
        console.error(`[loadCurrentEco] Exception - ${duration.toFixed(0)}ms`, error);
        setSelectedEco(null);
        setSelectedFolder(null);
        setCurrentEco(null);
        currentEcoCacheRef.current = null;
      }
    };
    loadCurrentEco();
  }, [selectedEco]);

  // Rafraîchir currentEco quand eco-updated est déclenché (avec debounce et cache)
  const refreshCurrentEcoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    const handleRefreshCurrent = async () => {
      if (isNavigatingHomeRef.current) return;
      if (!selectedEco) return;
      
      // Debounce : ne refetch que si > 500ms depuis le dernier
      if (refreshCurrentEcoTimeoutRef.current) {
        clearTimeout(refreshCurrentEcoTimeoutRef.current);
      }
      
      refreshCurrentEcoTimeoutRef.current = setTimeout(async () => {
        if (isNavigatingHomeRef.current) return;
        const ecoId = selectedEcoRef.current;
        if (!ecoId) return;
        // Invalider le cache
        currentEcoCacheRef.current = null;
        
        const t0 = performance.now();
        console.log(`[refreshCurrentEco] Refresh ${ecoId}`);
        try {
          const res = await fetch(`/api/ecos/${ecoId}`, { cache: "no-store" });
          if (isNavigatingHomeRef.current) return;
          const t1 = performance.now();
          const duration = t1 - t0;
          if (res.ok) {
            const data = await res.json();
            console.log(`[refreshCurrentEco] Succès - ${duration.toFixed(0)}ms`);
            if (data.eco && !isNavigatingHomeRef.current) {
              setCurrentEco(data.eco);
              currentEcoCacheRef.current = { id: ecoId, data: data.eco, timestamp: Date.now() };
            }
          } else {
            console.log(`[refreshCurrentEco] Erreur ${res.status} - ${duration.toFixed(0)}ms`);
            if (!isNavigatingHomeRef.current) {
              setSelectedEco(null);
              setSelectedFolder(null);
              setCurrentEco(null);
              currentEcoCacheRef.current = null;
            }
          }
        } catch (error) {
          const duration = performance.now() - t0;
          console.error(`[refreshCurrentEco] Exception - ${duration.toFixed(0)}ms`, error);
        }
      }, 500);
    };
    
    window.addEventListener("eco-updated", handleRefreshCurrent);
    return () => {
      window.removeEventListener("eco-updated", handleRefreshCurrent);
      if (refreshCurrentEcoTimeoutRef.current) {
        clearTimeout(refreshCurrentEcoTimeoutRef.current);
      }
    };
  }, [selectedEco]);

  useEffect(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || !isRecording) return;
    if (isPaused && mr.state === "recording") {
      mr.pause();
      pausedAtRef.current = Date.now();
    } else if (!isPaused && mr.state === "paused") {
      if (pausedAtRef.current !== null) {
        totalPausedMsRef.current += Date.now() - pausedAtRef.current;
        pausedAtRef.current = null;
      }
      mr.resume();
    }
  }, [isPaused, isRecording]);

  useEffect(() => {
    if (!isRecording || startTimeRef.current === null) {
      setRecordingElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      const start = startTimeRef.current;
      if (start === null) return;
      const totalPaused = totalPausedMsRef.current;
      const elapsedMs = isPaused && pausedAtRef.current !== null
        ? pausedAtRef.current - start - totalPaused
        : Date.now() - start - totalPaused;
      setRecordingElapsedSeconds(Math.floor(elapsedMs / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await fetch("/api/billing/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setUserPlan(data.plan || "free");
          setPaymentBlocked(data.paymentBlocked === true);
        }
      } catch {
        setUserPlan("free");
        setPaymentBlocked(false);
      }
    };
    fetchPlan();
  }, []);

  const startRecording = async () => {
    setIsPaused(false);
    setRecordingElapsedSeconds(0);

    try {
      console.log("[startRecording] Demande accès micro...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      console.log("[startRecording] Stream obtenu:", stream.id);

      if (stream.getAudioTracks().length === 0) {
        throw new Error("Aucune piste audio disponible");
      }

      // Réinitialiser les chunks
      audioChunksRef.current = [];
      console.log("[startRecording] Chunks réinitialisés");

      // Détection format robuste : priorité WEBM/OPUS pour compatibilité Whisper
      const preferredMimeTypes = [
        "audio/webm;codecs=opus", // Format optimal (Chrome, Firefox moderne)
        "audio/webm", // Fallback webm sans codec spécifié
        "audio/ogg;codecs=opus", // Fallback rare (Firefox ancien)
      ];
      let chosenMimeType: string | undefined = undefined;
      for (const mime of preferredMimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          chosenMimeType = mime;
          break;
        }
      }
      // Si aucun format préféré supporté, laisser undefined (navigateur choisira)

      mimeTypeRef.current = chosenMimeType || "audio/webm";
      console.log("[RECORDER] Format choisi:", chosenMimeType || "navigateur par défaut");

      // Créer MediaRecorder avec bitrate 96 kbps (bon compromis qualité/taille pour 60 min)
      const recorderOptions: MediaRecorderOptions = {};
      if (chosenMimeType) {
        recorderOptions.mimeType = chosenMimeType;
      }
      recorderOptions.audioBitsPerSecond = 96000; // 96 kbps (60 min ≈ 41 MB)
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      
      console.log("[RECORDER] MediaRecorder créé", {
        requestedMimeType: chosenMimeType || "navigateur par défaut",
        actualMimeType: mediaRecorder.mimeType,
        audioBitsPerSecond: recorderOptions.audioBitsPerSecond,
        state: mediaRecorder.state,
      });

      // IMPORTANT: Définir TOUS les handlers AVANT start()
      mediaRecorder.ondataavailable = (e) => {
        console.log("[ondataavailable] size:", e.data?.size ?? 0, "type:", e.data?.type ?? "unknown");
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          console.log("[Chunk collecté] Total chunks:", audioChunksRef.current.length);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("[onstop] Chunks collectés:", audioChunksRef.current.length);
        stopAudioLevel();
        startTimeRef.current = null;
        totalPausedMsRef.current = 0;
        pausedAtRef.current = null;

        if (audioChunksRef.current.length === 0) {
          console.error("[onstop] AUCUN CHUNK!");
          setIsRecording(false);
          setIsProcessing(false);
          setIsFocusMode(false);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          alert("Erreur: aucune donnée audio enregistrée. Réessayez.");
          return;
        }

        // Déterminer le mimeType final depuis les chunks ou le recorder
        const chunkType = audioChunksRef.current[0]?.type;
        const mimeTypeUsed = chunkType || mimeTypeRef.current || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeUsed });
        
        const sizeMB = (audioBlob.size / 1024 / 1024).toFixed(2);
        console.log("[RECORDER] Blob final créé", {
          type: audioBlob.type,
          sizeBytes: audioBlob.size,
          sizeMB: `${sizeMB} MB`,
          chunksCount: audioChunksRef.current.length,
          durationSeconds: elapsedAtStopRef.current,
        });

        const durationSeconds = elapsedAtStopRef.current;
        await processRecording(audioBlob, durationSeconds, mimeTypeUsed);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error("[MediaRecorder] Erreur:", e);
      };

      // Stocker dans ref
      mediaRecorderRef.current = mediaRecorder;

      // Stocker le stream tout de suite pour que Chrome le considère utilisé
      streamRef.current = stream;

      // Démarrer avec timeslice 1000ms pour collecter régulièrement (évite que Chrome coupe le stream)
      mediaRecorder.start(1000);
      console.log("[MediaRecorder] start(1000) appelé, state:", mediaRecorder.state);

      // Démarrer l'analyse audio (consomme aussi le stream)
      await startAudioLevel(stream);
      console.log("[startRecording] Analyse audio démarrée");

      // Initialiser le timer
      startTimeRef.current = Date.now();
      totalPausedMsRef.current = 0;
      pausedAtRef.current = null;

      // Afficher FocusMode
      setIsFocusMode(true);
      setIsRecording(true);
      console.log("[startRecording] Tout initialisé");
    } catch (error) {
      console.error("[startRecording] Erreur:", error);
      setIsFocusMode(false);
      setIsRecording(false);
      alert("Impossible d'accéder au microphone. Veuillez autoriser l'accès.");
    }
  };

  const stopRecording = () => {
    setShowStopConfirm(true);
  };

  const confirmStop = () => {
    console.log("[confirmStop] T0 stop clicked", { ts: Date.now() });
    
    // Calculer la durée EXACTE en millisecondes
    const endTime = Date.now();
    const startTime = startTimeRef.current;
    if (startTime === null) {
      console.error("[confirmStop] startTimeRef.current est null");
      setIsRecording(false);
      setIsProcessing(false);
      setIsFocusMode(false);
      setShowStopConfirm(false);
      return;
    }
    
    const durationMs = endTime - startTime - totalPausedMsRef.current;
    const durationSeconds = durationMs / 1000; // PRÉCIS à 2 décimales
    const durationMinutes = durationSeconds / 60; // PRÉCIS
    
    console.log("[confirmStop] Durée exacte calculée", {
      durationMs: durationMs.toFixed(0),
      durationSeconds: durationSeconds.toFixed(2),
      durationMinutes: durationMinutes.toFixed(2),
    });
    
    // Vérifier la limite AVANT de continuer
    if (durationMinutes > MAX_RECORDING_DURATION_MINUTES) {
      alert(`Enregistrement trop long (${durationMinutes.toFixed(2)} min). La limite est de ${MAX_RECORDING_DURATION_MINUTES} minutes.`);
      setIsRecording(false);
      setIsProcessing(false);
      setIsFocusMode(false);
      setShowStopConfirm(false);
      return;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      // Stocker la durée exacte pour processRecording
      elapsedAtStopRef.current = durationSeconds;
      mediaRecorderRef.current.stop();
      console.log("[confirmStop] MediaRecorder.stop() appelé");

      // Arrêter le stream après l'arrêt du MediaRecorder
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        console.log("[confirmStop] Stream arrêté");
      }
    } else {
      console.warn("[confirmStop] MediaRecorder non disponible ou pas en recording", {
        hasRef: !!mediaRecorderRef.current,
        state: mediaRecorderRef.current?.state,
        isRecording,
      });
    }
    setProcessingDurationMinutes(durationSeconds / 60);
    setIsRecording(false);
    setIsProcessing(true);
    setIsFocusMode(false);
    setShowStopConfirm(false);
  };

  const processRecording = async (audioBlob: Blob, durationSeconds: number, mimeType: string = "audio/webm") => {
    const traceId = createPipelineTraceId();
    const t0 = Date.now();
    let recordingId: string | null = null;
    const pipelineSteps: Array<{ step: string; status: number; json?: unknown }> = [];

    const logStep = (entry: { step: string; status: number; json?: unknown }) => {
      pipelineSteps.push(entry);
      if (process.env.NODE_ENV !== "production") {
        console.log("[PIPELINE]", entry.step, "status=" + entry.status, entry.json ?? "");
      }
    };

    try {
      const contentType = audioBlob.type || "audio/webm";
      const fileSize = audioBlob.size;
      console.log("[processRecording] Demande presigned URL…", {
        contentType,
        fileSizeBytes: fileSize,
        sizeMB: (fileSize / 1024 / 1024).toFixed(2),
      });

      const presignedRes = await fetch("/api/upload-audio/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-eco-trace": traceId },
        body: JSON.stringify({ contentType, fileSize }),
      });
      logStep({ step: "presignedUrl", status: presignedRes.status });

      if (!presignedRes.ok) {
        const errData = await presignedRes.json().catch(() => ({}));
        if (presignedRes.status === 503) {
          throw new Error(errData.error || "Stockage audio non configuré. Réessayez plus tard.");
        }
        throw new Error(errData.error || "Impossible d’obtenir l’URL d’upload");
      }

      const { presignedUrl, fileId, r2Key } = await presignedRes.json();
      if (!presignedUrl || !fileId || !r2Key) {
        throw new Error("Réponse presigned URL invalide");
      }

      console.log("[processRecording] Upload direct vers R2…");
      const uploadPutRes = await fetch(presignedUrl, {
        method: "PUT",
        body: audioBlob,
        headers: { "Content-Type": contentType },
      });
      logStep({ step: "uploadR2Direct", status: uploadPutRes.status });

      if (!uploadPutRes.ok) {
        throw new Error("Échec de l’upload vers le stockage (R2). Réessayez.");
      }
      console.log("[processRecording] Upload R2 réussi", { fileId, r2Key });

      const initBody: Record<string, unknown> = {
        durationSeconds,
        mimeType,
        traceId,
        fileId,
        r2Key,
      };
      const initRes = await fetch("/api/recordings/init", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-eco-trace": traceId },
        body: JSON.stringify(initBody),
      });
      const initJson = await initRes.json().catch(() => ({}));
      logStep({ step: "initRecording", status: initRes.status, json: initJson });
      if (!initRes.ok) {
        throw new Error(initJson.error || "Erreur init recording");
      }
      recordingId = initJson.recordingId;
      if (!recordingId) throw new Error("recordingId manquant");

      const audioUrl = URL.createObjectURL(audioBlob);
      const ecoTitle = `Eco du ${new Date().toLocaleDateString("fr-FR")}`;
      const minimalEco = {
        id: recordingId,
        title: ecoTitle,
        audio_url: audioUrl,
        transcription_text: "",
        summary_text: null,
        folder: null,
        created_at: new Date().toISOString(),
      };
      const createRes = await fetch("/api/ecos", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-eco-trace": traceId },
        body: JSON.stringify(minimalEco),
      });
      const createJson = await createRes.json().catch(() => ({}));
      logStep({ step: "createEco", status: createRes.status, json: createJson });
      if (!createRes.ok) {
        throw new Error(createJson.error || "Erreur création Eco");
      }

      await completeAndTranscribeFromR2(recordingId, durationSeconds, traceId, logStep);

      // 3b) Déclencher generate-summary tout de suite (EcoView le fera aussi au poll si besoin)
      try {
        const sumRes = await fetch("/api/generate-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-eco-trace": traceId },
          body: JSON.stringify({ recordingId }),
        });
        const sumJson = await sumRes.json().catch(() => ({}));
        if (process.env.NODE_ENV !== "production") {
          console.log("[PIPELINE] generate-summary", "status=" + sumRes.status, sumJson);
          logStep({ step: "generate-summary", status: sumRes.status, json: sumJson });
        }
      } catch (e) {
        console.warn("[processRecording] generate-summary kick failed", e);
        logStep({ step: "generate-summary", status: 0, json: { error: String(e) } });
      }

      const newEco: Eco = {
        ...minimalEco,
        transcription_text: "",
        summary_text: null,
        folder: "",
      };
      setIsFocusMode(false);
      setIsProcessing(false);
      setSelectedEco(newEco.id);
      setSelectedFolder(null);
      setRefreshKey((prev) => prev + 1);

      // Rafraîchir le quota UI (minutes en haut à droite)
      window.dispatchEvent(new Event("quota-updated"));

      // 4) Charger l'Eco
      try {
        const getRes = await fetch(`/api/ecos/${newEco.id}`, {
          cache: "no-store",
          headers: traceId ? { "x-eco-trace": traceId } : undefined,
        });
        logStep({ step: "getEco", status: getRes.status });
        if (getRes.ok) {
          const data = await getRes.json();
          if (data.eco) {
            setCurrentEco(data.eco);
            currentEcoCacheRef.current = { id: newEco.id, data: data.eco, timestamp: Date.now() };
          }
        }
      } catch (e) {
        console.error("[processRecording] Erreur chargement ECO", e);
      }

      window.dispatchEvent(new Event("eco-updated"));

      // 5) Diagnostic DEV : tableau + GET /api/debug/pipeline/[id]
      if (process.env.NODE_ENV !== "production" && recordingId) {
        console.log("[PIPELINE] --- TABLEAU RÉEL ---");
        pipelineSteps.forEach((s) => {
          console.log(`  ${s.step} -> status=${s.status}`, s.json ?? "");
        });
        try {
          const debugRes = await fetch(`/api/debug/pipeline/${recordingId}`);
          const debugJson = await debugRes.json().catch(() => ({}));
          console.log("[PIPELINE] GET /api/debug/pipeline/" + recordingId, debugJson);
          console.log("[PIPELINE] --- PREUVES ---", {
            "recording.transcriptionLen": debugJson.recording?.transcriptionLen,
            "recording.summaryLen": debugJson.recording?.summaryLen,
            "eco.transcriptionLen": debugJson.eco?.transcriptionLen,
            "eco.contentLen": debugJson.eco?.contentLen,
            "lastUsageEvent.secondsDebited": debugJson.lastUsageEvent?.secondsDebited,
          });
        } catch (e) {
          console.error("[PIPELINE] debug fetch failed", e);
        }
      }
    } catch (error) {
      const failedStep = pipelineSteps.find((s) => s.status !== 200 && s.status !== 202);
      if (process.env.NODE_ENV !== "production") {
        console.log("[PIPELINE] --- TABLEAU RÉEL (après erreur) ---");
        pipelineSteps.forEach((s) => {
          console.log(`  ${s.step} -> status=${s.status}`, s.json ?? "");
        });
        if (failedStep) {
          console.error("[PIPELINE] point de rupture:", failedStep.step, "status:", failedStep.status, failedStep.json);
          alert(`Pipeline failed at step: ${failedStep.step} (status ${failedStep.status}). See console.`);
        }
        if (recordingId) {
          try {
            const debugRes = await fetch(`/api/debug/pipeline/${recordingId}`);
            const debugJson = await debugRes.json().catch(() => ({}));
            console.log("[PIPELINE] GET /api/debug/pipeline/" + recordingId, debugJson);
          } catch (e) {
            console.error("[PIPELINE] debug fetch failed", e);
          }
        }
      }
      console.error("[processRecording] Erreur:", error);
      setIsProcessing(false);
      setIsFocusMode(false);
      const errorMessage =
        error instanceof Error ? error.message : "Une erreur est survenue lors du traitement.";
      alert(errorMessage);
    }
  };

  const handleStartRecording = () => {
    if (paymentBlocked) return;
    if (!isRecording) {
      startRecording();
    }
  };

  /** Retour à l'accueil : réinitialisation complète de l'état (sans router.push pour éviter fond vide / état cassé). */
  const resetToHome = useCallback((from?: "back" | "logo" | "sidebar") => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[resetToHome] Retour à la home, état réinitialisé", { from: from ?? "unknown", ts: Date.now() });
    }
    isNavigatingHomeRef.current = true;
    if (refreshCurrentEcoTimeoutRef.current) {
      clearTimeout(refreshCurrentEcoTimeoutRef.current);
      refreshCurrentEcoTimeoutRef.current = null;
    }
    setSelectedEco(null);
    setSelectedFolder(null);
    setViewAllEcos(false);
    setIsFocusMode(false);
    setIsRecording(false);
    setIsPaused(false);
    setIsProcessing(false);
    setShowStopConfirm(false);
    setCurrentEco(null);
    setSidebarOpen(false);
    setShowProfile(false);
    setRefreshKey((prev) => prev + 1);
    currentEcoCacheRef.current = null;
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (typeof document !== "undefined") document.body.style.overflow = "unset";
    setTimeout(() => {
      isNavigatingHomeRef.current = false;
    }, 300);
  }, []);

  const goHome = resetToHome;

  const handleEcoClick = (eco: Eco) => {
    setSelectedEco(eco.id);
    setSelectedFolder(eco.folder && eco.folder !== "" ? eco.folder : null);
    setViewAllEcos(false);
  };

  const currentView: CurrentView = isFocusMode
    ? isRecording
      ? "recording"
      : "recording"
    : isProcessing
    ? "generating"
    : selectedEco
    ? "detail"
    : "home";

  return (
    <div className="min-h-screen text-gray-900 flex relative overflow-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 aura-gradient -z-10" aria-hidden />

      {/* Desktop: Sidebar fixe à gauche. Mobile/Tablet: drawer */}
      <Sidebar
        selectedFolder={selectedFolder}
        onSelectFolder={setSelectedFolder}
        selectedEco={selectedEco}
        onSelectEco={setSelectedEco}
        onClose={() => setSidebarOpen(false)}
        isOpen={sidebarOpen}
        refreshKey={refreshKey}
        onNavigateHome={goHome}
        onNavigatePricing={() => router.push("/pricing")}
        onNavigateSettings={isSignedIn ? () => router.push("/settings/preferences") : undefined}
        onSignOut={isSignedIn ? () => signOut() : undefined}
        onOpenProfile={isSignedIn ? () => setShowProfile(true) : undefined}
        userName={user?.firstName || user?.username || undefined}
        userImageUrl={user?.imageUrl}
      />

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 lg:min-w-0">
        {!isFocusMode && (
          <Header
            onGoHome={goHome}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            isDetailView={!!selectedEco}
            onShare={selectedEco ? async () => {
              const url = window.location.href;
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: "ECO",
                    url,
                    text: "Découvrez mon Eco",
                  });
                } catch {
                  await navigator.clipboard.writeText(url);
                  alert("Lien copié !");
                }
              } else {
                await navigator.clipboard.writeText(url);
                alert("Lien copié !");
              }
            } : undefined}
            onAvatarClick={isSignedIn ? () => setShowProfile(true) : undefined}
            userImageUrl={user?.imageUrl}
            userName={user?.firstName || user?.username || undefined}
          />
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-6">
          <div className={`${sidebarOpen ? "" : "max-w-3xl mx-auto"} px-4 md:px-6 lg:px-8`}>
            <AnimatePresence mode="wait">
            {(() => {
              const conditionHome = !selectedEco && !isFocusMode && !viewAllEcos && !isProcessing;
              const conditionList = viewAllEcos && !selectedEco && !isFocusMode && !isProcessing;
              const conditionDetail = selectedEco && !isFocusMode && !viewAllEcos;
              const conditionGenerating = isProcessing;
              const noViewMatched = !conditionHome && !conditionList && !conditionDetail && !conditionGenerating;
              const showHome = conditionHome || noViewMatched;
              return showHome;
            })() && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-4 md:p-8"
            >
              {/* Halo derrière le logo */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
                <div className="bg-gradient-radial from-white/20 to-transparent blur-3xl w-96 h-96" />
              </div>

              {paymentBlocked && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-center text-sm font-medium max-w-md"
                >
                  Paiement échoué — accès suspendu
                </motion.div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
                className="relative bg-transparent"
              >
                <Logo
                  state="idle"
                  size={280}
                  onClick={handleStartRecording}
                  isClickable={!paymentBlocked}
                  showMicroWarning={false}
                />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
                className="text-5xl font-extrabold tracking-tight text-gray-900 mt-8"
              >
                Nouveau ECO
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
                className="text-lg text-gray-500 font-medium mt-2 opacity-80"
              >
                Appuyez pour commencer
              </motion.p>

              {userPlan === "free" ? (
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => router.push("/pricing")}
                  onHoverStart={() => setUpgradeHovered(true)}
                  onHoverEnd={() => setUpgradeHovered(false)}
                  className="relative mt-6 px-7 py-3 rounded-full font-bold text-sm bg-gradient-to-r from-[#99f6e4] via-[#7dd3fc] to-[#a5b4fc] text-gray-900 shadow-lg hover:shadow-xl border border-white/40 backdrop-blur-sm flex items-center gap-2 transition-all duration-300 overflow-hidden"
                >
                  <Sparkles className="w-4 h-4 shrink-0 relative z-10" />
                  <span className="relative z-10">Passer à Student — dès 19€/mois</span>
                  <ArrowRight className="w-4 h-4 shrink-0 relative z-10" />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"
                    animate={{ x: upgradeHovered ? "100%" : "-100%" }}
                    transition={{ duration: 0.6 }}
                  />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => router.push("/settings")}
                  className="mt-6 px-7 py-3 rounded-full font-bold text-sm bg-white/60 border border-white/50 backdrop-blur-md text-gray-900 hover:bg-white/90 transition-all flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Gérer mon plan
                </motion.button>
              )}

              {/* Section Vos derniers ECOs */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="mt-16 w-full max-w-4xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800">Vos derniers ECOs</h2>
                  {ecos.length > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setViewAllEcos(true)}
                      className="text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      VOIR TOUT
                    </motion.button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ecos
                    .slice(0, 6)
                    .map((eco, index) => (
                      <motion.button
                        key={eco.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + index * 0.08 }}
                        whileHover={{ y: -4, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleEcoClick(eco)}
                        className="text-left bg-white/75 backdrop-blur-2xl rounded-[2rem] border border-white/80 shadow-sm hover:shadow-xl transition-all duration-300 p-6"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Mic className="w-5 h-5 text-gray-600 shrink-0" />
                          <span className="font-bold text-gray-900 truncate">{eco.title}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(eco.created_at).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </motion.button>
                    ))}
                </div>
                {ecos.length === 0 && (
                  <p className="text-gray-500 text-sm py-8 text-center">Aucun Eco pour l&apos;instant</p>
                )}
              </motion.div>
            </motion.div>
          )}
          {viewAllEcos && !selectedEco && !isFocusMode && !isProcessing && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="p-4 md:p-8"
            >
              <motion.button
                whileHover={{ x: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => goHome("sidebar")}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-bold">Retour</span>
              </motion.button>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {ecos.map((eco, index) => (
                  <motion.button
                    key={eco.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    whileHover={{ y: -4, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleEcoClick(eco)}
                    className="text-left bg-white/75 backdrop-blur-2xl rounded-[2rem] border border-white/80 shadow-sm hover:shadow-xl transition-all duration-300 p-6"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Mic className="w-5 h-5 text-gray-600 shrink-0" />
                      <span className="font-bold text-gray-900 truncate">{eco.title}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(eco.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
          {selectedEco && !isFocusMode && !viewAllEcos && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <EcoView
                eco={currentEco}
                onBack={resetToHome}
                onRefresh={() => {
                  if (selectedEco) {
                    // Invalider le cache
                    currentEcoCacheRef.current = null;
                    
                    const url = `/api/ecos/${selectedEco}`;
                    const t0 = performance.now();
                    if (process.env.NODE_ENV !== "production") {
                      console.log("[DEBUG EcoView.onRefresh] Refresh", { url, recordingId: selectedEco, ecoId: selectedEco });
                    }
                    console.log(`[EcoView.onRefresh] Refresh ${selectedEco}`);
                    fetch(url, { cache: "no-store" })
                      .then((res) => {
                        const duration = performance.now() - t0;
                        if (process.env.NODE_ENV !== "production") {
                          console.log("[DEBUG EcoView.onRefresh] ✅ Réponse", { url, status: res.status, recordingId: selectedEco, ecoId: selectedEco });
                        }
                        if (res.ok) {
                          return res.json();
                        }
                        console.log(`[EcoView.onRefresh] Erreur ${res.status} - ${duration.toFixed(0)}ms`);
                        if (process.env.NODE_ENV !== "production") {
                          console.log("[DEBUG EcoView.onRefresh] ❌ Erreur", { url, status: res.status, recordingId: selectedEco, ecoId: selectedEco });
                        }
                        return null;
                      })
                      .then((data) => {
                        if (data?.eco) {
                          setCurrentEco(data.eco);
                          // Mettre en cache
                          currentEcoCacheRef.current = { id: selectedEco, data: data.eco, timestamp: Date.now() };
                          // Déclencher eco-updated une seule fois (debounced)
                          window.dispatchEvent(new Event("eco-updated"));
                        }
                      })
                      .catch((error) => {
                        console.error("[EcoView.onRefresh] Exception", error);
                        if (process.env.NODE_ENV !== "production") {
                          console.log("[DEBUG EcoView.onRefresh] ❌ Exception", { url, recordingId: selectedEco, ecoId: selectedEco, error });
                        }
                      });
                    setRefreshKey((prev) => prev + 1);
                  }
                }}
              />
            </motion.div>
          )}
          {isProcessing && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="text-center flex flex-col items-center gap-6">
                <Logo state="generating" size={120} showMicroWarning={false} />
                <p className="text-xl font-bold text-gray-800">Traitement en cours...</p>
                <p className="text-sm text-gray-600 max-w-sm">
                  Transcription et analyse de votre enregistrement.
                  {processingDurationMinutes > 10 && " Cela peut prendre 1-2 minutes pour les longs audios."}
                </p>
              </div>
            </motion.div>
          )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      <FocusMode
        isActive={isFocusMode}
        isRecording={isRecording}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused((p) => !p)}
        soundLevel={soundLevel}
        frequencyData={frequencyData}
        showMicroWarning={false}
        onStartRecording={handleStartRecording}
        onStopRecording={stopRecording}
        showStopConfirm={showStopConfirm}
        onConfirmStop={confirmStop}
        onCancelStop={() => setShowStopConfirm(false)}
        recordingElapsedSeconds={recordingElapsedSeconds}
        analyserRef={analyserRef}
      />

      <ProfileView
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        userImageUrl={user?.imageUrl}
        userName={user?.firstName || user?.username || undefined}
      />

      {/* Debug overlay (dev only) */}
      {process.env.NODE_ENV !== "production" && (
        <div
          className="fixed bottom-4 right-4 z-[100] rounded-lg bg-black/80 text-white text-xs font-mono p-3 max-w-[280px] shadow-xl border border-white/20"
          aria-hidden
        >
          <div className="font-bold text-amber-300 mb-1">[NAV] state</div>
          <div>selectedEco: {selectedEco ?? "null"}</div>
          <div>isProcessing: {String(isProcessing)}</div>
          <div>isFocusMode: {String(isFocusMode)}</div>
          <div>viewAllEcos: {String(viewAllEcos)}</div>
          <div>overlays: sidebar={String(sidebarOpen)} profile={String(showProfile)} stopConfirm={String(showStopConfirm)}</div>
        </div>
      )}
    </div>
  );
}
