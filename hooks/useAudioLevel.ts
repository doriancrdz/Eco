"use client";

import { useState, useEffect, useRef } from "react";

const FREQ_BARS = 20;

interface UseAudioLevelResult {
  soundLevel: number;
  frequencyData: number[];
  isAvailable: boolean;
  error: string | null;
}

const ZERO_FREQUENCY_DATA = Array.from({ length: FREQ_BARS }, () => 0);

export function useAudioLevel(enabled: boolean, isPaused: boolean = false): UseAudioLevelResult {
  const [soundLevel, setSoundLevel] = useState(1);
  const [frequencyData, setFrequencyData] = useState<number[]>(ZERO_FREQUENCY_DATA);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const isPausedRef = useRef(isPaused);

  isPausedRef.current = isPaused;

  useEffect(() => {
    if (!enabled) {
      setSoundLevel(1);
      setFrequencyData(ZERO_FREQUENCY_DATA);
      setIsAvailable(false);
      setError(null);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      analyserRef.current = null;
      dataArrayRef.current = null;
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("API non supportée");
      return;
    }

    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    const startCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        dataArrayRef.current = dataArray;
        setIsAvailable(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Permission refusée");
        setIsAvailable(false);
        setSoundLevel(1);
        setFrequencyData(ZERO_FREQUENCY_DATA);
      }
    };

    startCapture();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      source?.disconnect();
      audioContext?.close();
      analyserRef.current = null;
      dataArrayRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    if (isPaused) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      setSoundLevel(1);
      setFrequencyData(ZERO_FREQUENCY_DATA);
      return;
    }

    if (!analyserRef.current || !dataArrayRef.current) {
      return;
    }

    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    const binCount = dataArray.length;

    const updateLevel = () => {
      if (isPausedRef.current) return;
      if (!analyserRef.current) return;
      // getByteFrequencyData attend Uint8Array<ArrayBuffer>, ref fournit ArrayBufferLike
      // @ts-expect-error - typage strict Web API, compatible à l'exécution
      analyser.getByteFrequencyData(dataArray);

      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const normalized = Math.min(Math.max(average / 128, 0), 1);
      const level = 0.95 + normalized * 0.13;
      setSoundLevel(Math.min(Math.max(level, 0.95), 1.08));

      const samples: number[] = [];
      for (let i = 0; i < FREQ_BARS; i++) {
        const idx = Math.floor((i / FREQ_BARS) * binCount);
        samples.push(dataArray[idx] ?? 0);
      }
      setFrequencyData(samples);

      animationRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [enabled, isPaused]);

  return { soundLevel, frequencyData, isAvailable, error };
}
