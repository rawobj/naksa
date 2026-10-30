import type { Vec } from "@/core/geometry";
import type { DrawOptions } from "./render/draw";
import { INK } from "./render/theme";
import type { SnapKind } from "./snap";
import { toScreen } from "./viewport";

type Ctx = CanvasRenderingContext2D;

// Outlines a world-space polygon in screen space
export function outline(
  ctx: Ctx,
  o: DrawOptions,
  points: readonly Vec[],
  fill = true
): void {
  ctx.beginPath();
  points.forEach((p, i) => {
    const s = toScreen(o.viewport, p);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = INK.selectSoft;
    ctx.fill();
  }
  ctx.strokeStyle = INK.select;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// A round drag handle
export function handle(ctx: Ctx, o: DrawOptions, at: Vec, radius = 5): void {
  const s = toScreen(o.viewport, at);
  ctx.beginPath();
  ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = INK.select;
  ctx.lineWidth = 1.75;
  ctx.stroke();
}

// Marks where the cursor snapped: a square on ends, a diamond on walls, a cross elsewhere
export function snapMarker(
  ctx: Ctx,
  o: DrawOptions,
  at: Vec,
  kind: SnapKind
): void {
  if (kind === "none") return;
  const s = toScreen(o.viewport, at);
  ctx.strokeStyle = INK.select;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (kind === "endpoint") {
    ctx.rect(s.x - 5, s.y - 5, 10, 10);
  } else if (kind === "midpoint" || kind === "wall") {
    ctx.moveTo(s.x, s.y - 6);
    ctx.lineTo(s.x + 6, s.y);
    ctx.lineTo(s.x, s.y + 6);
    ctx.lineTo(s.x - 6, s.y);
    ctx.closePath();
  } else {
    ctx.moveTo(s.x - 5, s.y);
    ctx.lineTo(s.x + 5, s.y);
    ctx.moveTo(s.x, s.y - 5);
    ctx.lineTo(s.x, s.y + 5);
  }
  ctx.stroke();
}

// A small filled label next to a point, for live measurements
export function readout(
  ctx: Ctx,
  o: DrawOptions,
  at: Vec,
  value: string
): void {
  const s = toScreen(o.viewport, at);
  ctx.font = `700 12px ${o.fontFamily}`;
  const w = ctx.measureText(value).width + 16;
  const x = Math.min(Math.max(8, s.x + 14), o.width - w - 8);
  const y = Math.min(Math.max(8, s.y + 14), o.height - 32);
  ctx.beginPath();
  ctx.roundRect(x, y, w, 24, 6);
  ctx.fillStyle = INK.select;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(value, x + 8, y + 12.5);
}
