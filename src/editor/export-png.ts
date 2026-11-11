import type { Plan } from "@/core/model";
import { formatArea } from "@/core/rooms";
import { drawPlan, ENGINEER_MARGIN, openingSchedule } from "./render/draw";
import { sceneFor } from "./render/scene";
import { INK } from "./render/theme";

const MAX_SIDE = 3200;

// Renders a plan to a canvas for export: the drawing on white, with a title
// strip carrying the name, floor area and a scale bar. The engineer view also
// gets its door and window schedule.
export function renderPlanImage(
  plan: Plan,
  mode: "plan" | "engineer",
  fontFamily: string
): HTMLCanvasElement | null {
  const scene = sceneFor(plan);
  if (!scene.bounds) return null;
  const b = scene.bounds;
  const lead = mode === "engineer" ? ENGINEER_MARGIN : 700;
  const trail = 700;
  const spanX = b.maxX - b.minX + lead + trail;
  const spanY = b.maxY - b.minY + lead + trail;
  const zoom = Math.min(0.32, MAX_SIDE / Math.max(spanX, spanY));
  const k = Math.min(3, Math.max(1, zoom / 0.07));

  const schedule = mode === "engineer" ? openingSchedule(scene) : [];
  const columns = 4;
  const scheduleRows = Math.ceil(schedule.length / columns);
  const footer = Math.round(
    (92 + (scheduleRows ? 34 + scheduleRows * 22 : 0)) * k
  );
  const width = Math.round(spanX * zoom);
  const height = Math.round(spanY * zoom) + footer;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  drawPlan(ctx, scene, {
    viewport: { zoom, x: (lead - b.minX) * zoom, y: (lead - b.minY) * zoom },
    width,
    height,
    dpr: 1,
    mode,
    grid: false,
    fontFamily,
    weight: k,
  });

  // Title strip
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const top = height - footer;
  const pad = 28 * k;
  ctx.fillStyle = INK.paper;
  ctx.fillRect(0, top, width, footer);
  ctx.fillStyle = INK.line;
  ctx.fillRect(pad, top, width - pad * 2, 1.5 * k);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `700 ${20 * k}px ${fontFamily}`;
  ctx.fillText(plan.name, pad, top + 38 * k);
  const total = scene.rooms.reduce((sum, room) => sum + room.area, 0);
  ctx.font = `500 ${12 * k}px ${fontFamily}`;
  ctx.fillStyle = INK.soft;
  const facts = [
    mode === "engineer"
      ? "Engineer view, dimensions in millimetres"
      : "Plan view",
    `${scene.rooms.length} ${scene.rooms.length === 1 ? "room" : "rooms"}`,
    `Floor area ${formatArea(total)}`,
  ];
  ctx.fillText(facts.join("   ·   "), pad, top + 60 * k);

  // Scale bar: alternating one-metre blocks
  const metre = 1000 * zoom;
  const blocks = Math.max(2, Math.min(5, Math.floor((width * 0.3) / metre)));
  const barX = width - pad - blocks * metre;
  const barY = top + 30 * k;
  for (let i = 0; i < blocks; i++) {
    ctx.fillStyle = i % 2 === 0 ? INK.line : INK.paper;
    ctx.fillRect(barX + i * metre, barY, metre, 6 * k);
  }
  ctx.strokeStyle = INK.line;
  ctx.lineWidth = k;
  ctx.strokeRect(barX, barY, blocks * metre, 6 * k);
  ctx.fillStyle = INK.soft;
  ctx.font = `600 ${11 * k}px ${fontFamily}`;
  ctx.textAlign = "left";
  ctx.fillText("0", barX, barY + 22 * k);
  ctx.textAlign = "right";
  ctx.fillText(`${blocks} m`, barX + blocks * metre, barY + 22 * k);
  ctx.fillText("Naksa", width - pad, top + 20 * k);

  if (schedule.length) {
    const y0 = top + 92 * k;
    ctx.textAlign = "left";
    ctx.fillStyle = INK.line;
    ctx.font = `700 ${12 * k}px ${fontFamily}`;
    ctx.fillText("Doors and windows (width × height, sill)", pad, y0);
    const cell = (width - pad * 2) / columns;
    schedule.forEach((row, i) => {
      const x = pad + (i % columns) * cell;
      const y = y0 + (24 + Math.floor(i / columns) * 22) * k;
      ctx.font = `700 ${11.5 * k}px ${fontFamily}`;
      ctx.fillStyle = INK.line;
      ctx.fillText(row.tag, x, y);
      ctx.font = `500 ${11.5 * k}px ${fontFamily}`;
      ctx.fillStyle = INK.soft;
      const sill = row.kind === "Window" ? `, sill ${row.sill}` : "";
      ctx.fillText(`${row.width} × ${row.height}${sill}`, x + 34 * k, y);
    });
  }
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
