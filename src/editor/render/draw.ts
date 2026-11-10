import {
  add,
  angleOf,
  boundsOf,
  distance,
  midpoint,
  normalize,
  perp,
  scale,
  sub,
  type Vec,
} from "@/core/geometry";
import { catalogueEntry, finishFor } from "@/core/catalogue";
import type { Dimension, Item, Opening, Wall } from "@/core/model";
import { formatArea } from "@/core/rooms";
import { pointAlong, wallDirection, wallLength } from "@/core/walls";
import type { Viewport } from "../editor-atoms";
import type { Scene } from "./scene";
import { INK } from "./theme";

export type DrawOptions = {
  viewport: Viewport;
  width: number; // canvas size in CSS pixels
  height: number;
  dpr: number;
  mode: "plan" | "engineer";
  grid: boolean;
  fontFamily: string;
  weight?: number; // multiplier for text and line weights; exports use more than 1
};

type Ctx = CanvasRenderingContext2D;

// Draws a whole plan.
// Geometry is drawn in world space (mm), text in screen space so it stays the same size at any zoom.
export function drawPlan(ctx: Ctx, scene: Scene, o: DrawOptions): void {
  const k = o.weight ?? 1;
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.fillStyle = INK.paper;
  ctx.fillRect(0, 0, o.width, o.height);
  if (o.grid) drawGrid(ctx, o);

  const world = () => {
    const { x, y, zoom } = o.viewport;
    ctx.setTransform(o.dpr * zoom, 0, 0, o.dpr * zoom, o.dpr * x, o.dpr * y);
  };
  const screen = () => ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  // One screen pixel in world units
  const px = k / o.viewport.zoom;

  world();
  if (o.mode === "plan") drawFloors(ctx, scene, o);
  for (const item of scene.plan.items) drawItem(ctx, item, px, o.mode);
  drawWalls(ctx, scene, px, o);
  for (const opening of scene.plan.openings) {
    const wall = scene.plan.walls.find((w) => w.id === opening.wallId);
    if (wall) drawOpening(ctx, opening, wall, px, o.mode);
  }

  screen();
  const text = makeText(ctx, o, k);
  for (const d of scene.plan.dimensions)
    drawDimension(ctx, d, o, text, INK.soft);
  drawRoomLabels(scene, o, text);
  if (o.mode === "engineer") drawEngineering(ctx, scene, o, text);
  for (const label of scene.plan.labels) {
    const p = toScreenPoint(o.viewport, label.position);
    text(label.text, p.x, p.y, { size: 13, weight: 600, color: INK.line });
  }
}

const toScreenPoint = (view: Viewport, p: Vec): Vec => ({
  x: view.x + p.x * view.zoom,
  y: view.y + p.y * view.zoom,
});

type TextStyle = {
  size?: number;
  weight?: number;
  color?: string;
  align?: CanvasTextAlign;
  angle?: number; // rotation in radians around the anchor point
  halo?: boolean;
};

type TextFn = (value: string, x: number, y: number, style?: TextStyle) => void;

// Text with a paper coloured outline behind it so it stays readable over floors and lines
function makeText(ctx: Ctx, o: DrawOptions, k: number): TextFn {
  return (value, x, y, style = {}) => {
    const size = (style.size ?? 12) * k;
    ctx.save();
    ctx.translate(x, y);
    if (style.angle) ctx.rotate(style.angle);
    ctx.font = `${style.weight ?? 500} ${size}px ${o.fontFamily}`;
    ctx.textAlign = style.align ?? "center";
    ctx.textBaseline = "middle";
    if (style.halo !== false) {
      ctx.lineJoin = "round";
      ctx.lineWidth = size * 0.36;
      ctx.strokeStyle = INK.paper;
      ctx.strokeText(value, 0, 0);
    }
    ctx.fillStyle = style.color ?? INK.line;
    ctx.fillText(value, 0, 0);
    ctx.restore();
  };
}

