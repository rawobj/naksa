"use client";

import { useEffect, useRef } from "react";
import { useStore } from "jotai";
import type { Vec } from "@/core/geometry";
import { drawPlan, type DrawOptions } from "./render/draw";
import {
  cursorAtom,
  fitRequestAtom,
  planAtom,
  toolAtom,
  viewportAtom,
} from "./editor-atoms";
import { toWorld, zoomAt } from "./viewport";

// The drawing surface. Draws the plan, and handles panning and zooming.
export default function PlanCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useStore();

  // Everything lives in one effect with plain variables instead of React state,
  // because the canvas redraws on every mouse move and React re-renders would be too slow
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const fontFamily = getComputedStyle(canvas).fontFamily;
    let width = 0;
    let height = 0;
    let frame = 0;
    let fitted = false;
    let pan: { start: Vec; x: number; y: number } | null = null;
    let spaceHeld = false;

    const options = (): DrawOptions => {
      return {
        viewport: store.get(viewportAtom),
        width,
        height,
        dpr: window.devicePixelRatio || 1,
        grid: true,
        fontFamily,
      };
    };

    const draw = () => {
      frame = 0;
      if (width === 0 || height === 0) return;
      drawPlan(ctx, options());
      canvas.style.cursor = pan
        ? "grabbing"
        : spaceHeld || store.get(toolAtom) === "pan"
          ? "grab"
          : "default";
    };
    // At most one redraw per frame, however many changes come in
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    // Starting view: a typical house plot in the middle of the canvas
    const fit = () => {
      store.set(viewportAtom, {
        x: width / 2 - 5500 * 0.06,
        y: height / 2 - 4500 * 0.06,
        zoom: 0.06,
      });
    };

    // Canvas pixels have to match the screen pixels (devicePixelRatio) or it looks blurry
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      if (!fitted && width > 0) {
        fitted = true;
        fit();
      }
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Redraw when anything that is drawn changes, and refit when asked to
    const unsubscribe = [
      ...[planAtom, toolAtom, viewportAtom].map((watched) =>
        store.sub(watched, schedule)
      ),
      store.sub(fitRequestAtom, fit),
    ];

    const pointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      return { screen, world: toWorld(store.get(viewportAtom), screen) };
    };

    // Mouse events
    const onDown = (e: PointerEvent) => {
      canvas.focus({ preventScroll: true });
      const p = pointer(e);
      // Middle or right button, holding space, or the pan tool all drag the view
      if (
        e.button === 1 ||
        e.button === 2 ||
        spaceHeld ||
        store.get(toolAtom) === "pan"
      ) {
        const view = store.get(viewportAtom);
        pan = { start: p.screen, x: view.x, y: view.y };
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        schedule();
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = pointer(e);
      if (pan) {
        const view = store.get(viewportAtom);
        store.set(viewportAtom, {
          ...view,
          x: pan.x + p.screen.x - pan.start.x,
          y: pan.y + p.screen.y - pan.start.y,
        });
        return;
      }
      // A new object every move, so the canvas redraws even if the rounded position is the same
      store.set(cursorAtom, {
        x: Math.round(p.world.x),
        y: Math.round(p.world.y),
      });
    };
    const onUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
      if (pan) {
        pan = null;
        schedule();
      }
    };
    const onLeave = () => {
      store.set(cursorAtom, null);
    };
    // Scroll to zoom around the cursor
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // some mice scroll in lines, not pixels
      store.set(
        viewportAtom,
        zoomAt(store.get(viewportAtom), anchor, Math.exp(-delta * 0.0015))
      );
    };
    const onContext = (e: MouseEvent) => e.preventDefault();

    // Hold space to pan
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping(e.target)) {
        spaceHeld = true;
        schedule();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeld = false;
        schedule();
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // Text drawn before the font loads uses the fallback font, so redraw once it's ready
    document.fonts?.ready.then(schedule);

    return () => {
      observer.disconnect();
      unsubscribe.forEach((stop) => stop());
      if (frame) cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [store]);

  return (
    <canvas
      ref={canvasRef}
      className="block size-full touch-none bg-paper focus-visible:outline-offset-[-2px]"
      tabIndex={0}
      aria-label="Floor plan drawing"
    />
  );
}

export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}
