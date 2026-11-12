"use client";

import { useEffect, useRef } from "react";
import type { Plan } from "@/core/model";
import { drawPlan } from "./render/draw";
import { sceneFor } from "./render/scene";
import { fitBounds } from "./viewport";

// A small, static rendering of a plan
export default function PlanThumb({
  plan,
  width,
  height,
}: {
  plan: Plan;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const scene = sceneFor(plan);
    if (!scene.bounds) return;
    const paint = () =>
      drawPlan(ctx, scene, {
        viewport: fitBounds(scene.bounds!, width, height, 10),
        width,
        height,
        dpr,
        mode: "plan",
        grid: false,
        fontFamily: getComputedStyle(canvas).fontFamily,
        weight: 0.72,
      });
    paint();
    document.fonts?.ready.then(paint);
  }, [plan, width, height]);

  return (
    <canvas
      ref={ref}
      style={{ width, height, display: "block", borderRadius: 6 }}
      aria-hidden="true"
    />
  );
}
