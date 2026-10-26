import type { Bounds, Vec } from "@/core/geometry";
import type { Viewport } from "./editor-atoms";

export const MIN_ZOOM = 0.005;
export const MAX_ZOOM = 1.2;

export const toScreen = (view: Viewport, p: Vec): Vec => ({
  x: view.x + p.x * view.zoom,
  y: view.y + p.y * view.zoom,
});

export const toWorld = (view: Viewport, p: Vec): Vec => ({
  x: (p.x - view.x) / view.zoom,
  y: (p.y - view.y) / view.zoom,
});

// Zooms by a factor while keeping the world point under anchor still
export function zoomAt(view: Viewport, anchor: Vec, factor: number): Viewport {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
  const world = toWorld(view, anchor);
  return { zoom, x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom };
}

// A viewport that shows bounds centred with a margin, in a canvas of the given size
export function fitBounds(
  bounds: Bounds,
  width: number,
  height: number,
  margin = 80
): Viewport {
  const w = Math.max(1, bounds.maxX - bounds.minX);
  const h = Math.max(1, bounds.maxY - bounds.minY);
  const zoom = Math.min(
    MAX_ZOOM,
    Math.max(
      MIN_ZOOM,
      Math.min((width - margin * 2) / w, (height - margin * 2) / h)
    )
  );
  return {
    zoom,
    x: width / 2 - ((bounds.minX + bounds.maxX) / 2) * zoom,
    y: height / 2 - ((bounds.minY + bounds.maxY) / 2) * zoom,
  };
}
