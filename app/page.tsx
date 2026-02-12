"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import FocusMode from "@/components/FocusMode";
import EcoView from "@/components/EcoView";
import RecordButton from "@/components/RecordButton";
import { Eco, DEFAULT_FOLDERS } from "@/types";
import { saveEco, getEcoById } from "@/lib/storage";
import { transcribeAndSummarize } from "@/lib/transcription";
import { motion } from "framer-motion";

export default function Home() {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedEco, setSelectedEco] = useState<string | null>(null);
  const [currentEco, setCurrentEco] = useState<Eco | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (selectedEco) {
      const eco = getEcoById(selectedEco);
      setCurrentEco(eco || null);
    } else {
      setCurrentEco(null);
    }
  }, [selectedEco]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        
        // Calculer la durée de l'enregistrement
        const durationSeconds = startTimeRef.current
          ? Math.round((Date.now() - startTimeRef.current) / 1000)
          : 0;
        
        startTimeRef.current = null; // Reset pour le prochain enregistrement
        
        await processRecording(audioBlob, durationSeconds);
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      startTimeRef.current = Date.now();
      mediaRecorder.start();
      setIsRecording(true);
      setIsFocusMode(true);
    } catch (error) {
      console.error("Erreur lors de l'accès au microphone:", error);
      alert("Impossible d'accéder au microphone. Veuillez vérifier les permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processRecording = async (audioBlob: Blob, durationSeconds: number) => {
    try {
      // Créer une URL pour l'audio
      const audioUrl = URL.createObjectURL(audioBlob);

      // Générer la transcription et le résumé via l'API backend
      const { transcription, summary, demoMode } = await transcribeAndSummarize(
        audioBlob,
        durationSeconds
      );

      // Mettre à jour le mode démo si activé
      if (demoMode) {
        setIsDemoMode(true);
      }

      // Créer l'Eco
      const newEco: Eco = {
        id: Date.now().toString(),
        title: `Eco du ${new Date().toLocaleDateString("fr-FR")}`,
        audio_url: audioUrl,
        transcription_text: transcription,
        summary_text: summary,
        folder: DEFAULT_FOLDERS[0].id, // Par défaut dans "Travail"
        created_at: new Date().toISOString(),
      };

      // Sauvegarder
      saveEco(newEco);

      // Mettre à jour l'interface
      setIsFocusMode(false);
      setIsProcessing(false);
      setSelectedEco(newEco.id);
      setSelectedFolder(newEco.folder);
      setRefreshKey((prev) => prev + 1); // Force le rafraîchissement de la sidebar
      
      // Déclencher un événement pour mettre à jour la sidebar
      window.dispatchEvent(new Event("eco-updated"));
    } catch (error) {
      console.error("Erreur lors du traitement:", error);
      setIsProcessing(false);
      setIsFocusMode(false);
      alert("Une erreur est survenue lors du traitement de l'enregistrement.");
    }
  };

  const handleStartRecording = () => {
    if (!isRecording) {
      startRecording();
    }
  };

  const handleBackToHome = () => {
    setSelectedEco(null);
    setSelectedFolder(null);
  };

  return (
    <div className="h-screen flex flex-col">
      {!isFocusMode && (
        <Header 
          onGoHome={handleBackToHome} 
          onStartRecording={handleStartRecording}
          isDemoMode={isDemoMode}
        />
      )}
      
      <div className="flex-1 flex overflow-hidden pt-6">
        <Sidebar
          key={refreshKey}
          selectedFolder={selectedFolder}
          onSelectFolder={setSelectedFolder}
          selectedEco={selectedEco}
          onSelectEco={setSelectedEco}
        />

        <div className="flex-1 flex flex-col overflow-hidden pr-6 md:pr-6 pr-4">
          {!selectedEco && !isFocusMode && (
            <div className="flex-1 flex items-center justify-center p-4 md:p-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                className="floating-card rounded-card border border-white/40 p-16 max-w-lg w-full"
              >
                <div className="text-center space-y-8">
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
                    className="space-y-3"
                  >
                    <h2 className="text-3xl font-semibold text-gray-900 tracking-tight">Nouvel Eco</h2>
                    <p className="text-gray-600 text-base leading-relaxed">
                      Cliquez pour enregistrer, puis stop pour générer résumé
                    </p>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
                    className="flex justify-center pt-4"
                  >
                    <RecordButton
                      isRecording={false}
                      onStart={handleStartRecording}
                      onStop={stopRecording}
                    />
                  </motion.div>
                </div>
              </motion.div>
            </div>
          )}

          {selectedEco && !isFocusMode && <EcoView eco={currentEco} />}

          {isProcessing && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 border-4 border-gray-200 border-t-gray-700 rounded-full mx-auto"
                />
                <p className="mt-4 text-gray-600">Traitement en cours...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <FocusMode
        isActive={isFocusMode}
        isRecording={isRecording}
        onStartRecording={handleStartRecording}
        onStopRecording={stopRecording}
      />
    </div>
  );
}
