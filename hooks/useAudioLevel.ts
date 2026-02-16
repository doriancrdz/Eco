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
  const audioContextRef = useRef<AudioContext | null>(null);
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
      audioContextRef.current = null;
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
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: true,
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        streamRef.current = stream;

        audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.2;
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
      audioContextRef.current = null;
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
      const ctx = audioContextRef.current;
      if (ctx?.state === "suspended") {
        ctx.resume();
      }
      if (!analyserRef.current) return;
      // getByteFrequencyData attend Uint8Array<ArrayBuffer>, ref fournit ArrayBufferLike
      // @ts-expect-error - typage strict Web API, compatible à l'exécution
      analyser.getByteFrequencyData(dataArray);

      const sum = dataArray.reduce((a, b) => a + b, 0);
      const rms = Math.sqrt(sum / dataArray.length);
      const rawNorm = Math.min(rms / 128, 1);
      const boosted = Math.pow(rawNorm, 0.65) * 2.2;
      const normalized = Math.min(boosted, 1);
      const level = 0.95 + normalized * 0.2;
      setSoundLevel(Math.min(Math.max(level, 0.95), 1.18));

      const samples: number[] = [];
      const gain = 1.8;
      const curve = (v: number) => Math.min(255, Math.pow(Math.min(v / 255, 1), 0.7) * 255 * gain);
      for (let i = 0; i < FREQ_BARS; i++) {
        const idx = Math.floor((i / FREQ_BARS) * binCount);
        samples.push(curve(dataArray[idx] ?? 0));
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