function drawGrid(ctx: Ctx, o: DrawOptions): void {
  const { x, y, zoom } = o.viewport;
  // Pick the smallest grid step that is at least 14px apart on screen, so the grid never gets too dense
  const steps = [50, 100, 500, 1000, 5000, 10000];
  const minor = steps.find((s) => s * zoom >= 14) ?? 10000;
  const major = minor < 1000 ? 1000 : minor * 5;
  const lines = (step: number, color: string) => {
    ctx.beginPath();
    const s = step * zoom;
    // Only the lines that are on screen are drawn, starting from the first one left of the canvas.
    // The +0.5 puts a 1px line on a pixel instead of between two, so it stays sharp.
    for (let gx = ((x % s) + s) % s; gx < o.width; gx += s) {
      const lx = Math.round(gx) + 0.5;
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, o.height);
    }
    for (let gy = ((y % s) + s) % s; gy < o.height; gy += s) {
      const ly = Math.round(gy) + 0.5;
      ctx.moveTo(0, ly);
      ctx.lineTo(o.width, ly);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  lines(minor, INK.gridMinor);
  lines(major, INK.gridMajor);
}

function trace(ctx: Ctx, points: readonly Vec[]): void {
  points.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
  );
  ctx.closePath();
}

// Floor finishes, drawn to scale: real plank widths and tile sizes
function drawFloors(ctx: Ctx, scene: Scene, o: DrawOptions): void {
  const zoom = o.viewport.zoom;
  for (const room of scene.rooms) {
    const finish = finishFor(room.finish);
    ctx.beginPath();
    trace(ctx, room.outline);
    ctx.fillStyle = finish.color;
    ctx.fill();
    if (finish.pattern === "none" || finish.size * zoom < 5) continue;

    const { minX, minY, maxX, maxY } = boundsOf(room.outline)!;
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    const size = finish.size;
    if (finish.pattern === "tiles") {
      for (let gx = Math.ceil(minX / size) * size; gx < maxX; gx += size) {
        ctx.moveTo(gx, minY);
        ctx.lineTo(gx, maxY);
      }
      for (let gy = Math.ceil(minY / size) * size; gy < maxY; gy += size) {
        ctx.moveTo(minX, gy);
        ctx.lineTo(maxX, gy);
      }
    } else {
      // Boards run along the longer side of the room, joints staggered
      const along = maxX - minX >= maxY - minY;
      const board = 1500;
      const [u0, u1, v0, v1] = along
        ? [minX, maxX, minY, maxY]
        : [minY, maxY, minX, maxX];
      let row = Math.floor(v0 / size);
      for (let v = row * size; v < v1; v += size, row++) {
        if (along) {
          ctx.moveTo(u0, v);
          ctx.lineTo(u1, v);
        } else {
          ctx.moveTo(v, u0);
          ctx.lineTo(v, u1);
        }
        const shift = ((row * 7) % 5) * (board / 5);
        for (
          let u = Math.floor(u0 / board) * board + shift;
          u < u1;
          u += board
        ) {
          if (along) {
            ctx.moveTo(u, v);
            ctx.lineTo(u, v + size);
          } else {
            ctx.moveTo(v, u);
            ctx.lineTo(v + size, u);
          }
        }
      }
    }
    ctx.strokeStyle = finish.line;
    ctx.lineWidth = 1 / zoom;
    ctx.stroke();
    ctx.restore();
  }
}

function drawWalls(ctx: Ctx, scene: Scene, px: number, o: DrawOptions): void {
  if (scene.solids.length === 0) return;
  const union = () => {
    ctx.beginPath();
    for (const solid of scene.solids) trace(ctx, solid);
  };
  if (o.mode === "plan") {
    union();
    ctx.fillStyle = INK.wall;
    ctx.strokeStyle = INK.wall;
    ctx.lineWidth = px * 0.75;
    ctx.lineJoin = "miter";
    ctx.fill();
    ctx.stroke();
    return;
  }
  // Engineer view: outlined walls with a section hatch.
  // Stroke first then fill, so the fill covers the inner strokes where walls overlap
  // and only one outline is left around the whole wall shape.
  union();
  ctx.strokeStyle = INK.line;
  ctx.lineWidth = px * 2.6;
  ctx.lineJoin = "miter";
  ctx.stroke();
  ctx.fillStyle = INK.paper;
  ctx.fill();
  if (!scene.bounds) return;
  ctx.save();
  ctx.clip();
  const b = scene.bounds;
  const gap = px * 7;
  const span = b.maxY - b.minY + b.maxX - b.minX;
  ctx.beginPath();
  for (let t = b.minX - (b.maxY - b.minY); t < b.maxX; t += gap) {
    ctx.moveTo(t, b.maxY);
    ctx.lineTo(t + span, b.maxY - span);
  }
  ctx.strokeStyle = INK.soft;
  ctx.lineWidth = px * 0.7;
  ctx.stroke();
  ctx.restore();
}

