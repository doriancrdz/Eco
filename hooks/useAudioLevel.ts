"use client";

import { useState, useEffect, useRef } from "react";

interface UseAudioLevelResult {
  soundLevel: number;
  isAvailable: boolean;
  error: string | null;
}

export function useAudioLevel(enabled: boolean): UseAudioLevelResult {
  const [soundLevel, setSoundLevel] = useState(1);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSoundLevel(1);
      setIsAvailable(false);
      setError(null);
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("API non supportée");
      return;
    }

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    const startCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        setIsAvailable(true);
        setError(null);

        const updateLevel = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const normalized = Math.min(Math.max(average / 128, 0), 1);
          const level = 0.95 + normalized * 0.13;
          setSoundLevel(Math.min(Math.max(level, 0.95), 1.08));
          animationRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Permission refusée");
        setIsAvailable(false);
        setSoundLevel(1);
      }
    };

    startCapture();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      source?.disconnect();
      audioContext?.close();
    };
  }, [enabled]);

  return { soundLevel, isAvailable, error };
}
