"use client";

import React, { useRef, useLayoutEffect } from "react";

const BAR_COUNT = 180;
const BAR_WIDTH = 2;
const GAP = 1;
const BAR_STEP = BAR_WIDTH + GAP;
const SCROLL_SPEED = 1.8;
const MIN_HEIGHT_RATIO = 0.06;
const MAX_HEIGHT_RATIO = 0.95;
const IDLE_AMP = 0.06;
const IDLE_WAVE = 0.04;
const GAIN = 2.2;

interface ScrollingWaveformBarsProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
  isPaused: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export default function ScrollingWaveformBars({
  analyserRef,
  isPaused,
  width = 320,
  height = 56,
  className = "",
}: ScrollingWaveformBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1);
    const w = width;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const buffer = new Float32Array(BAR_COUNT);
    let scrollOffset = 0;
    let timeDomainData: Uint8Array | null = null;
    let rafId = 0;

    function getAmplitude(): number {
      const analyser = analyserRef.current;
      if (!analyser || isPausedRef.current) {
        return IDLE_AMP + IDLE_WAVE * Math.sin(Date.now() / 250);
      }
      if (!timeDomainData || timeDomainData.length !== analyser.fftSize) {
        timeDomainData = new Uint8Array(analyser.fftSize);
      }
      // @ts-expect-error - typage strict Web API, compatible à l'exécution
      analyser.getByteTimeDomainData(timeDomainData);
      let sum = 0;
      const len = timeDomainData.length;
      for (let i = 0; i < len; i++) {
        const v = (timeDomainData[i]! - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / len);
      const normalized = Math.min(1, rms * GAIN);
      return normalized;
    }

    function draw() {
      if (!ctx) return;
      const analyser = analyserRef.current;
      const active = analyser && !isPausedRef.current;
      if (!active) scrollOffset = BAR_STEP;
      while (scrollOffset >= BAR_STEP) {
        scrollOffset -= BAR_STEP;
        for (let i = 0; i < BAR_COUNT - 1; i++) {
          buffer[i] = buffer[i + 1]!;
        }
        buffer[BAR_COUNT - 1] = getAmplitude();
      }
      scrollOffset += SCROLL_SPEED;

      ctx.clearRect(0, 0, w, h);

      const gradient = ctx.createLinearGradient(0, h, 0, 0);
      gradient.addColorStop(0, "rgba(34, 211, 238, 0.92)");
      gradient.addColorStop(0.5, "rgba(139, 92, 246, 0.92)");
      gradient.addColorStop(1, "rgba(34, 211, 238, 0.92)");

      const centerY = h / 2;
      for (let i = 0; i < BAR_COUNT; i++) {
        const x = i * BAR_STEP - scrollOffset;
        if (x + BAR_WIDTH < 0 || x > w) continue;
        const raw = buffer[i] ?? 0;
        const halfH = (MIN_HEIGHT_RATIO + raw * (MAX_HEIGHT_RATIO - MIN_HEIGHT_RATIO)) * (h / 2);
        const y1 = centerY - halfH;
        const y2 = centerY + halfH;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y1, BAR_WIDTH, y2 - y1, BAR_WIDTH / 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [analyserRef, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", background: "transparent" }}
      width={width}
      height={height}
      aria-hidden
    />
  );
}
