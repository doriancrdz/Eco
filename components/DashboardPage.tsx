"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Logo from "@/components/Logo";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Mic, MonitorSpeaker, Paperclip, Search, X } from "lucide-react";
import EcoCardMenu from "@/components/EcoCardMenu";
import { useUser } from "@clerk/nextjs";
import EcoView from "@/components/EcoView";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Eco } from "@/types";
import { getEcos } from "@/lib/storage";
import { createPipelineTraceId, uploadAndComplete, completeAndTranscribeFromR2 } from "@/lib/transcription";
import { extractTextFromPdf, buildPdfContextBlock } from "@/lib/pdfExtractor";
import { MAX_RECORDING_DURATION_MINUTES } from "@/lib/billingConfig";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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



export type CurrentView = "home" | "recording" | "generating" | "detail" | "pricing" | "list";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isSignedIn, isLoaded } = useUser();
  const [greeting, setGreeting] = useState("Bonjour");
  const [canCaptureTab, setCanCaptureTab] = useState(false);
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h >= 18 || h < 5 ? "Bonsoir" : "Bonjour");
    // Aucun navigateur mobile ne permet de capturer le son d'un onglet.
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setCanCaptureTab(!mobile && typeof navigator.mediaDevices?.getDisplayMedia === "function");
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarInitialized = useRef(false);
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

  // Recherche
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Sidebar ouverte par défaut sur desktop
  useEffect(() => {
    if (!sidebarInitialized.current && isDesktop) {
      sidebarInitialized.current = true;
      setSidebarOpen(true);
    }
  }, [isDesktop]);

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
        // displaySurface "browser" ouvre le sélecteur de Chrome sur l'onglet des onglets : c'est là que le son est capturable partout.
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser" } as MediaTrackConstraints,
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
          toast.error("Aucune donnée audio enregistrée. Réessayez.");
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
          toast.error(`Enregistrement trop volumineux (${sizeMB} MB). Limite : 60 min.`);
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
        ? "Micro non détecté. Vérifie tes permissions Chrome dans Préférences Système → Confidentialité → Microphone."
        : error instanceof Error && error.message === "SCREEN_AUDIO_NONE"
        ? "Aucun son capté. Dans la fenêtre de partage, choisis l'onglet du cours et coche « Partager l'audio de l'onglet ». Fonctionne avec Chrome ou Edge sur ordinateur."
        : (error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError"))
        ? null // User cancelled the picker — no alert needed
        : "Impossible d'accéder au microphone. Autorise l'accès dans les paramètres.";
      if (errMsg) toast.error(errMsg);
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
      toast.error(`Enregistrement trop long (${durationMinutes.toFixed(2)} min). La limite est de ${MAX_RECORDING_DURATION_MINUTES} min.`);
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
        const MAX_STATUS_POLLS = 60; // 60 × 8s = 480s : couvre Whisper (≤300s) + résumé (≤120s)
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
              toast.success("ECO sauvegardé !");
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
              toast.error("Erreur de transcription — réessaie.");
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
          toast.error(`Pipeline failed at step: ${failedStep.step} (status ${failedStep.status}). See console.`);
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
        toast.error("Tu as atteint la limite de requêtes. Merci de patienter quelques minutes.");
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Une erreur est survenue lors du traitement.";
        toast.error(errorMessage);
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
    if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false);
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
      <div className="min-h-screen relative overflow-hidden">
        <div className="fixed inset-0 eco-focus-bg -z-10" aria-hidden />
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

  // ── Recherche ────────────────────────────────────────────────────
  const filteredEcos = debouncedQuery.trim() ? ecos.filter((eco) => ecoMatches(eco, debouncedQuery)) : ecos;
  const isSearchActive = debouncedQuery.trim().length > 0;

  const firstName = user?.firstName ?? "";
  const displayName = user?.firstName ? `${user.firstName}${user?.lastName ? " " + user.lastName : ""}` : user?.username || undefined;
  const isFree = !isBillingLoading && userPlan === "free";
  const minutesLeft = billingInfo ? Math.max(0, Math.floor(billingInfo.availableMinutes)) : null;
  const minutesTotal = billingInfo ? billingInfo.minutesPerMonth + billingInfo.bonusMinutes : 0;
  const lowOnMinutes = !!billingInfo && !isFree && minutesTotal > 0 && (minutesLeft ?? 0) / minutesTotal <= 0.15;

  const view: "home" | "all" | "detail" | "processing" =
    isProcessing || processingError ? "processing" : selectedEco ? "detail" : viewAllEcos ? "all" : "home";

  const openAll = () => {
    setSelectedEco(null);
    setSelectedFolder(null);
    setViewAllEcos(true);
  };

  return (
    <div className="mk flex h-screen overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeView={view === "processing" ? "other" : view}
        selectedFolder={selectedFolder}
        selectedEco={selectedEco}
        onSelectEco={handleEcoClick}
        onNavigateHome={() => goHome("sidebar")}
        onNewRecording={() => {
          goHome("sidebar");
          handleStartRecording();
        }}
        onViewAll={openAll}
        onNavigatePricing={() => router.push("/pricing")}
        onManageSubscription={() => router.push("/settings")}
        onNavigateSettings={() => router.push("/settings/preferences")}
        onUpgrade={(packs) => router.push(packs ? "/pricing#packs" : "/pricing")}
        recentEcos={ecos}
        isEcosLoading={isEcosLoading}
        billing={billingInfo}
        billingLoading={isBillingLoading}
        userName={displayName}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          title={view === "detail" ? currentEco?.title : view === "all" ? "Tous mes cours" : undefined}
          onBack={view === "detail" || view === "all" ? () => goHome("back") : undefined}
          showUpgrade={isFree}
          onUpgrade={() => router.push("/pricing")}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            {view === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto w-full max-w-[760px] px-5 pb-24 pt-10 md:pt-16"
              >
                {paymentBlocked && (
                  <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[14px]" style={{ borderColor: "rgba(252,165,165,0.3)", background: "rgba(252,165,165,0.06)", color: "#FECACA" }}>
                    <span>Ton dernier paiement a échoué : l&apos;enregistrement est suspendu.</span>
                    <button type="button" onClick={() => router.push("/settings")} className="app-btn app-btn-primary !h-8 !text-[13px]">
                      Régler le paiement
                    </button>
                  </div>
                )}

                <div className="flex flex-col items-center text-center">
                  <Image src="/logo-eco-v2.png" alt="" width={44} height={44} className="rounded-full" priority />
                  <h1 className="mk-display mt-5 text-[40px] sm:text-[52px]">
                    {greeting}
                    {firstName ? (
                      <>
                        , <span className="italic mk-iris">{firstName}</span>
                      </>
                    ) : null}
                  </h1>
                  <p className="mt-2 text-[15px]" style={{ color: "var(--mk-muted)" }}>
                    Qu&apos;est-ce qu&apos;on enregistre aujourd&apos;hui ?
                  </p>
                </div>

                <div className="app-card mt-9 p-2">
                  <div className="flex flex-col sm:flex-row">
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      disabled={paymentBlocked}
                      className="group flex flex-1 items-center gap-4 rounded-xl p-4 text-left transition-colors hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-105" style={{ background: "var(--mk-text)", color: "#0A0A0B" }}>
                        <Mic className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-medium" style={{ color: "var(--mk-text)" }}>
                          Enregistrer un cours
                        </span>
                        <span className="block text-[13px]" style={{ color: "var(--mk-muted)" }}>
                          Avec le micro de ton appareil
                        </span>
                      </span>
                    </button>
                    {canCaptureTab && (
                    <>
                    <div className="mx-4 h-px sm:mx-0 sm:my-4 sm:h-auto sm:w-px" style={{ background: "var(--mk-line)" }} />
                    <button
                      type="button"
                      onClick={handleStartSystemAudioRecording}
                      disabled={paymentBlocked}
                      className="group flex flex-1 items-center gap-4 rounded-xl p-4 text-left transition-colors hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-transform group-hover:scale-105" style={{ borderColor: "var(--mk-line-strong)", color: "var(--mk-text)" }}>
                        <MonitorSpeaker className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-medium" style={{ color: "var(--mk-text)" }}>
                          Son d&apos;un onglet
                        </span>
                        <span className="block text-[13px]" style={{ color: "var(--mk-muted)" }}>
                          Cours sur Teams, Meet ou Zoom dans Chrome ou Edge
                        </span>
                      </span>
                    </button>
                    </>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t px-2 pb-1 pt-2" style={{ borderColor: "var(--mk-line)" }}>
                    <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => handlePdfSelect(e.target.files)} />
                    {pdfFiles.length > 0 ? (
                      <span className="inline-flex max-w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px]" style={{ background: "rgba(201,184,255,0.1)", color: "#DDD3FF" }}>
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{pdfFiles[0].name}</span>
                        <button type="button" onClick={() => removePdf(0)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Retirer le PDF">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={isPdfExtracting}
                        className="app-btn app-btn-quiet !h-8 !px-2.5 !text-[13px]"
                        title="Le support du prof aide ECO à reprendre son vocabulaire dans les notions et le quiz."
                      >
                        {isPdfExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                        {isPdfExtracting ? "Lecture du PDF…" : "Joindre le PDF du cours"}
                      </button>
                    )}
                    <span className="px-2 text-[12.5px]" style={{ color: "var(--mk-faint)" }}>
                      Jusqu&apos;à {MAX_RECORDING_DURATION_MINUTES} min · fiche prête en quelques minutes
                    </span>
                  </div>
                </div>
                {pdfError && (
                  <p className="mt-3 text-center text-[13px]" style={{ color: "#FCA5A5" }}>
                    {pdfError}
                  </p>
                )}

                {isFree && (
                  <div className="mt-5 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "rgba(201,184,255,0.25)", background: "radial-gradient(120% 140% at 0% 0%, rgba(201,184,255,0.08), transparent 60%)" }}>
                    <div>
                      <p className="text-[14.5px] font-medium" style={{ color: "var(--mk-text)" }}>
                        {minutesLeft !== null ? `Il te reste ${minutesLeft} min sur l'offre gratuite` : "Tu es sur l'offre gratuite"}
                      </p>
                      <p className="mt-1 text-[13.5px]" style={{ color: "var(--mk-muted)" }}>
                        Avec Student : 800 min par mois, soit environ 13 h de cours, pour 19 € par mois sans engagement.
                      </p>
                    </div>
                    <button type="button" onClick={() => router.push("/pricing")} className="app-btn app-btn-primary shrink-0">
                      Voir les offres <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {lowOnMinutes && (
                  <div className="mt-5 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "rgba(252,211,77,0.25)", background: "rgba(252,211,77,0.04)" }}>
                    <p className="text-[14px]" style={{ color: "var(--mk-text)" }}>
                      Plus que {minutesLeft} min ce mois-ci. Un pack de minutes s&apos;ajoute immédiatement et n&apos;expire jamais.
                    </p>
                    <button type="button" onClick={() => router.push("/pricing#packs")} className="app-btn app-btn-ghost shrink-0">
                      Ajouter des minutes
                    </button>
                  </div>
                )}

                <section className="mt-14" aria-labelledby="recents-title">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 id="recents-title" className="text-[15px] font-medium" style={{ color: "var(--mk-text)" }}>
                      Récents
                    </h2>
                    {ecos.length > 0 && (
                      <button type="button" onClick={openAll} className="app-btn app-btn-quiet !h-8 !px-2.5 !text-[13px]">
                        Tout voir <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {isEcosLoading ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="app-card h-[132px] p-5">
                          <div className="h-4 w-3/4 rounded eco-skeleton" />
                          <div className="mt-4 h-3 w-full rounded eco-skeleton" />
                          <div className="mt-2 h-3 w-2/3 rounded eco-skeleton" />
                        </div>
                      ))}
                    </div>
                  ) : ecos.length === 0 ? (
                    <div className="rounded-2xl border border-dashed px-6 py-12 text-center" style={{ borderColor: "var(--mk-line-strong)" }}>
                      <p className="text-[15px] font-medium" style={{ color: "var(--mk-text)" }}>
                        Ton premier cours t&apos;attend
                      </p>
                      <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
                        Lance un enregistrement au début de ton prochain cours. Quelques minutes après la fin, ta fiche apparaîtra ici.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ecos.slice(0, 6).map((eco) => (
                        <EcoCard key={eco.id} eco={eco} query="" onOpen={handleEcoClick} onChanged={loadEcos} />
                      ))}
                    </div>
                  )}
                </section>
              </motion.div>
            )}

            {view === "all" && (
              <motion.div
                key="all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto w-full max-w-[860px] px-5 pb-24 pt-10"
              >
                <h1 className="mk-display text-[40px]">Tous mes cours</h1>
                <p className="mt-1 text-[14px]" style={{ color: "var(--mk-muted)" }}>
                  {ecos.length} cours enregistré{ecos.length > 1 ? "s" : ""}
                </p>
                <div className="relative mt-6">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--mk-faint)" }} />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un titre, une notion, un mot du cours…"
                    className="app-input"
                    autoFocus
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery("")} className="app-icon-btn app-icon-btn-sm absolute right-2 top-1/2 -translate-y-1/2" aria-label="Effacer la recherche">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {filteredEcos.length > 0 ? (
                  <ul className="mt-4 divide-y border-y" style={{ borderColor: "var(--mk-line)" }}>
                    {filteredEcos.map((eco) => (
                      <EcoRow key={eco.id} eco={eco} query={debouncedQuery} onOpen={handleEcoClick} onChanged={loadEcos} />
                    ))}
                  </ul>
                ) : (
                  <div className="py-16 text-center">
                    <p className="text-[14.5px]" style={{ color: "var(--mk-muted)" }}>
                      {isSearchActive ? <>Aucun cours ne correspond à « {debouncedQuery} ».</> : "Aucun cours pour l'instant."}
                    </p>
                    {isSearchActive && (
                      <button type="button" onClick={() => setSearchQuery("")} className="app-btn app-btn-quiet mt-3">
                        Effacer la recherche
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {view === "detail" && (
              <motion.div key="detail" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
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
                    if (!selectedEco) return;
                    currentEcoCacheRef.current = null;
                    fetch(`/api/ecos/${selectedEco}`, { cache: "no-store" })
                      .then((res) => (res.ok ? res.json() : null))
                      .then((data) => {
                        if (data?.eco && !isNavigatingHomeRef.current) {
                          setCurrentEco(data.eco);
                          currentEcoCacheRef.current = { id: selectedEco, data: data.eco, timestamp: Date.now() };
                        }
                      })
                      .catch(() => {});
                  }}
                />
              </motion.div>
            )}

            {view === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto flex w-full max-w-[480px] flex-col items-center px-5 pb-24 pt-14 text-center"
              >
                {processingError ? (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border" style={{ borderColor: "rgba(252,165,165,0.35)", color: "#FCA5A5" }}>
                    <X className="h-6 w-6" />
                  </span>
                ) : (
                  <Logo state="generating" size={96} showMicroWarning={false} />
                )}
                <h1 className="mk-display mt-6 text-[36px]">{processingError ? "Le traitement a échoué" : "On prépare ta fiche"}</h1>
                <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
                  {processingError ??
                    "Tu peux quitter cette page : ton cours apparaîtra dans Récents dès qu'il sera prêt."}
                </p>

                {!processingError && (
                  <ol className="app-card mt-8 w-full space-y-4 p-5 text-left">
                    {PROCESSING_STEPS.map((step, i) => {
                      const current = PROCESSING_STEPS.findIndex((s) => s.key === processingStep);
                      const state = i < current ? "done" : i === current ? "active" : "todo";
                      return (
                        <li key={step.key} className="flex items-start gap-3">
                          <span
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                            style={{
                              borderColor: state === "todo" ? "var(--mk-line-strong)" : "transparent",
                              background: state === "done" ? "var(--mk-text)" : "transparent",
                              color: "#0A0A0B",
                            }}
                          >
                            {state === "done" && <Check className="h-3 w-3" strokeWidth={3} />}
                            {state === "active" && <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--mk-lilac)" }} />}
                          </span>
                          <span>
                            <span className="block text-[14px]" style={{ color: state === "todo" ? "var(--mk-faint)" : "var(--mk-text)" }}>
                              {step.label}
                            </span>
                            <span className="block text-[12.5px]" style={{ color: "var(--mk-faint)" }}>
                              {step.hint}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setProcessingError(null);
                    goHome();
                  }}
                  className="app-btn app-btn-ghost mt-8"
                >
                  <ArrowLeft className="h-4 w-4" /> Retour à l&apos;accueil
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

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

      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAuthModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="app-card w-full max-w-sm p-6 text-center">
              <p className="text-[17px] font-medium" style={{ color: "var(--mk-text)" }}>
                Connecte-toi pour enregistrer
              </p>
              <p className="mt-2 text-[14px]" style={{ color: "var(--mk-muted)" }}>
                Crée un compte gratuit : 10 minutes offertes, sans carte bancaire.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <button type="button" onClick={() => setShowAuthModal(false)} className="app-btn app-btn-ghost">
                  Annuler
                </button>
                <button type="button" onClick={() => router.push("/sign-in?redirect_url=/app")} className="app-btn app-btn-primary">
                  Se connecter
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Sous-composants de présentation ───────────────────────────────── */

const PROCESSING_STEPS = [
  { key: "uploading", label: "Envoi de l'enregistrement", hint: "Quelques secondes" },
  { key: "transcribing", label: "Transcription du cours", hint: "L'étape la plus longue, selon la durée du cours" },
  { key: "summarizing", label: "Rédaction de la fiche", hint: "Résumé, points clés, notions puis quiz" },
] as const;

function normalizeText(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function ecoMatches(eco: Eco, query: string) {
  const q = normalizeText(query.trim());
  if (normalizeText(eco.title).includes(q)) return true;
  if (eco.transcription_text && normalizeText(eco.transcription_text).includes(q)) return true;
  if (eco.summary_text && normalizeText(eco.summary_text).includes(q)) return true;
  return false;
}

function summarySnippet(eco: Eco): string {
  if (!eco.summary_text) return "";
  try {
    const parsed = JSON.parse(eco.summary_text) as { resume?: string };
    const text = (parsed.resume ?? "")
      .replace(/\*\*[^*]+\*\*/g, " ")
      .replace(/^(Introduction|Contenu|Conclusion):/gm, " ")
      .replace(/^\s*[-\d.]+\s+/gm, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 160 ? `${text.slice(0, 160).replace(/\s+\S*$/, "")}…` : text;
  } catch {
    return "";
  }
}

function formatEcoMeta(eco: Eco) {
  const date = new Date(eco.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const minutes = eco.duration_seconds ? Math.max(1, Math.round(eco.duration_seconds / 60)) : null;
  return minutes ? `${date} · ${minutes} min` : date;
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark key={i} className="rounded px-0.5" style={{ background: "rgba(201,184,255,0.25)", color: "#EDECE8" }}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface EcoTileProps {
  eco: Eco;
  query: string;
  onOpen: (eco: Eco) => void;
  onChanged: () => void;
}

function EcoCard({ eco, query, onOpen, onChanged }: EcoTileProps) {
  const snippet = summarySnippet(eco);
  const SourceIcon = eco.source_type === "screen" ? MonitorSpeaker : Mic;
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onOpen(eco)}
        className="app-card flex h-full w-full flex-col p-5 text-left transition-colors hover:border-white/[0.14] hover:bg-[#141416]"
      >
        <span className="line-clamp-2 pr-8 text-[15px] font-medium leading-snug" style={{ color: "var(--mk-text)" }}>
          <Highlight text={eco.title} query={query} />
        </span>
        <span className="mt-2 line-clamp-2 flex-1 text-[13.5px] leading-relaxed" style={{ color: "var(--mk-muted)" }}>
          {snippet || (eco.summary_text ? "" : "Fiche en cours de préparation…")}
        </span>
        <span className="mt-4 flex items-center gap-2 text-[12.5px]" style={{ color: "var(--mk-faint)" }}>
          <SourceIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {formatEcoMeta(eco)}
          {eco.has_pdf_context && <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />}
        </span>
      </button>
      <EcoCardMenu eco={eco} onUpdate={onChanged} onDelete={onChanged} />
    </div>
  );
}

function EcoRow({ eco, query, onOpen, onChanged }: EcoTileProps) {
  const snippet = summarySnippet(eco);
  return (
    <li className="group relative" style={{ borderColor: "var(--mk-line)" }}>
      <button type="button" onClick={() => onOpen(eco)} className="flex w-full items-start gap-6 px-2 py-4 text-left transition-colors hover:bg-white/[0.025]">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium" style={{ color: "var(--mk-text)" }}>
            <Highlight text={eco.title} query={query} />
          </span>
          {snippet && (
            <span className="mt-1 block truncate text-[13.5px]" style={{ color: "var(--mk-muted)" }}>
              {snippet}
            </span>
          )}
        </span>
        <span className="shrink-0 pr-10 pt-0.5 text-[13px] tabular-nums" style={{ color: "var(--mk-faint)" }}>
          {formatEcoMeta(eco)}
        </span>
      </button>
      <EcoCardMenu eco={eco} onUpdate={onChanged} onDelete={onChanged} />
    </li>
  );
}
