"use client";

import React, { useState, useRef, useCallback } from "react";

const FREQ_BARS = 32;
const SMOOTHING = 0.68; // plus réactif : nouvelle valeur pèse plus (ChatGPT-style)

interface UseAudioLevelResult {
  soundLevel: number;
  frequencyData: number[];
  isAvailable: boolean;
  error: string | null;
  /** Passer un AudioContext pré-créé dans le handler du geste utilisateur pour éviter la suspension Chrome */
  startAudioLevel: (stream: MediaStream, existingContext?: AudioContext) => Promise<void>;
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

  const startAudioLevel = useCallback(async (stream: MediaStream, existingContext?: AudioContext) => {
    if (typeof navigator === "undefined" || !window.AudioContext) {
      setError("API non supportée");
      return;
    }

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
      reusingContext: !!existingContext,
    });

    isStoppedRef.current = false;
    setError(null);

    try {
      // Utiliser le contexte pré-créé (dans le geste utilisateur) ou en créer un nouveau
      const audioContext = existingContext ?? new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Resume si suspendu — cast nécessaire car les types TS excluent "running" du domaine après narrowing
      if ((audioContext.state as string) !== "running") {
        await audioContext.resume();
        let attempts = 0;
        while ((audioContext.state as string) !== "running" && attempts < 10) {
          await new Promise((r) => setTimeout(r, 100));
          attempts++;
        }
      }
      console.log("[useAudioLevel] AudioContext state after resume:", audioContext.state);
      if ((audioContext.state as string) !== "running") {
        console.error("[useAudioLevel] AudioContext non running après tentatives — visualiseur peut être inactif");
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      // NE PAS connecter analyser à destination — on lit seulement, pas de playback
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

        if ((ctx.state as string) === "suspended") {
          ctx.resume().catch(() => {}); // fire-and-forget resume
          animationRef.current = requestAnimationFrame(runLoop);
          return;
        }

        // @ts-expect-error - Type compatibility issue between ArrayBuffer and ArrayBufferLike
        analyserNode.getByteFrequencyData(data);

        const dataSum = data.reduce((a, b) => a + b, 0);
        if (frameCount % 60 === 0) {
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