// Geometry of an opening: its jambs on the centreline and the wall's axes
export function openingFrame(opening: Opening, wall: Wall) {
  const dir = wallDirection(wall);
  const normal = perp(dir);
  const centre = pointAlong(wall, opening.offset);
  const start = add(centre, scale(dir, -opening.width / 2));
  const end = add(centre, scale(dir, opening.width / 2));
  return { dir, normal, centre, start, end };
}

function drawOpening(
  ctx: Ctx,
  opening: Opening,
  wall: Wall,
  px: number,
  mode: DrawOptions["mode"]
): void {
  const { normal, start, end } = openingFrame(opening, wall);
  const half = wall.thickness / 2;
  const corner = (p: Vec, side: number) => add(p, scale(normal, side * half));
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";

  if (opening.kind === "window") {
    ctx.beginPath();
    trace(ctx, [
      corner(start, 1),
      corner(end, 1),
      corner(end, -1),
      corner(start, -1),
    ]);
    ctx.fillStyle = mode === "plan" ? INK.glass : INK.paper;
    ctx.fill();
    ctx.strokeStyle = INK.line;
    ctx.lineWidth = px * 1.1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineWidth = px * 0.9;
    ctx.stroke();
    return;
  }

  // Door: threshold lines, the leaf standing open, and its swing arc
  ctx.beginPath();
  for (const side of [1, -1]) {
    const p = corner(start, side);
    const q = corner(end, side);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  }
  ctx.strokeStyle = INK.faint;
  ctx.lineWidth = px * 0.8;
  ctx.stroke();

  const side = opening.swing === "left" ? 1 : -1;
  const hinge = corner(opening.hinge === "start" ? start : end, side);
  const latch = corner(opening.hinge === "start" ? end : start, side);
  const tip = add(hinge, scale(normal, side * opening.width));
  ctx.beginPath();
  ctx.moveTo(hinge.x, hinge.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.strokeStyle = INK.line;
  ctx.lineWidth = px * (mode === "plan" ? 2 : 1.4);
  ctx.stroke();

  const a0 = angleOf(sub(tip, hinge));
  const a1 = angleOf(sub(latch, hinge));
  let sweep = a1 - a0;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  while (sweep < -Math.PI) sweep += Math.PI * 2;
  ctx.beginPath();
  ctx.arc(hinge.x, hinge.y, opening.width, a0, a1, sweep < 0);
  ctx.lineWidth = px * 0.9;
  ctx.strokeStyle = INK.soft;
  ctx.stroke();
}

// Draws a catalogue symbol in a box centred on the origin
export function drawSymbol(
  ctx: Ctx,
  kind: string,
  width: number,
  depth: number
): void {
  const entry = catalogueEntry(kind);
  const shapes = entry?.shapes ?? [
    { t: "rect" as const, x: 0, y: 0, w: 1, h: 1 },
  ];
  const unit = Math.min(width, depth);
  for (const s of shapes) {
    ctx.beginPath();
    if (s.t === "rect") {
      const r = Math.min(
        (s.r ?? 0) * unit,
        (s.w * width) / 2,
        (s.h * depth) / 2
      );
      ctx.roundRect(
        s.x * width - width / 2,
        s.y * depth - depth / 2,
        s.w * width,
        s.h * depth,
        r
      );
      ctx.fill();
    } else if (s.t === "ellipse") {
      ctx.ellipse(
        s.cx * width - width / 2,
        s.cy * depth - depth / 2,
        s.rx * width,
        s.ry * depth,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } else {
      ctx.moveTo(s.x1 * width - width / 2, s.y1 * depth - depth / 2);
      ctx.lineTo(s.x2 * width - width / 2, s.y2 * depth - depth / 2);
    }
    ctx.stroke();
  }
}

function drawItem(
  ctx: Ctx,
  item: Item,
  px: number,
  mode: DrawOptions["mode"]
): void {
  ctx.save();
  ctx.translate(item.position.x, item.position.y);
  ctx.rotate((item.rotation * Math.PI) / 180);
  ctx.fillStyle = mode === "plan" ? INK.furniture : "rgba(0,0,0,0)";
  ctx.strokeStyle = mode === "plan" ? INK.furnitureLine : INK.faint;
  ctx.lineWidth = px * (mode === "plan" ? 1.1 : 0.9);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  drawSymbol(ctx, item.kind, item.width, item.depth);
  ctx.restore();
}

// Keeps text reading left to right, whichever way a line was drawn
function readable(angle: number): number {
  let a = angle;
  while (a >= Math.PI / 2 - 1e-6) a -= Math.PI;
  while (a < -Math.PI / 2 - 1e-6) a += Math.PI;
  return a;
}

export const formatLength = (mm: number): string => `${Math.round(mm)}`;

// A dimension line with extension lines, tick marks and its length in millimetres
export function drawDimension(
  ctx: Ctx,
  d: Dimension,
  o: DrawOptions,
  text: TextFn,
  color: string
): void {
  const len = distance(d.a, d.b);
  if (len < 1) return;
  const k = o.weight ?? 1;
  const dir = normalize(sub(d.b, d.a));
  const normal = perp(dir);
  const a = toScreenPoint(o.viewport, add(d.a, scale(normal, d.offset)));
  const b = toScreenPoint(o.viewport, add(d.b, scale(normal, d.offset)));
  const a0 = toScreenPoint(o.viewport, d.a);
  const b0 = toScreenPoint(o.viewport, d.b);
  const sign = Math.sign(d.offset) || 1;
  const reach = scale(normal, sign * 5 * k);
  const clear = scale(normal, sign * 4 * k);

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  for (const [from, to] of [
    [a0, a],
    [b0, b],
  ] as const) {
    if (distance(from, to) < 6 * k) continue;
    ctx.moveTo(from.x + clear.x, from.y + clear.y);
    ctx.lineTo(to.x + reach.x, to.y + reach.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = k;
  ctx.stroke();

  // Architectural ticks: short strokes at 45 degrees through each end
  const tick = scale(normalize(add(dir, normal)), 4.5 * k);
  ctx.beginPath();
  for (const p of [a, b]) {
    ctx.moveTo(p.x - tick.x, p.y - tick.y);
    ctx.lineTo(p.x + tick.x, p.y + tick.y);
  }
  ctx.lineWidth = 1.6 * k;
  ctx.stroke();

  const angle = readable(angleOf(dir));
  const mid = midpoint(a, b);
  const lift = { x: Math.sin(angle) * 9 * k, y: -Math.cos(angle) * 9 * k };
  if (distance(a, b) > 26 * k) {
    text(formatLength(len), mid.x + lift.x, mid.y + lift.y, {
      size: 11,
      weight: 600,
      color,
      angle,
    });
  }
}

function drawRoomLabels(scene: Scene, o: DrawOptions, text: TextFn): void {
  for (const room of scene.rooms) {
    const p = toScreenPoint(o.viewport, room.centroid);
    const box = boundsOf(room.inner)!;
    const w = box.maxX - box.minX;
    const h = box.maxY - box.minY;
    // Skip labels that would not fit in the room at this zoom
    if (w * o.viewport.zoom < 46 * (o.weight ?? 1)) continue;
    const engineer = o.mode === "engineer";
    text(room.name, p.x, p.y - (engineer ? 15 : 8) * (o.weight ?? 1), {
      size: 13,
      weight: 700,
    });
    text(
      formatArea(room.area),
      p.x,
      p.y + (engineer ? 1 : 8) * (o.weight ?? 1),
      { size: 11, color: INK.soft }
    );
    if (engineer) {
      text(
        `${formatLength(w)} × ${formatLength(h)}`,
        p.x,
        p.y + 16 * (o.weight ?? 1),
        { size: 11, color: INK.soft }
      );
    }
  }
}

// Space the engineer view's own dimensions need around the walls, in millimetres
export const ENGINEER_MARGIN = 1900;

// What the engineer view adds: overall and running dimensions along the top and left
// of the building, and a numbered tag on every door and window.
function drawEngineering(
  ctx: Ctx,
  scene: Scene,
  o: DrawOptions,
  text: TextFn
): void {
  const { walls, openings } = scene.plan;
  if (walls.length === 0 || !scene.bounds) return;
  const k = o.weight ?? 1;
  const top = scene.bounds.minY;
  const left = scene.bounds.minX;
  // Running dimensions are taken between the walls that reach each outside face
  const reach = 400;
  const xs = stations(
    walls
      .flatMap((w) => [w.a, w.b])
      .filter((p) => p.y - top < reach)
      .map((p) => p.x)
  );
  const ys = stations(
    walls
      .flatMap((w) => [w.a, w.b])
      .filter((p) => p.x - left < reach)
      .map((p) => p.y)
  );
  const topLine = Math.min(...walls.flatMap((w) => [w.a.y, w.b.y]));
  const leftLine = Math.min(...walls.flatMap((w) => [w.a.x, w.b.x]));
  const first = 650;
  const second = 1300;

  const chain = (
    values: number[],
    make: (from: number, to: number, offset: number) => Dimension
  ) => {
    if (values.length < 2) return;
    if (values.length > 2) {
      for (let i = 0; i < values.length - 1; i++) {
        drawDimension(
          ctx,
          make(values[i]!, values[i + 1]!, first),
          o,
          text,
          INK.line
        );
      }
    }
    drawDimension(
      ctx,
      make(
        values[0]!,
        values[values.length - 1]!,
        values.length > 2 ? second : first
      ),
      o,
      text,
      INK.line
    );
  };
  chain(xs, (from, to, offset) => ({
    id: "",
    a: { x: from, y: topLine },
    b: { x: to, y: topLine },
    offset,
  }));
  chain(ys, (from, to, offset) => ({
    id: "",
    a: { x: leftLine, y: to },
    b: { x: leftLine, y: from },
    offset,
  }));

  let doors = 0;
  let windows = 0;
  for (const opening of openings) {
    const wall = walls.find((w) => w.id === opening.wallId);
    if (!wall || wallLength(wall) < 1) continue;
    const tag = opening.kind === "door" ? `D${++doors}` : `W${++windows}`;
    const { normal, centre } = openingFrame(opening, wall);
    // Tags sit on the side away from a door's swing so the two never collide
    const side =
      opening.kind === "door" ? (opening.swing === "left" ? -1 : 1) : 1;
    const at = toScreenPoint(
      o.viewport,
      add(centre, scale(normal, side * (wall.thickness / 2)))
    );
    const push = 13 * k;
    const x = at.x + normal.x * side * push;
    const y = at.y + normal.y * side * push;
    ctx.font = `700 ${9.5 * k}px ${o.fontFamily}`;
    const w = Math.max(19 * k, ctx.measureText(tag).width + 9 * k);
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 9.5 * k, w, 19 * k, 9.5 * k);
    ctx.fillStyle = INK.paper;
    ctx.fill();
    ctx.strokeStyle = INK.line;
    ctx.lineWidth = k;
    ctx.stroke();
    text(tag, x, y + 0.5 * k, { size: 9.5, weight: 700, halo: false });
  }
}

// Sorted distinct coordinates, merging any closer than 5 mm
function stations(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (last === undefined || v - last > 5) out.push(v);
  }
  return out;
}
