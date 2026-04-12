"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import Logo from "@/components/Logo";
import { Sparkles, ArrowRight, Settings, ArrowLeft, Mic, Monitor, FileText, Loader2, LogIn } from "lucide-react";
import { useUser, useClerk } from "@clerk/nextjs";
import EcoView from "@/components/EcoView";
import RecordButton from "@/components/RecordButton";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Eco } from "@/types";
import { getEcos } from "@/lib/storage";
import { createPipelineTraceId, uploadAndComplete, completeAndTranscribeFromR2 } from "@/lib/transcription";
import { extractTextFromPdf, buildPdfContextBlock } from "@/lib/pdfExtractor";
import { MAX_RECORDING_DURATION_MINUTES } from "@/lib/billingConfig";
import { motion, AnimatePresence } from "framer-motion";

// Compteur d'appels API — dev uniquement
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as Record<string, unknown>).__ecoApiCalls = (window as unknown as Record<string, unknown>).__ecoApiCalls ?? 0;
  const _origFetch = window.fetch.bind(window);
  window.fetch = (...args) => {
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
    if (url.startsWith("/api/")) {
      (window as unknown as Record<string, unknown>).__ecoApiCalls = ((window as unknown as Record<string, unknown>).__ecoApiCalls as number) + 1;
      console.log(`[API_COUNTER] #${(window as unknown as Record<string, unknown>).__ecoApiCalls} → ${url}`);
    }
    return _origFetch(...args);
  };
}

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
  const { user, isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userPlan, setUserPlan] = useState<string>(() => {
    if (typeof window === "undefined") return "free";
    return sessionStorage.getItem("eco_billing_plan") || "free";
  });
  const [isBillingLoading, setIsBillingLoading] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return !sessionStorage.getItem("eco_billing_plan");
  });
  const [paymentBlocked, setPaymentBlocked] = useState(false);
  const [billingInfo, setBillingInfo] = useState<{
    plan: string;
    minutesPerMonth: number;
    availableMinutes: number;
    bonusMinutes: number;
    paymentBlocked: boolean;
  } | null>(null);
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [processingDurationMinutes, setProcessingDurationMinutes] = useState(0);
  const [processingStep, setProcessingStep] = useState<"uploading" | "transcribing" | "summarizing">("uploading");
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [ecos, setEcos] = useState<Eco[]>([]);
  const [isEcosLoading, setIsEcosLoading] = useState(true);

  const [soundLevel, setSoundLevel] = useState(1);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vizAudioCtxRef = useRef<AudioContext | null>(null);
  const vizAnimFrameRef = useRef<number | null>(null);
  const vizSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // PDF context
  const [pdfFiles, setPdfFiles] = useState<Array<{ name: string; text: string }>>([]);
  const [isPdfExtracting, setIsPdfExtracting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [showPdfPopover, setShowPdfPopover] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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
    if (process.env.NODE_ENV === "development") {
      console.log("[loadEcos] Début");
    }
    setIsEcosLoading(true);
    try {
      const res = await fetch("/api/ecos?limit=30", { cache: "no-store" });
      const t1 = performance.now();
      const duration = t1 - t0;
      if (res.ok) {
        const data = await res.json();
        const payloadSize = JSON.stringify(data).length;
        if (process.env.NODE_ENV === "development") {
          console.log(`[loadEcos] Succès - ${duration.toFixed(0)}ms - ${payloadSize} bytes - ${data.ecos?.length || 0} ECOs`);
        }
        setEcos(data.ecos || []);
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log(`[loadEcos] Erreur ${res.status} - ${duration.toFixed(0)}ms`);
        }
        setEcos([]);
      }
    } catch (error) {
      const duration = performance.now() - t0;
      if (process.env.NODE_ENV === "development") {
        console.error(`[loadEcos] Exception - ${duration.toFixed(0)}ms`, error);
      }
      setEcos([]);
    } finally {
      setIsEcosLoading(false);
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
          if (process.env.NODE_ENV === "development") {
            console.error("Erreur lors de la migration des ECOs:", error);
          }
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
        if (process.env.NODE_ENV === "development") {
          console.log("[eco-updated] Déclenchement loadEcos (debounced)");
        }
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
      if (process.env.NODE_ENV === "development") {
        console.warn("[Safety] État incohérent détecté (selectedEco vide mais currentEco présent), sync currentEco → null");
      }
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
      if (process.env.NODE_ENV === "development") {
        console.log(`[loadCurrentEco] Utilisation cache pour ${selectedEco}`);
      }
      setCurrentEco(cached.data);
      return;
    }
    
    const loadCurrentEco = async () => {
      const t0 = performance.now();
      if (process.env.NODE_ENV === "development") {
        console.log(`[loadCurrentEco] Fetch ${selectedEco}`);
      }
      try {
        const res = await fetch(`/api/ecos/${selectedEco}`, { cache: "no-store" });
        const t1 = performance.now();
        const duration = t1 - t0;
        // Guard: abandon si navigation arrière déclenchée pendant le fetch
        if (isNavigatingHomeRef.current) return;
        if (res.ok) {
          const data = await res.json();
          const payloadSize = JSON.stringify(data).length;
          if (process.env.NODE_ENV === "development") {
            console.log(`[loadCurrentEco] Succès - ${duration.toFixed(0)}ms - ${payloadSize} bytes`);
          }
          if (data.eco && !isNavigatingHomeRef.current) {
            setCurrentEco(data.eco);
            // Mettre en cache
            currentEcoCacheRef.current = { id: selectedEco, data: data.eco, timestamp: Date.now() };
          }
        } else {
          if (process.env.NODE_ENV === "development") {
            console.log(`[loadCurrentEco] Erreur ${res.status} - ${duration.toFixed(0)}ms`);
          }
          // Ne pas naviguer vers l'accueil sur erreur API : l'eco pourrait être temporairement indisponible
          currentEcoCacheRef.current = null;
        }
      } catch (error) {
        const duration = performance.now() - t0;
        if (process.env.NODE_ENV === "development") {
          console.error(`[loadCurrentEco] Exception - ${duration.toFixed(0)}ms`, error);
        }
        // Ne pas naviguer vers l'accueil sur exception réseau
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
        if (process.env.NODE_ENV === "development") {
          console.log(`[refreshCurrentEco] Refresh ${ecoId}`);
        }
        try {
          const res = await fetch(`/api/ecos/${ecoId}`, { cache: "no-store" });
          if (isNavigatingHomeRef.current) return;
          const t1 = performance.now();
          const duration = t1 - t0;
          if (res.ok) {
            const data = await res.json();
            if (process.env.NODE_ENV === "development") {
              console.log(`[refreshCurrentEco] Succès - ${duration.toFixed(0)}ms`);
            }
            if (data.eco && !isNavigatingHomeRef.current) {
              setCurrentEco(data.eco);
              currentEcoCacheRef.current = { id: ecoId, data: data.eco, timestamp: Date.now() };
            }
          } else {
            if (process.env.NODE_ENV === "development") {
              console.log(`[refreshCurrentEco] Erreur ${res.status} - ${duration.toFixed(0)}ms`);
            }
            // Ne pas naviguer vers l'accueil sur erreur : l'eco est peut-être temporairement indisponible
            currentEcoCacheRef.current = null;
          }
        } catch (error) {
          const duration = performance.now() - t0;
          if (process.env.NODE_ENV === "development") {
            console.error(`[refreshCurrentEco] Exception - ${duration.toFixed(0)}ms`, error);
          }
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
    if (!isSignedIn) {
      setUserPlan("free");
      setIsBillingLoading(false);
      setBillingInfo(null);
      if (typeof window !== "undefined") sessionStorage.removeItem("eco_billing_plan");
      return;
    }
    const fetchPlan = async () => {
      setIsBillingLoading(true);
      try {
        const res = await fetch("/api/billing/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const plan = data.plan || "free";
          setUserPlan(plan);
          setPaymentBlocked(data.paymentBlocked === true);
          const bonusMinutes = data.bonusSeconds ? Math.floor(data.bonusSeconds / 60) : 0;
          setBillingInfo({
            plan,
            minutesPerMonth: data.minutesPerMonth ?? 0,
            availableMinutes: data.availableMinutes ?? 0,
            bonusMinutes,
            paymentBlocked: data.paymentBlocked === true,
          });
          if (typeof window !== "undefined") {
            sessionStorage.setItem("eco_billing_plan", plan);
          }
        }
      } catch {
        setUserPlan("free");
        setPaymentBlocked(false);
        setBillingInfo(null);
      } finally {
        setIsBillingLoading(false);
      }
    };
    fetchPlan();
  }, [isSignedIn]);

  const startRecording = async (mode: "mic" | "screen" = "mic") => {
    setIsPaused(false);
    setRecordingElapsedSeconds(0);

    try {
      if (process.env.NODE_ENV === "development") {
        console.log("[startRecording] mode:", mode);
      }

      let stream: MediaStream | null = null;

      if (mode === "screen") {
        // === AUDIO SYSTÈME (getDisplayMedia) ===
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: 44100,
          },
        });

        const audioTrack = displayStream.getAudioTracks()[0];
        if (!audioTrack) {
          displayStream.getTracks().forEach((t) => t.stop());
          throw new Error("SCREEN_AUDIO_NONE");
        }

        // La piste vidéo n'est pas nécessaire
        displayStream.getVideoTracks().forEach((t) => t.stop());
        stream = new MediaStream([audioTrack]);
      } else {
      // === SÉLECTION INTELLIGENTE DU MICRO ===
      // Énumérer tous les devices et exclure les devices virtuels connus
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter((d) => d.kind === "audioinput");

      if (audioInputs.length === 0) {
        throw new Error("MICRO_NOT_DETECTED");
      }

      const blacklist = ["virtual", "teams", "zoom", "blackhole", "loopback", "soundflower", "aggregate", "multi-output", "défaut", "default", "par défaut"];
      const preferredKeywords = ["built-in", "macbook", "intégré", "internal", "microphone intégré"];

      // 1. Chercher un vrai micro physique identifié par mot-clé
      // 2. Sinon : premier device qui n'est pas blacklisté
      // 3. Dernier recours : dernier device de la liste
      const preferredMic =
        audioInputs.find((d) => preferredKeywords.some((k) => d.label.toLowerCase().includes(k))) ||
        audioInputs.find((d) => !blacklist.some((b) => d.label.toLowerCase().includes(b))) ||
        audioInputs[audioInputs.length - 1];

      console.log("[ECO] Device sélectionné:", preferredMic.label, preferredMic.deviceId);

      // Mettre le device préféré en tête, les autres en fallback
      const sortedDevices = [
        preferredMic,
        ...audioInputs.filter((d) => d.deviceId !== preferredMic.deviceId),
      ];

      // Trouver le meilleur device via test de signal (500ms)
      let fallbackStream: MediaStream | null = null;

      for (const device of sortedDevices) {
        let testStream: MediaStream | null = null;
        try {
          testStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: device.deviceId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });

          // Garder le premier device accessible comme fallback si aucun ne produit de signal
          if (!fallbackStream) {
            fallbackStream = testStream;
          }

          // Vérifier que le device produit du signal
          const testCtx = new AudioContext();
          await testCtx.resume();
          const testSource = testCtx.createMediaStreamSource(testStream);
          const testAnalyser = testCtx.createAnalyser();
          testAnalyser.fftSize = 256;
          testSource.connect(testAnalyser);
          await new Promise((r) => setTimeout(r, 500));
          const testData = new Uint8Array(testAnalyser.frequencyBinCount);
          testAnalyser.getByteFrequencyData(testData);
          const testLevel = Math.max(...Array.from(testData));
          testCtx.close();

          console.log("[ECO] Niveau micro test:", testLevel, "— Device:", device.label);

          if (testLevel > 0) {
            stream = testStream;
            break;
          } else {
            console.warn("[ECO] Device silencieux, essai device suivant:", device.label);
            // Ne pas stopper le fallbackStream, stopper les autres
            if (testStream !== fallbackStream) {
              testStream.getTracks().forEach((t) => t.stop());
            }
          }
        } catch (e) {
          console.warn("[ECO] Impossible d'accéder au device:", device.label, e);
          testStream?.getTracks().forEach((t) => t.stop());
        }
      }

      // Si aucun device n'a produit de signal (user silencieux au moment du test),
      // utiliser le fallback (premier device réel accessible) plutôt que de bloquer
      if (!stream) {
        if (fallbackStream) {
          console.warn("[ECO] Aucun signal détecté — utilisation du fallback:", sortedDevices[0]?.label);
          stream = fallbackStream;
        } else {
          throw new Error("MICRO_NOT_DETECTED");
        }
      } else if (fallbackStream && fallbackStream !== stream) {
        // Stopper le fallback si on a trouvé mieux
        fallbackStream.getTracks().forEach((t) => t.stop());
      }
      // === FIN SÉLECTION MICRO ===
      } // fin else mode mic

      if (!stream || stream.getAudioTracks().length === 0) {
        throw new Error("Aucune piste audio disponible");
      }

      // === VISUALISEUR INLINE — création immédiate après getUserMedia ===
      // Cleanup du visualiseur précédent si existant
      if (vizAnimFrameRef.current !== null) {
        cancelAnimationFrame(vizAnimFrameRef.current);
        vizAnimFrameRef.current = null;
      }
      vizSourceRef.current?.disconnect();
      vizSourceRef.current = null;
      analyserRef.current = null;
      vizAudioCtxRef.current?.close().catch(() => {});
      vizAudioCtxRef.current = null;

      try {
        const audioCtx = new AudioContext();
        if (audioCtx.state !== "running") {
          await audioCtx.resume();
          await new Promise((r) => setTimeout(r, 200));
        }
        if (process.env.NODE_ENV === "development") {
          console.log("[visualiseur] AudioContext state:", audioCtx.state, "| audio tracks:", stream.getAudioTracks().length);
        }
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        vizSourceRef.current = source;
        analyserRef.current = analyser;
        vizAudioCtxRef.current = audioCtx;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteFrequencyData(data);
          const vol = Math.max(...Array.from(data)) / 255;
          setSoundLevel(0.95 + vol * 0.23);
          vizAnimFrameRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (vizErr) {
        console.error("[visualiseur] échec:", vizErr);
      }
      // === FIN VISUALISEUR ===

      // Réinitialiser les chunks
      audioChunksRef.current = [];
      if (process.env.NODE_ENV === "development") {
        console.log("[startRecording] Chunks réinitialisés");
      }

      // Détection mimeType — priorité opus pour compatibilité Whisper
      const chosenMimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      mimeTypeRef.current = chosenMimeType;

      // 16kbps — suffisant pour la voix, garantit <7.2MB pour 60min (limite Whisper : 25MB)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: chosenMimeType,
        audioBitsPerSecond: 16000,
      });

      if (process.env.NODE_ENV === "development") {
        console.log("[ECO] bitrate:", mediaRecorder.audioBitsPerSecond, "| mimeType:", mediaRecorder.mimeType);
      }

      // IMPORTANT: Définir TOUS les handlers AVANT start()
      mediaRecorder.ondataavailable = (e) => {
        if (process.env.NODE_ENV === "development") {
          console.log("[ondataavailable] size:", e.data?.size ?? 0, "type:", e.data?.type ?? "unknown");
        }
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          if (process.env.NODE_ENV === "development") {
            console.log("[Chunk collecté] Total chunks:", audioChunksRef.current.length);
          }
        }
      };

      mediaRecorder.onstop = async () => {
        if (process.env.NODE_ENV === "development") {
          console.log("[onstop] Chunks collectés:", audioChunksRef.current.length);
        }
        // Cleanup visualiseur inline
        if (vizAnimFrameRef.current !== null) {
          cancelAnimationFrame(vizAnimFrameRef.current);
          vizAnimFrameRef.current = null;
        }
        vizSourceRef.current?.disconnect();
        vizSourceRef.current = null;
        analyserRef.current = null;
        vizAudioCtxRef.current?.close().catch(() => {});
        vizAudioCtxRef.current = null;
        setSoundLevel(1);

        startTimeRef.current = null;
        totalPausedMsRef.current = 0;
        pausedAtRef.current = null;

        if (audioChunksRef.current.length === 0) {
          if (process.env.NODE_ENV === "development") {
            console.error("[onstop] AUCUN CHUNK!");
          }
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
        console.log(`[ECO] Blob final — ${sizeMB} MB | ${audioBlob.type} | ${audioChunksRef.current.length} chunks | ${elapsedAtStopRef.current}s`);

        // Sécurité : refuser si > 24MB (limite Whisper 25MB)
        if (audioBlob.size > 24 * 1024 * 1024) {
          setIsRecording(false);
          setIsProcessing(false);
          setIsFocusMode(false);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          alert(`Enregistrement trop volumineux (${sizeMB} MB). Limite : 60 min. Veuillez réessayer.`);
          return;
        }

        const durationSeconds = elapsedAtStopRef.current;
        await processRecording(audioBlob, durationSeconds, mimeTypeUsed, mode);
        // Libérer les PDFs après traitement
        setPdfFiles([]);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.onerror = (e) => {
        if (process.env.NODE_ENV === "development") {
          console.error("[MediaRecorder] Erreur:", e);
        }
      };

      // Stocker dans ref
      mediaRecorderRef.current = mediaRecorder;

      // Stocker le stream tout de suite pour que Chrome le considère utilisé
      streamRef.current = stream;

      // Démarrer avec timeslice 1000ms pour collecter régulièrement (évite que Chrome coupe le stream)
      mediaRecorder.start(1000);
      if (process.env.NODE_ENV === "development") {
        console.log("[MediaRecorder] start(1000) appelé, state:", mediaRecorder.state);
      }

      // Initialiser le timer
      startTimeRef.current = Date.now();
      totalPausedMsRef.current = 0;
      pausedAtRef.current = null;

      // Afficher FocusMode
      setIsFocusMode(true);
      setIsRecording(true);
      // Scroll immédiat vers le haut (mobile)
      if (typeof window !== "undefined") {
        setTimeout(() => window.scrollTo({ top: 0, behavior: "auto" }), 50);
      }
      if (process.env.NODE_ENV === "development") {
        console.log("[startRecording] Tout initialisé");
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[startRecording] Erreur:", error);
      }
      // Cleanup visualiseur si erreur au démarrage
      if (vizAnimFrameRef.current !== null) {
        cancelAnimationFrame(vizAnimFrameRef.current);
        vizAnimFrameRef.current = null;
      }
      vizAudioCtxRef.current?.close().catch(() => {});
      vizAudioCtxRef.current = null;
      analyserRef.current = null;
      setIsFocusMode(false);
      setIsRecording(false);
      const errMsg = error instanceof Error && error.message === "MICRO_NOT_DETECTED"
        ? "Micro non détecté. Vérifiez vos permissions Chrome dans Préférences Système → Confidentialité → Microphone."
        : error instanceof Error && error.message === "SCREEN_AUDIO_NONE"
        ? "Aucun audio système capté. Dans la popup Chrome, cochez 'Partager l'audio système' avant de valider."
        : (error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError"))
        ? null // User cancelled the picker — no alert needed
        : "Impossible d'accéder au microphone. Veuillez autoriser l'accès.";
      if (errMsg) alert(errMsg);
    }
  };

  const stopRecording = () => {
    setShowStopConfirm(true);
  };

  const confirmStop = () => {
    if (process.env.NODE_ENV === "development") {
      console.log("[confirmStop] T0 stop clicked", { ts: Date.now() });
    }
    
    // Calculer la durée EXACTE en millisecondes
    const endTime = Date.now();
    const startTime = startTimeRef.current;
    if (startTime === null) {
      if (process.env.NODE_ENV === "development") {
        console.error("[confirmStop] startTimeRef.current est null");
      }
      setIsRecording(false);
      setIsProcessing(false);
      setIsFocusMode(false);
      setShowStopConfirm(false);
      return;
    }
    
    const durationMs = endTime - startTime - totalPausedMsRef.current;
    const durationSeconds = durationMs / 1000; // PRÉCIS à 2 décimales
    const durationMinutes = durationSeconds / 60; // PRÉCIS
    
    if (process.env.NODE_ENV === "development") {
      console.log("[confirmStop] Durée exacte calculée", {
      durationMs: durationMs.toFixed(0),
      durationSeconds: durationSeconds.toFixed(2),
      durationMinutes: durationMinutes.toFixed(2),
    });
    }
    
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
      if (process.env.NODE_ENV === "development") {
        console.log("[confirmStop] MediaRecorder.stop() appelé");
      }

      // Arrêter le stream après l'arrêt du MediaRecorder
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (process.env.NODE_ENV === "development") {
          console.log("[confirmStop] Stream arrêté");
        }
      }
    } else {
      if (process.env.NODE_ENV === "development") {
        console.warn("[confirmStop] MediaRecorder non disponible ou pas en recording", {
        hasRef: !!mediaRecorderRef.current,
        state: mediaRecorderRef.current?.state,
        isRecording,
      });
      }
    }
    setProcessingDurationMinutes(durationSeconds / 60);
    setProcessingStep("uploading");
    setProcessingError(null);
    setIsRecording(false);
    setIsProcessing(true);
    setIsFocusMode(false);
    setShowStopConfirm(false);
  };

  const processRecording = async (audioBlob: Blob, durationSeconds: number, mimeType: string = "audio/webm", sourceType: "mic" | "screen" = "mic") => {
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
      if (process.env.NODE_ENV === "development") {
        console.log("[processRecording] Demande presigned URL…", {
        contentType,
        fileSizeBytes: fileSize,
        sizeMB: (fileSize / 1024 / 1024).toFixed(2),
      });
      }

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

      if (process.env.NODE_ENV === "development") {
        console.log("[processRecording] Upload direct vers R2…");
      }
      const uploadPutRes = await fetch(presignedUrl, {
        method: "PUT",
        body: audioBlob,
        headers: { "Content-Type": contentType },
      });
      logStep({ step: "uploadR2Direct", status: uploadPutRes.status });

      if (!uploadPutRes.ok) {
        throw new Error("Échec de l’upload vers le stockage (R2). Réessayez.");
      }
      if (process.env.NODE_ENV === "development") {
        console.log("[processRecording] Upload R2 réussi", { fileId, r2Key });
      }

      const pdfContext = pdfFiles.length > 0 ? buildPdfContextBlock(pdfFiles) : undefined;
      const initBody: Record<string, unknown> = {
        durationSeconds,
        mimeType,
        traceId,
        fileId,
        r2Key,
        sourceType,
        ...(pdfContext && { pdfContext }),
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

      // Débit du quota + démarrage transcription (backend non bloquant)
      await completeAndTranscribeFromR2(recordingId, durationSeconds, traceId, logStep);
      setProcessingStep("transcribing");

      // Préparer l'Eco minimal en mémoire (pas encore affiché — on attend DONE)
      const newEco: Eco = {
        ...minimalEco,
        transcription_text: "",
        summary_text: null,
        folder: "",
      };
      setIsFocusMode(false);
      setSelectedEco(newEco.id);
      setCurrentEco(newEco);
      setSelectedFolder(null);
      setRefreshKey((prev) => prev + 1);

      // Rafraîchir le quota UI (minutes en haut à droite)
      window.dispatchEvent(new Event("quota-updated"));

      // Polling statut recording → chargement ECO complet quand DONE
      await new Promise<void>((resolve, reject) => {
        const startTs = Date.now();
        let statusPollCount = 0;
        const MAX_STATUS_POLLS = 40; // 40 × 8s = 320s max
        if (process.env.NODE_ENV !== "production") {
          console.log(`[pollRecordingStatus] Démarrage — max ${MAX_STATUS_POLLS} tentatives × 8s`);
        }
        const interval = setInterval(async () => {
          statusPollCount++;
          if (process.env.NODE_ENV !== "production") {
            console.log(`[pollRecordingStatus] #${statusPollCount}/${MAX_STATUS_POLLS}`);
          }

          // Sécurité : max tentatives atteint
          if (statusPollCount >= MAX_STATUS_POLLS) {
            clearInterval(interval);
            setIsProcessing(false);
            const message = "Génération trop longue, réessayez.";
            if (process.env.NODE_ENV !== "production") {
              console.warn("[pollRecordingStatus] Max tentatives atteint", { recordingId });
            }
            setProcessingError(message);
            reject(new Error("Polling max attempts"));
            return;
          }

          try {
            const res = await fetch(`/api/recordings/${recordingId}/status`);
            if (!res.ok) {
              if (process.env.NODE_ENV === "development") {
                console.warn("[pollRecordingStatus] Statut HTTP non OK", {
                  status: res.status,
                  recordingId,
                });
              }
              return;
            }
            const { status, error } = await res.json();

            if (status === "DONE") {
              clearInterval(interval);
              if (process.env.NODE_ENV !== "production") {
                console.log(`[pollRecordingStatus] DONE après ${statusPollCount} appels (${((Date.now() - startTs) / 1000).toFixed(0)}s)`);
              }

              try {
                const getRes = await fetch(`/api/ecos/${recordingId}`, {
                  cache: "no-store",
                  headers: traceId ? { "x-eco-trace": traceId } : undefined,
                });
                logStep({ step: "getEco", status: getRes.status });
                if (getRes.ok) {
                  const data = await getRes.json();
                  if (data.eco) {
                    setCurrentEco(data.eco);
                    currentEcoCacheRef.current = {
                      id: recordingId!,
                      data: data.eco,
                      timestamp: Date.now(),
                    };
                  }
                }
              } catch (e) {
                if (process.env.NODE_ENV === "development") {
                  console.error("[pollRecordingStatus] Erreur chargement ECO", e);
                }
              }

              window.dispatchEvent(new Event("eco-updated"));
              setIsProcessing(false);
              resolve();
            } else if (status === "ERROR") {
              clearInterval(interval);
              setIsProcessing(false);
              const message =
                error || "Une erreur est survenue pendant le traitement. Réessayez.";
              if (process.env.NODE_ENV === "development") {
                console.error("[pollRecordingStatus] ERROR", { recordingId, message });
              }
              setProcessingError(message);
              reject(new Error(message));
            } else if (status === "TRANSCRIBED") {
              setProcessingStep("summarizing");
              if (process.env.NODE_ENV === "development") {
                console.log("[pollRecordingStatus] TRANSCRIBED (attente résumé)…", {
                  recordingId,
                });
              }
            } else {
              setProcessingStep("transcribing");
              if (process.env.NODE_ENV === "development") {
                const elapsed = ((Date.now() - startTs) / 1000).toFixed(0);
                console.log("[pollRecordingStatus] Toujours en traitement…", {
                  recordingId,
                  status,
                  elapsedSeconds: elapsed,
                });
              }
            }
          } catch (e) {
            clearInterval(interval);
            setIsProcessing(false);
            if (process.env.NODE_ENV === "development") {
              console.error("[pollRecordingStatus] Exception", e);
            }
            reject(e as Error);
          }
        }, 8000);
      });

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
      if (process.env.NODE_ENV === "development") {
        console.error("[processRecording] Erreur:", error);
      }
      setIsProcessing(false);
      setIsFocusMode(false);
      const err = error as { message?: string; status?: number };
      const isRateLimit =
        err?.status === 429 ||
        (err?.message != null && (err.message.includes("429") || err.message.includes("Trop d")));
      if (isRateLimit) {
        alert("Vous avez atteint la limite de requêtes. Veuillez patienter quelques minutes.");
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Une erreur est survenue lors du traitement.";
        alert(errorMessage);
      }
    }
  };

  const handlePdfSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 1 - pdfFiles.length;
    if (remaining <= 0) return;

    const toProcess = Array.from(files).slice(0, remaining);
    setPdfError(null);
    setIsPdfExtracting(true);

    const results: Array<{ name: string; text: string }> = [];
    for (const file of toProcess) {
      try {
        const text = await extractTextFromPdf(file);
        results.push({ name: file.name, text });
      } catch (err) {
        setPdfError(err instanceof Error ? err.message : "Erreur lecture PDF");
      }
    }

    setPdfFiles((prev) => [...prev, ...results].slice(0, 1));
    setIsPdfExtracting(false);
    // Reset input pour permettre de re-sélectionner le même fichier
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  };

  const removePdf = (index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index));
    setPdfError(null);
  };

  const handleStartRecording = () => {
    if (paymentBlocked) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      setShowAuthModal(true);
      return;
    }
    if (!isRecording) {
      startRecording("mic");
    }
  };

  const handleStartSystemAudioRecording = () => {
    if (paymentBlocked) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      setShowAuthModal(true);
      return;
    }
    if (!isRecording) {
      startRecording("screen");
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
    }, 600);
  }, []);

  const goHome = resetToHome;

  const handleEcoClick = (eco: Eco) => {
    setSelectedEco(eco.id);
    setSelectedFolder(eco.folder && eco.folder !== "" ? eco.folder : null);
    setViewAllEcos(false);
  };

  const currentView: CurrentView = isFocusMode
    ? "recording"
    : isProcessing
    ? "generating"
    : selectedEco
    ? "detail"
    : "home";

  // Desktop : FocusMode plein écran exclusif
  if (isDesktop && isFocusMode) {
    return (
      <div className="min-h-screen text-gray-900 relative overflow-hidden">
        <div className="fixed inset-0 aura-gradient -z-10" aria-hidden />
        <FocusMode
          isActive={isFocusMode}
          isRecording={isRecording}
          isPaused={isPaused}
          onTogglePause={() => setIsPaused((p) => !p)}
          soundLevel={soundLevel}
          showMicroWarning={false}
          onStartRecording={handleStartRecording}
          onStopRecording={stopRecording}
          showStopConfirm={showStopConfirm}
          onConfirmStop={confirmStop}
          onCancelStop={() => setShowStopConfirm(false)}
          recordingElapsedSeconds={recordingElapsedSeconds}
          analyserRef={analyserRef}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 flex relative overflow-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 aura-gradient -z-10" aria-hidden />

      <>
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
          userName={user?.firstName ? `${user.firstName}${user?.lastName ? " " + user.lastName : ""}` : user?.username || undefined}
          userImageUrl={user?.imageUrl}
        />

        {/* Contenu principal */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 lg:min-w-0">
          {!isFocusMode && (
            <Header
              onGoHome={goHome}
              onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
              isDetailView={!!selectedEco || isProcessing}
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
              userName={user?.firstName ? `${user.firstName}${user?.lastName ? " " + user.lastName : ""}` : user?.username || undefined}
            />
          )}

          <main className="flex-1 overflow-y-auto overflow-x-hidden pt-6">
            <div className={`${sidebarOpen ? "" : "max-w-3xl mx-auto"} px-4 md:px-6 lg:px-8`}>
              <AnimatePresence mode="wait">
                  {(() => {
                    const conditionHome = !selectedEco && !isFocusMode && !viewAllEcos && !isProcessing;
                    const conditionList = viewAllEcos && !selectedEco && !isFocusMode && !isProcessing;
                    const conditionDetail = selectedEco && !isFocusMode && !viewAllEcos && !isProcessing;
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
                          className="mb-4 px-4 py:3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-center text-sm font-medium max-w-md"
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
                        className="text-2xl font-medium text-slate-700 mt-4"
                      >
                        Bonjour, {user?.firstName ? `${user.firstName}.` : "!"}
                      </motion.h1>
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
                        className="flex flex-col sm:flex-row gap-3 mt-4"
                      >
                        <motion.button
                          whileHover={{ scale: 1.04, y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleStartRecording}
                          disabled={paymentBlocked}
                          className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm bg-gradient-to-r from-[#99f6e4] via-[#7dd3fc] to-[#a5b4fc] text-gray-900 shadow-sm hover:opacity-90 transition-all disabled:opacity-40"
                        >
                          <Mic className="w-4 h-4 text-gray-900" />
                          Enregistrer
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.04, y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleStartSystemAudioRecording}
                          disabled={paymentBlocked}
                          className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm bg-white/40 backdrop-blur-md border border-gray-300 text-gray-600 shadow-sm hover:bg-white/60 hover:border-gray-400 transition-all disabled:opacity-40"
                        >
                          <Monitor className="w-4 h-4 text-gray-500" />
                          Capturer l&apos;audio
                        </motion.button>
                      </motion.div>

                      {/* Lien PDF de contexte + liste des PDFs sélectionnés */}
                      <div className="mt-4 flex flex-col items-center gap-2">
                        {/* Input caché */}
                        <input
                          ref={pdfInputRef}
                          type="file"
                          accept=".pdf"
                          multiple
                          className="hidden"
                          onChange={(e) => handlePdfSelect(e.target.files)}
                        />

                        {/* Lien discret + popover */}
                        {pdfFiles.length < 1 && (
                          <div className="relative">
                            <button
                              onClick={() => !isPdfExtracting && setShowPdfPopover(true)}
                              disabled={isPdfExtracting}
                              className="text-sm text-violet-500 hover:text-violet-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              {isPdfExtracting ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Lecture du PDF en cours...
                                </>
                              ) : (
                                <>
                                  <FileText className="w-4 h-4" />
                                  Ajouter un PDF de contexte
                                  <span className="text-gray-300 text-xs ml-1">(optionnel)</span>
                                </>
                              )}
                            </button>

                            {/* Popover explicatif */}
                            {showPdfPopover && (
                              <>
                                {/* Overlay pour fermer au clic extérieur */}
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setShowPdfPopover(false)}
                                />
                                <motion.div
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 6 }}
                                  transition={{ duration: 0.18, ease: "easeOut" }}
                                  className="absolute z-50 left-1/2 -translate-x-1/2 mt-3 w-[300px] sm:w-[320px] bg-white rounded-2xl shadow-xl border border-gray-100 p-5 flex flex-col gap-4"
                                >
                                  <div>
                                    <p className="font-semibold text-gray-800 text-sm mb-2">📄 PDF de contexte</p>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                      Ajoute un document de cours avant d&apos;enregistrer. L&apos;IA s&apos;appuiera dessus pour mieux comprendre le vocabulaire et les notions de ton cours — le résumé, les points clés et le quiz seront plus précis et adaptés à ton contenu.
                                    </p>
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <button
                                      onClick={() => {
                                        setShowPdfPopover(false);
                                        pdfInputRef.current?.click();
                                      }}
                                      className="w-full py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-[#99f6e4] via-[#7dd3fc] to-[#a5b4fc] text-gray-900 hover:opacity-90 transition-all"
                                    >
                                      Ajouter un PDF
                                    </button>
                                    <button
                                      onClick={() => setShowPdfPopover(false)}
                                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors text-center py-1"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </motion.div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Erreur extraction */}
                        {pdfError && (
                          <p className="text-xs text-red-500 max-w-xs text-center">{pdfError}</p>
                        )}

                        {/* Liste des PDFs + badge */}
                        {pdfFiles.length > 0 && (
                          <div className="flex flex-col items-center gap-1 mt-1">
                            <span className="text-xs font-semibold text-violet-600 flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" />
                              PDF de contexte ajouté
                            </span>
                            {pdfFiles.map((pdf, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-gray-500 bg-white/60 border border-white/50 rounded-full px-3 py-1">
                                <span className="truncate max-w-[180px]">{pdf.name}</span>
                                <button
                                  onClick={() => removePdf(i)}
                                  className="text-gray-400 hover:text-red-500 transition-colors font-bold leading-none"
                                  aria-label="Supprimer"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {isBillingLoading ? (
                        <div
                          className="mt-6 px-7 py-3 rounded-full flex items-center gap-2 bg-gray-100 animate-pulse"
                          style={{ minHeight: 44 }}
                        >
                          <div className="w-4 h-4 rounded bg-gray-300 shrink-0" />
                          <div className="h-4 w-40 rounded bg-gray-300" />
                        </div>
                      ) : userPlan === "free" ? (
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
                      ) : null}

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
                            <button
                              onClick={() => setViewAllEcos(true)}
                              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              Voir tout
                            </button>
                          )}
                        </div>

                        {/* Skeleton loaders pendant le chargement */}
                        {isEcosLoading && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[0, 1, 2].map((i) => (
                              <div
                                key={i}
                                className="bg-white/60 rounded-[2rem] border border-white/70 p-6 animate-pulse"
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-5 h-5 rounded-full bg-gray-200 shrink-0" />
                                  <div className="h-4 bg-gray-200 rounded-full flex-1" />
                                </div>
                                <div className="h-3 bg-gray-100 rounded-full w-24" />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Liste des ECOs */}
                        {!isEcosLoading && ecos.length > 0 && (
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
                        )}

                        {/* Empty state */}
                        {!isEcosLoading && ecos.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Mic className="w-12 h-12 text-gray-200" />
                            <p className="text-gray-700 font-medium text-base">Ton premier ECO t&apos;attend</p>
                            <p className="text-gray-400 text-sm">Lance un enregistrement pour commencer</p>
                          </div>
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
                  {selectedEco && !isFocusMode && !viewAllEcos && !isProcessing && (
                    <motion.div
                      key="detail"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <EcoView
                        eco={
                          currentEco ??
                          (selectedEco
                            ? ({
                                id: selectedEco,
                                title: "Chargement…",
                                audio_url: "",
                                transcription_text: "",
                                summary_text: null,
                                folder: "",
                                created_at: new Date().toISOString(),
                              } satisfies Eco)
                            : null)
                        }
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
                            if (process.env.NODE_ENV === "development") {
                              console.log(`[EcoView.onRefresh] Refresh ${selectedEco}`);
                            }
                            fetch(url, { cache: "no-store" })
                              .then((res) => {
                                const duration = performance.now() - t0;
                                if (process.env.NODE_ENV !== "production") {
                                  console.log("[DEBUG EcoView.onRefresh] ✅ Réponse", { url, status: res.status, recordingId: selectedEco, ecoId: selectedEco });
                                }
                                if (res.ok) {
                                  return res.json();
                                }
                                if (process.env.NODE_ENV === "development") {
                                  console.log(`[EcoView.onRefresh] Erreur ${res.status} - ${duration.toFixed(0)}ms`);
                                }
                                if (process.env.NODE_ENV !== "production") {
                                  console.log("[DEBUG EcoView.onRefresh] ❌ Erreur", { url, status: res.status, recordingId: selectedEco, ecoId: selectedEco });
                                }
                                return null;
                              })
                              .then((data) => {
                                if (data?.eco && !isNavigatingHomeRef.current) {
                                  setCurrentEco(data.eco);
                                  // Mettre en cache
                                  currentEcoCacheRef.current = { id: selectedEco, data: data.eco, timestamp: Date.now() };
                                  // Déclencher eco-updated une seule fois (debounced)
                                  window.dispatchEvent(new Event("eco-updated"));
                                }
                              })
                              .catch((error) => {
                                if (process.env.NODE_ENV === "development") {
                                  console.error("[EcoView.onRefresh] Exception", error);
                                }
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
                  {(isProcessing || processingError) && (
                    <motion.div
                      key="generating"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-6"
                    >
                      {processingError ? (
                        <>
                          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                              <span className="text-red-600 text-xl">✕</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900">Traitement échoué</p>
                            <p className="text-sm text-gray-500">{processingError}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setProcessingError(null); goHome(); }}
                            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Retour à l&apos;accueil</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <Logo state="generating" size={120} showMicroWarning={false} />
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={processingStep}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.3 }}
                              className="flex flex-col items-center gap-2 text-center"
                            >
                              <p className="text-xl font-bold text-gray-800">
                                {processingStep === "uploading" && "Envoi de l\u2019enregistrement\u2026"}
                                {processingStep === "transcribing" && "Transcription en cours\u2026"}
                                {processingStep === "summarizing" && "G\u00e9n\u00e9ration du r\u00e9sum\u00e9\u2026"}
                              </p>
                            </motion.div>
                          </AnimatePresence>
                          {/* Étapes visuelles */}
                          <div className="flex items-center gap-3 mt-2">
                            {(["uploading", "transcribing", "summarizing"] as const).map((step, i) => {
                              const steps = ["uploading", "transcribing", "summarizing"];
                              const currentIdx = steps.indexOf(processingStep);
                              const isDone = i < currentIdx;
                              const isActive = i === currentIdx;
                              return (
                                <span key={step} className="flex items-center gap-3">
                                  <span className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${isDone ? "bg-emerald-400" : isActive ? "bg-gray-800 animate-pulse" : "bg-gray-200"}`} />
                                  {i < 2 && <span className={`w-8 h-px block transition-all duration-500 ${isDone ? "bg-emerald-400" : "bg-gray-200"}`} />}
                                </span>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => goHome()}
                            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mt-2 transition-colors"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Retour à l&apos;accueil</span>
                          </button>
                        </>
                      )}
                    </motion.div>
                  )}
              </AnimatePresence>
            </div>
          </main>
        </div>
      </>

      {/* FocusMode overlay mobile uniquement */}
      {!isDesktop && (
        <FocusMode
          isActive={isFocusMode}
          isRecording={isRecording}
          isPaused={isPaused}
          onTogglePause={() => setIsPaused((p) => !p)}
          soundLevel={soundLevel}
          showMicroWarning={false}
          onStartRecording={handleStartRecording}
          onStopRecording={stopRecording}
          showStopConfirm={showStopConfirm}
          onConfirmStop={confirmStop}
          onCancelStop={() => setShowStopConfirm(false)}
          recordingElapsedSeconds={recordingElapsedSeconds}
          analyserRef={analyserRef}
        />
      )}

      <ProfileView
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        userImageUrl={user?.imageUrl}
        userName={user?.firstName ? `${user.firstName}${user?.lastName ? " " + user.lastName : ""}` : user?.username || undefined}
      />

      {/* Modal connexion requise (utilisateur non authentifié) */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAuthModal(false)}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            aria-hidden="true"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-modal-title"
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <LogIn className="w-8 h-8 text-white" />
              </div>
              <h3 id="auth-modal-title" className="text-2xl font-bold text-center text-gray-900 mb-2">
                Connexion requise
              </h3>
              <p className="text-center text-gray-600 mb-6">
                Vous devez être connecté pour lancer un enregistrement.
                Créez un compte gratuitement en quelques secondes !
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/sign-in")}
                  className="w-full px-6 py-3 min-h-[44px] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl"
                >
                  Se connecter / S&apos;inscrire
                </button>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="w-full px-6 py-3 min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
