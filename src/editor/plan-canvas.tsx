"use client";

import { useEffect, useRef } from "react";
import { useStore } from "jotai";
import { addTo } from "@/core/edit";
import type { Vec } from "@/core/geometry";
import {
  dimensionLine,
  hitTest,
  itemCorners,
  openingBox,
  wallBox,
} from "./hit";
import { outline } from "./overlay";
import { drawPlan, ENGINEER_MARGIN, type DrawOptions } from "./render/draw";
import { sceneFor } from "./render/scene";
import { INK } from "./render/theme";
import {
  commitAtom,
  cursorAtom,
  fitRequestAtom,
  pendingItemAtom,
  planAtom,
  redrawAtom,
  selectionAtom,
  snappingAtom,
  toolAtom,
  viewAtom,
  viewportAtom,
  wallThicknessAtom,
  type Selection,
} from "./editor-atoms";
import type { Pointer, Tool, ToolHost } from "./tools";
import { makeItem } from "./tools/item";
import { fitBounds, toScreen, toWorld, zoomAt } from "./viewport";

// Custom drag type so only furniture from our toolbox can be dropped on the canvas
export const ITEM_MIME = "application/x-naksa-item";

type PlanCanvasProps = {
  tools: Record<string, Tool>;
  host: ToolHost;
};

