"use client";

import React, { useState, useRef, useCallback } from "react";

const FREQ_BARS = 32;
const SMOOTHING = 0.68; // plus réactif : nouvelle valeur pèse plus (ChatGPT-style)

interface UseAudioLevelResult {
  soundLevel: number;
  frequencyData: number[];
  isAvailable: boolean;
  error: string | null;
  startAudioLevel: (stream: MediaStream) => Promise<void>;
  stopAudioLevel: () => void;
  /** Ref vers l'AnalyserNode (pour ScrollingWaveformBars canvas). Rempli après startAudioLevel(). */
  analyserRef: React.RefObject<AnalyserNode | null>;
}

const ZERO_FREQUENCY_DATA = Array.from({ length: FREQ_BARS }, () => 0);

export function useAudioLevel(isPaused: boolean = false): UseAudioLevelResult {
  const [soundLevel, setSoundLevel] = useState(1);
  const [frequencyData, setFrequencyData] = useState<number[]>(ZERO_FREQUENCY_DATA);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const smoothedRef = useRef<number[]>(Array.from({ length: FREQ_BARS }, () => 0));
  const isPausedRef = useRef(isPaused);
  const isStoppedRef = useRef(false);

  isPausedRef.current = isPaused;

  const stopAudioLevel = useCallback(() => {
    console.log("[useAudioLevel] Arrêt de l'analyse audio");
    isStoppedRef.current = true;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    dataArrayRef.current = null;
    smoothedRef.current = Array.from({ length: FREQ_BARS }, () => 0);
    setIsAvailable(false);
    setSoundLevel(1);
    setFrequencyData(ZERO_FREQUENCY_DATA);
  }, []);

  const startAudioLevel = useCallback(async (stream: MediaStream) => {
    if (typeof navigator === "undefined" || !window.AudioContext) {
      setError("API non supportée");
      return;
    }

    // BUG 2 FIX: Vérifier que le stream est actif et a des pistes audio actives
    if (!stream || stream.getTracks().length === 0) {
      console.error("[useAudioLevel] Stream invalide ou vide");
      setError("Stream audio invalide");
      setIsAvailable(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.error("[useAudioLevel] Aucune piste audio dans le stream");
      setError("Aucune piste audio disponible");
      setIsAvailable(false);
      return;
    }

    // Vérifier qu'au moins une piste est active
    const activeTracks = audioTracks.filter(t => t.enabled && t.readyState === "live");
    if (activeTracks.length === 0) {
      console.error("[useAudioLevel] Aucune piste audio active", {
        tracks: audioTracks.map(t => ({
          enabled: t.enabled,
          readyState: t.readyState,
        })),
      });
      setError("Aucune piste audio active");
      setIsAvailable(false);
      return;
    }

    console.log("[useAudioLevel] Démarrage avec stream", {
      trackCount: audioTracks.length,
      activeTrackCount: activeTracks.length,
      trackEnabled: audioTracks[0]?.enabled,
      trackReadyState: audioTracks[0]?.readyState,
    });

    isStoppedRef.current = false;
    setError(null);

    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      console.log("[useAudioLevel] Source connectée à l'analyser", {
        audioContextState: audioContext.state,
        analyserFftSize: analyser.fftSize,
        frequencyBinCount: analyser.frequencyBinCount,
      });

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      dataArrayRef.current = dataArray as Uint8Array;

      setIsAvailable(true);
      smoothedRef.current = Array.from({ length: FREQ_BARS }, () => 0);

      const binCount = dataArray.length;
      const gain = 2.8;
      const curve = (v: number) =>
        Math.min(255, Math.pow(Math.min(v / 255, 1), 0.5) * 255 * gain);

      let frameCount = 0;
      const runLoop = () => {
        if (isStoppedRef.current) {
          console.log("[useAudioLevel] RAF loop arrêtée (isStopped)");
          return;
        }

        const ctx = audioContextRef.current;
        const analyserNode = analyserRef.current;
        const data = dataArrayRef.current;

        if (!ctx || !analyserNode || !data) {
          console.warn("[useAudioLevel] Références manquantes dans RAF loop", {
            hasContext: !!ctx,
            hasAnalyser: !!analyserNode,
            hasData: !!data,
          });
          animationRef.current = requestAnimationFrame(runLoop);
          return;
        }

        if (ctx.state === "suspended") {
          ctx.resume();
        }

        // BUG 2 FIX: S'assurer que getByteFrequencyData est appelé et que les données sont valides
        // @ts-expect-error - Type compatibility issue between ArrayBuffer and ArrayBufferLike
        analyserNode.getByteFrequencyData(data);

        // Vérifier que les données ne sont pas toutes à zéro (debug)
        const dataSum = data.reduce((a, b) => a + b, 0);
        if (frameCount % 60 === 0) {
          // Log toutes les secondes environ (60 frames à ~60fps)
          console.log("[useAudioLevel] Données audio", {
            frameCount,
            dataSum,
            maxValue: Math.max(...Array.from(data)),
            audioContextState: ctx.state,
            isPaused: isPausedRef.current,
          });
        }
        frameCount++;

        if (isPausedRef.current) {
          setSoundLevel(1);
          setFrequencyData(ZERO_FREQUENCY_DATA);
          smoothedRef.current = Array.from({ length: FREQ_BARS }, () => 0);
        } else {
          const sum = data.reduce((a, b) => a + b, 0);
          const rms = Math.sqrt(sum / data.length);
          const rawNorm = Math.min(rms / 100, 1);
          const boosted = Math.pow(rawNorm, 0.5) * 2.5;
          const normalized = Math.min(boosted, 1);
          const level = 0.95 + normalized * 0.2;
          setSoundLevel(Math.min(Math.max(level, 0.95), 1.18));

          const prev = smoothedRef.current;
          const next: number[] = [];
          for (let i = 0; i < FREQ_BARS; i++) {
            const idx = Math.floor((i / FREQ_BARS) * binCount);
            const raw = curve(data[idx] ?? 0);
            const smoothed = prev[i] * SMOOTHING + raw * (1 - SMOOTHING);
            next.push(smoothed);
          }
          smoothedRef.current = next;
          setFrequencyData([...next]);
        }

        animationRef.current = requestAnimationFrame(runLoop);
      };

      // BUG 2 FIX: Démarrer le loop immédiatement
      console.log("[useAudioLevel] Démarrage du RAF loop");
      runLoop();
    } catch (err) {
      console.error("[useAudioLevel] Erreur lors du démarrage:", err);
      setError(err instanceof Error ? err.message : "Permission refusée");
      setIsAvailable(false);
      setSoundLevel(1);
      setFrequencyData(ZERO_FREQUENCY_DATA);
    }
  }, []);

  return {
    soundLevel,
    frequencyData,
    isAvailable,
    error,
    startAudioLevel,
    stopAudioLevel,
    analyserRef,
  };
}
