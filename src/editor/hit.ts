import {
  add,
  distance,
  projectOnSegment,
  scale,
  sub,
  type Vec,
} from "@/core/geometry";
import type { Plan, Wall } from "@/core/model";
import { normalize, perp } from "@/core/geometry";
import type { Scene } from "./render/scene";
import type { Selection } from "./editor-atoms";

// The outline of a wall as a plain rectangle, for highlights
export function wallBox(wall: Wall, grow = 0): Vec[] {
  const dir = normalize(sub(wall.b, wall.a));
  const n = scale(perp(dir), wall.thickness / 2 + grow);
  return [add(wall.a, n), add(wall.b, n), sub(wall.b, n), sub(wall.a, n)];
}

// Finds the wall under the cursor, the closest one wins.
// slack is how close (in mm) counts as a hit.
export function hitTest(
  scene: Scene,
  point: Vec,
  slack: number
): Selection | null {
  const plan: Plan = scene.plan;
  let best: { id: string; d: number } | null = null;
  for (const wall of plan.walls) {
    const d =
      projectOnSegment(point, wall.a, wall.b).distance - wall.thickness / 2;
    if (d <= slack && (!best || d < best.d)) best = { id: wall.id, d };
  }
  if (best) return { type: "wall", id: best.id };
  return null;
}

export const near = (a: Vec, b: Vec, reach: number): boolean =>
  distance(a, b) <= reach;