// The drawing surface. Draws the plan and sends mouse input to the active tool.
export default function PlanCanvas({ tools, host }: PlanCanvasProps) {
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
    let hover: Selection | null = null;
    let pan: { start: Vec; x: number; y: number } | null = null;
    let spaceHeld = false;

    const options = (): DrawOptions => {
      return {
        viewport: store.get(viewportAtom),
        width,
        height,
        dpr: window.devicePixelRatio || 1,
        mode: store.get(viewAtom) === "engineer" ? "engineer" : "plan",
        grid: true,
        fontFamily,
      };
    };

    // Outline for the hovered (faint) or selected (strong) thing
    const highlight = (o: DrawOptions, target: Selection, strong: boolean) => {
      const plan = store.get(planAtom);
      const scene = sceneFor(plan);
      ctx.save();
      if (!strong) ctx.globalAlpha = 0.55;
      if (target.type === "wall") {
        const wall = plan.walls.find((w) => w.id === target.id);
        if (wall) outline(ctx, o, wallBox(wall, 0));
      } else if (target.type === "opening") {
        const opening = plan.openings.find((x) => x.id === target.id);
        const wall = opening && plan.walls.find((w) => w.id === opening.wallId);
        if (opening && wall) outline(ctx, o, openingBox(opening, wall, 30));
      } else if (target.type === "item") {
        const item = plan.items.find((i) => i.id === target.id);
        if (item) outline(ctx, o, itemCorners(item, 30));
      } else if (target.type === "dimension") {
        const d = plan.dimensions.find((x) => x.id === target.id);
        if (d) {
          const [a, b] = dimensionLine(d).map((p) =>
            toScreen(o.viewport, p)
          ) as [Vec, Vec];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = INK.select;
          ctx.lineWidth = strong ? 3 : 2;
          ctx.stroke();
        }
      } else if (target.type === "label") {
        const label = plan.labels.find((l) => l.id === target.id);
        if (label) {
          const p = toScreen(o.viewport, label.position);
          ctx.font = `600 13px ${fontFamily}`;
          const w = ctx.measureText(label.text).width + 16;
          ctx.beginPath();
          ctx.roundRect(p.x - w / 2, p.y - 13, w, 26, 6);
          ctx.strokeStyle = INK.select;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else {
        const room = scene.rooms.find((r) => r.key === target.id);
        if (room) outline(ctx, o, room.inner, strong);
      }
      ctx.restore();
    };

    // Draw order: plan, hover, selection, then whatever the active tool wants on top
    const draw = () => {
      frame = 0;
      if (width === 0 || height === 0) return;
      const tool = store.get(toolAtom);
      const selection = store.get(selectionAtom);
      const o = options();
      drawPlan(ctx, sceneFor(store.get(planAtom)), o);
      ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
      if (hover && tool === "select" && !sameTarget(hover, selection))
        highlight(o, hover, false);
      if (selection) highlight(o, selection, true);
      tools[tool]?.overlay?.(ctx, o, host);
      canvas.style.cursor = pan
        ? "grabbing"
        : spaceHeld
          ? "grab"
          : (tools[tool]?.cursor ?? "default");
    };
    // At most one redraw per frame, however many changes come in
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    // Zoom to fit the plan, the engineer view needs more room on the top and left for its dimensions
    const fit = () => {
      const bounds = sceneFor(store.get(planAtom)).bounds;
      if (!bounds || width === 0) {
        store.set(viewportAtom, {
          x: width / 2 - 5500 * 0.06,
          y: height / 2 - 4500 * 0.06,
          zoom: 0.06,
        });
        return;
      }
      const pad = store.get(viewAtom) === "engineer" ? ENGINEER_MARGIN : 600;
      store.set(
        viewportAtom,
        fitBounds(
          {
            minX: bounds.minX - pad,
            minY: bounds.minY - pad,
            maxX: bounds.maxX + 600,
            maxY: bounds.maxY + 600,
          },
          width,
          height,
          28
        )
      );
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

    // Redraw when anything that is drawn changes, and refit when asked to or when the view changes
    const unsubscribe = [
      ...[
        planAtom,
        toolAtom,
        pendingItemAtom,
        wallThicknessAtom,
        selectionAtom,
        viewportAtom,
        snappingAtom,
        cursorAtom,
        redrawAtom,
      ].map((watched) => store.sub(watched, schedule)),
      store.sub(fitRequestAtom, fit),
      store.sub(viewAtom, fit),
    ];

    const pointer = (e: PointerEvent | MouseEvent | DragEvent): Pointer => {
      const rect = canvas.getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      return {
        screen,
        world: toWorld(store.get(viewportAtom), screen),
        shift: e.shiftKey,
        alt: e.altKey,
      };
    };
    const active = () => tools[store.get(toolAtom)];

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
        return;
      }
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      active()?.down?.(p, host);
      schedule();
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
      active()?.move?.(p, host);
      hover =
        store.get(toolAtom) === "select" && e.buttons === 0
          ? hitTest(sceneFor(store.get(planAtom)), p.world, host.toWorld(5))
          : null;
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
        return;
      }
      active()?.up?.(pointer(e), host);
      schedule();
    };
    const onLeave = () => {
      hover = null;
      store.set(cursorAtom, null);
    };
    const onDouble = (e: MouseEvent) => {
      active()?.doubleClick?.(pointer(e), host);
      schedule();
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

    // Dropping furniture from the toolbox
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(ITEM_MIME)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    };
    const onDrop = (e: DragEvent) => {
      const kind = e.dataTransfer?.getData(ITEM_MIME);
      if (!kind) return;
      e.preventDefault();
      const p = pointer(e);
      const item = makeItem(store.get(planAtom), kind, p.world, e.altKey);
      if (!item) return;
      store.set(commitAtom, (plan) => addTo(plan, "items", item));
      store.set(selectionAtom, { type: "item", id: item.id });
      store.set(toolAtom, "select");
      store.set(pendingItemAtom, null);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("dblclick", onDouble);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContext);
    canvas.addEventListener("dragover", onDragOver);
    canvas.addEventListener("drop", onDrop);
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
      canvas.removeEventListener("dblclick", onDouble);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContext);
      canvas.removeEventListener("dragover", onDragOver);
      canvas.removeEventListener("drop", onDrop);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [store, tools, host]);

  return (
    <canvas
      ref={canvasRef}
      className="block size-full touch-none bg-paper focus-visible:outline-offset-[-2px]"
      tabIndex={0}
      aria-label="Floor plan drawing. Use the tools on the left to draw; the properties panel lists every room."
    />
  );
}

const sameTarget = (a: Selection | null, b: Selection | null) =>
  !!a && !!b && a.type === b.type && a.id === b.id;

export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}
