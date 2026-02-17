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

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      dataArrayRef.current = dataArray;

      setIsAvailable(true);
      smoothedRef.current = Array.from({ length: FREQ_BARS }, () => 0);

      const binCount = dataArray.length;
      const gain = 2.8;
      const curve = (v: number) =>
        Math.min(255, Math.pow(Math.min(v / 255, 1), 0.5) * 255 * gain);

      const runLoop = () => {
        if (isStoppedRef.current) return;

        const ctx = audioContextRef.current;
        const analyserNode = analyserRef.current;
        const data = dataArrayRef.current;

        if (!ctx || !analyserNode || !data) return;

        if (ctx.state === "suspended") {
          ctx.resume();
        }

        // @ts-expect-error - typage strict Web API, compatible à l'exécution
        analyserNode.getByteFrequencyData(data);

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

      runLoop();
    } catch (err) {
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
