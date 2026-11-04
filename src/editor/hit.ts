import {
  add,
  distance,
  pointInPolygon,
  projectOnSegment,
  scale,
  sub,
  type Vec,
} from "@/core/geometry";
import type { Opening, Plan, Wall } from "@/core/model";
import { normalize, perp } from "@/core/geometry";
import { pointAlong, wallLength } from "@/core/walls";
import type { Scene } from "./render/scene";
import type { Selection } from "./editor-atoms";

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

// Finds what is under the cursor, small things on top win:
// doors and windows, walls, then rooms.
// slack is how close (in mm) counts as a hit.
export function hitTest(
  scene: Scene,
  point: Vec,
  slack: number
): Selection | null {
  const plan: Plan = scene.plan;
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

export const near = (a: Vec, b: Vec, reach: number): boolean =>
  distance(a, b) <= reach;
