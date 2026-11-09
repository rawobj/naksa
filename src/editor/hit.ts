import {
  add,
  distance,
  pointInPolygon,
  projectOnSegment,
  rotate,
  scale,
  sub,
  type Vec,
} from "@/core/geometry";
import type { Dimension, Item, Opening, Plan, Wall } from "@/core/model";
import { normalize, perp } from "@/core/geometry";
import { pointAlong, wallLength } from "@/core/walls";
import type { Scene } from "./render/scene";
import type { Selection } from "./editor-atoms";

// The four corners of an item's footprint
export function itemCorners(item: Item, grow = 0): Vec[] {
  const w = item.width / 2 + grow;
  const d = item.depth / 2 + grow;
  const angle = (item.rotation * Math.PI) / 180;
  return [
    { x: -w, y: -d },
    { x: w, y: -d },
    { x: w, y: d },
    { x: -w, y: d },
  ].map((p) => add(item.position, rotate(p, angle)));
}

// The outline of a wall as a plain rectangle, for highlights
export function wallBox(wall: Wall, grow = 0): Vec[] {
  const dir = normalize(sub(wall.b, wall.a));
  const n = scale(perp(dir), wall.thickness / 2 + grow);
  return [add(wall.a, n), add(wall.b, n), sub(wall.b, n), sub(wall.a, n)];
}

// The rectangle an opening cuts out of its wall
export function openingBox(opening: Opening, wall: Wall, grow = 0): Vec[] {
  const dir = normalize(sub(wall.b, wall.a));
  const n = scale(perp(dir), wall.thickness / 2 + grow);
  const a = pointAlong(wall, opening.offset - opening.width / 2 - grow);
  const b = pointAlong(wall, opening.offset + opening.width / 2 + grow);
  return [add(a, n), add(b, n), sub(b, n), sub(a, n)];
}

// The two ends of a dimension line, where it is drawn
export function dimensionLine(d: Dimension): [Vec, Vec] {
  const n = scale(perp(normalize(sub(d.b, d.a))), d.offset);
  return [add(d.a, n), add(d.b, n)];
}

// Finds what is under the cursor, small things on top win:
// notes, dimensions, doors and windows, furniture, walls, then rooms.
// slack is how close (in mm) counts as a hit.
export function hitTest(
  scene: Scene,
  point: Vec,
  slack: number
): Selection | null {
  const plan: Plan = scene.plan;
  for (const label of plan.labels) {
    const reach = Math.max(slack * 2.5, 200);
    if (
      Math.abs(point.x - label.position.x) < reach * 1.6 &&
      Math.abs(point.y - label.position.y) < reach * 0.7
    ) {
      return { type: "label", id: label.id };
    }
  }
  for (const d of plan.dimensions) {
    const [a, b] = dimensionLine(d);
    if (projectOnSegment(point, a, b).distance <= slack * 1.4)
      return { type: "dimension", id: d.id };
  }
  for (const opening of plan.openings) {
    const wall = plan.walls.find((w) => w.id === opening.wallId);
    if (
      wall &&
      wallLength(wall) > 1 &&
      pointInPolygon(point, openingBox(opening, wall, slack * 0.6))
    ) {
      return { type: "opening", id: opening.id };
    }
  }
  // Backwards so the item drawn last (on top) is picked first
  for (let i = plan.items.length - 1; i >= 0; i--) {
    const item = plan.items[i]!;
    if (pointInPolygon(point, itemCorners(item)))
      return { type: "item", id: item.id };
  }
  let best: { id: string; d: number } | null = null;
  for (const wall of plan.walls) {
    const d =
      projectOnSegment(point, wall.a, wall.b).distance - wall.thickness / 2;
    if (d <= slack && (!best || d < best.d)) best = { id: wall.id, d };
  }
  if (best) return { type: "wall", id: best.id };
  for (const room of scene.rooms) {
    if (pointInPolygon(point, room.outline))
      return { type: "room", id: room.key };
  }
  return null;
}

// Where an item's rotate handle sits: beyond the middle of its front edge
export function rotateHandle(item: Item, reach: number): Vec {
  const angle = (item.rotation * Math.PI) / 180;
  return add(item.position, rotate({ x: 0, y: item.depth / 2 + reach }, angle));
}

export const near = (a: Vec, b: Vec, reach: number): boolean =>
  distance(a, b) <= reach;
