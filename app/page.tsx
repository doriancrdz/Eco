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
import { transcribeAudio, generateSummary, pollRecordingStatus } from "@/lib/transcription";
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
  const { user } = useUser();
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
  const [ecos, setEcos] = useState<Eco[]>([]);

  const { soundLevel, frequencyData, isAvailable, startAudioLevel, stopAudioLevel, analyserRef } = useAudioLevel(isPaused);

  // Charger les ECOs depuis l'API (source unique)
  const loadEcos = useCallback(async () => {
    try {
      const res = await fetch("/api/ecos");
      if (res.ok) {
        const data = await res.json();
        setEcos(data.ecos || []);
      } else {
        setEcos([]);
      }
    } catch {
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

  useEffect(() => {
    const handleEcoUpdated = () => loadEcos();
    window.addEventListener("eco-updated", handleEcoUpdated);
    return () => window.removeEventListener("eco-updated", handleEcoUpdated);
  }, [loadEcos]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const elapsedAtStopRef = useRef(0);
  const mimeTypeRef = useRef<string>("audio/webm");

  // Charger l'ECO sélectionné depuis l'API
  useEffect(() => {
    if (!selectedEco) {
      setCurrentEco(null);
      return;
    }
    const loadCurrentEco = async () => {
      try {
        const res = await fetch(`/api/eco/${selectedEco}`);
        if (res.ok) {
          const data = await res.json();
          setCurrentEco(data.eco || null);
        } else {
          setSelectedEco(null);
          setSelectedFolder(null);
          setCurrentEco(null);
        }
      } catch {
        setSelectedEco(null);
        setSelectedFolder(null);
        setCurrentEco(null);
      }
    };
    loadCurrentEco();
  }, [selectedEco]);

  // Rafraîchir currentEco quand eco-updated est déclenché (eco modifié ou supprimé)
  useEffect(() => {
    const handleRefreshCurrent = async () => {
      if (!selectedEco) return;
      try {
        const res = await fetch(`/api/eco/${selectedEco}`);
        if (res.ok) {
          const data = await res.json();
          setCurrentEco(data.eco || null);
        } else {
          setSelectedEco(null);
          setSelectedFolder(null);
          setCurrentEco(null);
        }
      } catch {
        // Ignorer
      }
    };
    window.addEventListener("eco-updated", handleRefreshCurrent);
    return () => window.removeEventListener("eco-updated", handleRefreshCurrent);
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

      // Détection format (webm;codecs=opus en premier pour Chrome)
      let mimeType = "";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      } else {
        mimeType = "";
      }

      mimeTypeRef.current = mimeType || "audio/webm";
      console.log("[startRecording] Format:", mimeType || "default");
      console.log("[startRecording] Format supporté?", mimeType ? MediaRecorder.isTypeSupported(mimeType) : "n/a");

      // Créer MediaRecorder
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      console.log("[startRecording] MediaRecorder créé, state:", mediaRecorder.state);

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

        const mimeTypeUsed =
          audioChunksRef.current[0].type || mimeTypeRef.current || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeUsed });
        console.log("[onstop] Blob créé:", audioBlob.size, "bytes, type:", audioBlob.type);

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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      elapsedAtStopRef.current = recordingElapsedSeconds;
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
    setIsRecording(false);
    setIsProcessing(true);
    setIsFocusMode(false);
    setShowStopConfirm(false);
  };

  const processRecording = async (audioBlob: Blob, durationSeconds: number, mimeType: string = "audio/webm") => {
    const t0 = Date.now();
    try {
      console.log("[processRecording] T1 upload start", { ts: t0 });
      const audioUrl = URL.createObjectURL(audioBlob);

      const phaseAResult = await transcribeAudio(audioBlob, durationSeconds, mimeType);
      const t4 = Date.now();
      console.log("[processRecording] T4 transcribe response", {
        status: phaseAResult.status,
        recordingId: phaseAResult.recordingId,
        elapsed: t4 - t0,
        ts: t4,
      });

      const ecoTitle = `Eco du ${new Date().toLocaleDateString("fr-FR")}`;
      
      // Récupérer le premier dossier par défaut depuis la DB (ou null)
      let defaultFolderId: string | null = null;
      try {
        const foldersRes = await fetch("/api/folders");
        if (foldersRes.ok) {
          const foldersData = await foldersRes.json();
          const defaultFolder = foldersData.folders?.find((f: { isDefault: boolean }) => f.isDefault);
          if (defaultFolder) {
            defaultFolderId = defaultFolder.id;
          }
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des dossiers:", error);
      }
      
      const newEco: Eco = {
        id: phaseAResult.recordingId,
        title: ecoTitle,
        audio_url: audioUrl,
        transcription_text: phaseAResult.transcription,
        summary_text: null,
        folder: defaultFolderId || "",
        created_at: new Date().toISOString(),
      };

      // Créer l'ECO en DB
      try {
        await fetch("/api/ecos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newEco),
        });
      } catch (error) {
        console.error("Erreur lors de la création de l'ECO en DB:", error);
        // Ne pas bloquer le flux si la création DB échoue
      }

      // T5: navigation immédiate vers page résultat (plus de blocage sur "Traitement en cours…")
      setIsFocusMode(false);
      setIsProcessing(false);
      setSelectedEco(newEco.id);
      setSelectedFolder(newEco.folder);
      setRefreshKey((prev) => prev + 1);
      window.dispatchEvent(new Event("eco-updated"));
      console.log("[processRecording] T5 navigation → EcoView", { elapsed: Date.now() - t0, ts: Date.now() });

      // PHASE B: generate-summary en fire-and-forget (EcoView poll pour récupérer)
      if (phaseAResult.status === "TRANSCRIBED") {
        generateSummary(phaseAResult.recordingId)
          .then(async (summary) => {
            if (!summary) return;
            const updatedEco = {
              ...newEco,
              title: summary.titre || ecoTitle,
              summary_text: JSON.stringify(summary),
            };
            
            // Mettre à jour en DB
            try {
              await fetch(`/api/eco/${newEco.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: updatedEco.title,
                  summary_text: updatedEco.summary_text,
                }),
              });
            } catch (error) {
              console.error("Erreur lors de la mise à jour de l'ECO en DB:", error);
            }
            
            if (selectedEco === newEco.id) {
              const res = await fetch(`/api/eco/${newEco.id}`);
              if (res.ok) {
                const data = await res.json();
                setCurrentEco(data.eco || null);
              }
              setRefreshKey((prev) => prev + 1);
            }
            window.dispatchEvent(new Event("eco-updated"));
          })
          .catch((error) => console.error("[processRecording] Erreur PHASE B:", error));
      }
    } catch (error) {
      console.error("[processRecording] Erreur lors du traitement:", error);
      console.error("[processRecording] Détails de l'erreur:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : typeof error,
      });
      setIsProcessing(false);
      setIsFocusMode(false);
      const errorMessage =
        error instanceof Error
          ? `Erreur lors du traitement: ${error.message}`
          : "Une erreur est survenue lors du traitement de l'enregistrement.";
      alert(errorMessage);
    }
  };

  const handleStartRecording = () => {
    if (paymentBlocked) return;
    if (!isRecording) {
      startRecording();
    }
  };

  const handleBackToHome = () => {
    setSelectedEco(null);
    setSelectedFolder(null);
    setViewAllEcos(false);
  };

  const handleEcoClick = (eco: Eco) => {
    setSelectedEco(eco.id);
    setSelectedFolder(eco.folder);
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
        onNavigateHome={handleBackToHome}
        onNavigatePricing={() => router.push("/pricing")}
        onNavigateSettings={() => router.push("/settings/preferences")}
        onSignOut={() => signOut()}
        onOpenProfile={() => setShowProfile(true)}
        userName={user?.firstName || user?.username || undefined}
        userImageUrl={user?.imageUrl}
      />

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 lg:min-w-0">
        {!isFocusMode && (
          <Header
            onGoHome={handleBackToHome}
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
            onAvatarClick={() => setShowProfile(true)}
            userImageUrl={user?.imageUrl}
            userName={user?.firstName || user?.username || undefined}
          />
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-6">
          <div className={`${sidebarOpen ? "" : "max-w-3xl mx-auto"} px-4 md:px-6 lg:px-8`}>
            <AnimatePresence mode="wait">
            {!selectedEco && !isFocusMode && !viewAllEcos && !isProcessing && (
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
                onClick={() => setViewAllEcos(false)}
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
                onRefresh={() => {
                  if (selectedEco) {
                    fetch(`/api/eco/${selectedEco}`)
                      .then((res) => res.ok && res.json())
                      .then((data) => data?.eco && setCurrentEco(data.eco));
                    setRefreshKey((prev) => prev + 1);
                    window.dispatchEvent(new Event("eco-updated"));
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
                <p className="text-gray-600 font-medium">Traitement en cours...</p>
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
    </div>
  );
}
