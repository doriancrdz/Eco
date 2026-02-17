"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FocusMode from "@/components/FocusMode";
import ProfileView from "@/components/ProfileView";
import Logo from "@/components/Logo";
import { Sparkles, ArrowRight, Settings, ArrowLeft, Mic } from "lucide-react";
import { useUser, useClerk } from "@clerk/nextjs";
import EcoView from "@/components/EcoView";
import RecordButton from "@/components/RecordButton";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { Eco, DEFAULT_FOLDERS } from "@/types";
import { saveEco, getEcoById, getEcos } from "@/lib/storage";
import { transcribeAndSummarize } from "@/lib/transcription";
import { motion, AnimatePresence } from "framer-motion";

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

  const { soundLevel, frequencyData, isAvailable, startAudioLevel, stopAudioLevel, analyserRef } = useAudioLevel(isPaused);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const elapsedAtStopRef = useRef(0);
  const mimeTypeRef = useRef<string>("audio/webm");
  const dataRequestIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (selectedEco) {
      const eco = getEcoById(selectedEco);
      setCurrentEco(eco || null);
    } else {
      setCurrentEco(null);
    }
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      console.log("[startRecording] Stream obtenu:", stream.id);
      const audioTracks = stream.getAudioTracks();
      console.log("[startRecording] Pistes audio:", audioTracks.length, audioTracks.map(t => ({
        id: t.id,
        enabled: t.enabled,
        readyState: t.readyState,
        label: t.label,
      })));
      
      if (audioTracks.length === 0) {
        throw new Error("Aucune piste audio disponible");
      }

      // Vérifier que les pistes sont actives
      const activeTracks = audioTracks.filter(t => t.enabled && t.readyState === "live");
      if (activeTracks.length === 0) {
        throw new Error("Aucune piste audio active");
      }

      streamRef.current = stream;

      // Déterminer le meilleur format audio supporté par Whisper
      // PRIORITÉ: audio/mp4 (génère des chunks non vides sur Safari et autres navigateurs)
      let mimeType: string;
      if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/wav")) {
        mimeType = "audio/wav";
      } else {
        mimeType = "audio/mp4"; // Fallback par défaut
      }
      
      mimeTypeRef.current = mimeType;
      console.log("[startRecording] Format audio sélectionné:", mimeType);
      console.log("[startRecording] Format supporté?", MediaRecorder.isTypeSupported(mimeType));
      console.log("[startRecording] Formats testés:", {
        "audio/mp4": MediaRecorder.isTypeSupported("audio/mp4"),
        "audio/webm;codecs=opus": MediaRecorder.isTypeSupported("audio/webm;codecs=opus"),
        "audio/webm": MediaRecorder.isTypeSupported("audio/webm"),
        "audio/wav": MediaRecorder.isTypeSupported("audio/wav"),
      });

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      console.log("[startRecording] MediaRecorder créé", {
        mimeType,
        state: mediaRecorder.state,
      });

      // Réinitialiser les chunks
      audioChunksRef.current = [];
      console.log("[startRecording] audioChunks réinitialisé");

      // Définir ondataavailable AVANT start()
      mediaRecorder.ondataavailable = (event) => {
        console.log("[ondataavailable] Événement reçu", {
          dataSize: event.data?.size || 0,
          dataType: event.data?.type || "unknown",
          timestamp: Date.now(),
        });
        
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log("[MediaRecorder] Chunk reçu:", event.data.size, "bytes, total chunks:", audioChunksRef.current.length);
        } else {
          console.warn("[ondataavailable] Chunk vide ou invalide", {
            hasData: !!event.data,
            dataSize: event.data?.size || 0,
          });
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("[MediaRecorder] onstop appelé, chunks:", audioChunksRef.current.length);
        stopAudioLevel();
        
        if (audioChunksRef.current.length === 0) {
          console.error("[MediaRecorder] AUCUN CHUNK RECU! Vérifier la configuration.");
        }
        
        // Utiliser le même mimeType que celui utilisé pour l'enregistrement
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
        console.log("[onstop] Blob audio créé", {
          size: audioBlob.size,
          type: audioBlob.type,
          mimeType: mimeTypeRef.current,
          chunkCount: audioChunksRef.current.length,
        });
        const durationSeconds = elapsedAtStopRef.current;
        startTimeRef.current = null;
        totalPausedMsRef.current = 0;
        pausedAtRef.current = null;
        await processRecording(audioBlob, durationSeconds, mimeTypeRef.current);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      // Stocker dans la ref AVANT start()
      mediaRecorderRef.current = mediaRecorder;
      console.log("[startRecording] MediaRecorder stocké dans ref");

      // Démarrer le MediaRecorder
      // Pour audio/mp4, utiliser start() sans argument pour éviter les chunks vides
      // Les chunks seront collectés à la fin lors de stop()
      console.log("[MediaRecorder] Appel de start()...");
      try {
        if (mimeType === "audio/mp4") {
          // Pour mp4, ne pas utiliser timeslice pour éviter les chunks vides
          mediaRecorder.start();
          console.log("[MediaRecorder] start() appelé (sans timeslice pour mp4), state:", mediaRecorder.state);
        } else {
          // Pour webm, essayer avec timeslice
          mediaRecorder.start(1000);
          console.log("[MediaRecorder] start(1000) appelé, state:", mediaRecorder.state);
          
          // Alternative: Si start(1000) ne génère pas de chunks, utiliser requestData() manuellement
          dataRequestIntervalRef.current = window.setInterval(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
              console.log("[MediaRecorder] Appel manuel de requestData()");
              try {
                mediaRecorderRef.current.requestData();
              } catch (reqError) {
                console.warn("[MediaRecorder] Erreur lors de requestData():", reqError);
              }
            } else {
              if (dataRequestIntervalRef.current) {
                clearInterval(dataRequestIntervalRef.current);
                dataRequestIntervalRef.current = null;
              }
            }
          }, 1000);
        }
        
        // Vérifier l'état après un court délai
        setTimeout(() => {
          console.log("[MediaRecorder] État après 100ms:", mediaRecorder.state);
          if (mediaRecorder.state !== "recording") {
            console.error("[MediaRecorder] ERREUR: Le MediaRecorder n'est pas en état 'recording'");
          }
        }, 100);
      } catch (startError) {
        console.error("[MediaRecorder] Erreur lors de start():", startError);
        throw startError;
      }

      // Démarrer l'analyse audio
      await startAudioLevel(stream);
      console.log("[startRecording] Analyse audio démarrée");

      // Initialiser le timer
      startTimeRef.current = Date.now();
      totalPausedMsRef.current = 0;
      pausedAtRef.current = null;

      // SEULEMENT MAINTENANT on peut afficher FocusMode
      setIsFocusMode(true);
      setIsRecording(true);
      console.log("[startRecording] FocusMode activé");
    } catch (error) {
      console.error("[startRecording] Erreur:", error);
      // Réinitialiser l'état en cas d'erreur
      setIsFocusMode(false);
      setIsRecording(false);
      alert("Impossible d'accéder au microphone. Veuillez autoriser l'accès.");
    }
  };

  const stopRecording = () => {
    setShowStopConfirm(true);
  };

  const confirmStop = () => {
    console.log("[confirmStop] Début", {
      hasMediaRecorder: !!mediaRecorderRef.current,
      isRecording,
      mediaRecorderState: mediaRecorderRef.current?.state,
    });

    // Arrêter l'intervalle de requestData() si actif
    if (dataRequestIntervalRef.current) {
      clearInterval(dataRequestIntervalRef.current);
      dataRequestIntervalRef.current = null;
      console.log("[confirmStop] Intervalle requestData() arrêté");
    }

    if (mediaRecorderRef.current && isRecording) {
      if (mediaRecorderRef.current.state === "recording") {
        console.log("[confirmStop] Arrêt du MediaRecorder...");
        elapsedAtStopRef.current = recordingElapsedSeconds;
        
        // Demander une dernière fois les données avant stop()
        try {
          mediaRecorderRef.current.requestData();
          console.log("[confirmStop] Dernier requestData() appelé");
        } catch (reqError) {
          console.warn("[confirmStop] Erreur lors du dernier requestData():", reqError);
        }
        
        mediaRecorderRef.current.stop();
        console.log("[confirmStop] stop() appelé, state:", mediaRecorderRef.current.state);
      } else {
        console.error("[confirmStop] MediaRecorder non en état 'recording'", {
          state: mediaRecorderRef.current.state,
        });
      }
      setIsRecording(false);
      setIsProcessing(true);
      setIsFocusMode(false);
      setShowStopConfirm(false);
    } else {
      console.error("[confirmStop] MediaRecorder non disponible ou pas en enregistrement", {
        hasMediaRecorder: !!mediaRecorderRef.current,
        isRecording,
      });
    }
  };

  const processRecording = async (audioBlob: Blob, durationSeconds: number, mimeType: string = "audio/webm") => {
    try {
      console.log("[processRecording] Début du traitement", {
        blobSize: audioBlob.size,
        durationSeconds,
        blobType: audioBlob.type,
      });

      // Créer une URL pour l'audio
      const audioUrl = URL.createObjectURL(audioBlob);

      // Générer la transcription et le résumé via l'API backend
      console.log("[processRecording] Appel à transcribeAndSummarize...");
      const { transcription, summary, demoMode } = await transcribeAndSummarize(
        audioBlob,
        durationSeconds,
        mimeType
      );
      console.log("[processRecording] Transcription réussie", {
        transcriptionLength: transcription.length,
        summaryTitle: summary.titre,
        demoMode,
      });

      // Mettre à jour le mode démo si activé
      if (demoMode) {
        setIsDemoMode(true);
      }

      // Créer l'Eco
      // Utiliser le titre du résumé si disponible, sinon titre par défaut
      const ecoTitle = summary.titre || `Eco du ${new Date().toLocaleDateString("fr-FR")}`;
      const newEco: Eco = {
        id: Date.now().toString(),
        title: ecoTitle,
        audio_url: audioUrl,
        transcription_text: transcription,
        summary_text: JSON.stringify(summary), // Sérialiser l'objet Summary en JSON string
        folder: DEFAULT_FOLDERS[0].id, // Par défaut dans "Travail"
        created_at: new Date().toISOString(),
      };

      // Sauvegarder
      saveEco(newEco);
      console.log("[processRecording] Eco créé et sauvegardé", { ecoId: newEco.id });

      // Mettre à jour l'interface
      setIsFocusMode(false);
      setIsProcessing(false);
      setSelectedEco(newEco.id);
      setSelectedFolder(newEco.folder);
      setRefreshKey((prev) => prev + 1); // Force le rafraîchissement de la sidebar
      
      // Déclencher un événement pour mettre à jour la sidebar
      window.dispatchEvent(new Event("eco-updated"));
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
                  {getEcos().length > 0 && (
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
                  {getEcos()
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
                {getEcos().length === 0 && (
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
                {getEcos().map((eco, index) => (
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
              <EcoView eco={currentEco} />
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
