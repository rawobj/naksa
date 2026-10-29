import {
  angleOf,
  distance,
  fromAngle,
  length,
  projectOnSegment,
  roundTo,
  sub,
  add,
  type Vec,
} from "@/core/geometry";
import type { Wall } from "@/core/model";

export type SnapKind =
  "endpoint" | "midpoint" | "wall" | "angle" | "grid" | "none";

export type SnapResult = {
  point: Vec;
  kind: SnapKind;
};

export type SnapOptions = {
  walls: readonly Wall[];
  radius: number; // snap radius in millimetres; callers derive it from the zoom
  grid: number; // grid module in millimetres
  from?: Vec | null; // when drawing from a point, lock the direction to 45 degree steps
  ignore?: ReadonlySet<string>; // wall ids to ignore, such as the wall being dragged
  enabled: boolean;
};

const ANGLE_STEP = Math.PI / 4;
// How far off an angle step a direction may be and still lock to it
const ANGLE_TOLERANCE = (7 * Math.PI) / 180;

// Finds the best place for a point near the cursor.
// Order of priority: wall ends, wall midpoints, anywhere on a wall, angle lock, then the grid.
export function snapPoint(cursor: Vec, options: SnapOptions): SnapResult {
  if (!options.enabled) return { point: cursor, kind: "none" };
  const { walls, radius, ignore } = options;

  // Bias below 1 makes a target easier to grab, above 1 makes it harder
  let best: SnapResult | null = null;
  let bestDistance = radius;
  const consider = (point: Vec, kind: SnapKind, bias = 1) => {
    const d = distance(cursor, point) * bias;
    if (d <= bestDistance) {
      best = { point, kind };
      bestDistance = d;
    }
  };

  for (const wall of walls) {
    if (ignore?.has(wall.id)) continue;
    consider(wall.a, "endpoint", 0.6);
    consider(wall.b, "endpoint", 0.6);
  }
  if (best) return best;

  for (const wall of walls) {
    if (ignore?.has(wall.id)) continue;
    consider(
      { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 },
      "midpoint",
      1.6
    );
  }
  if (best) return best;

  const locked = options.from
    ? lockAngle(options.from, cursor, options.grid)
    : null;

  for (const wall of walls) {
    if (ignore?.has(wall.id)) continue;
    const hit = projectOnSegment(cursor, wall.a, wall.b);
    if (hit.distance > bestDistance) continue;
    // Prefer where the locked ray meets the wall, so the new wall stays square
    let point = hit.point;
    if (locked) {
      const onWall = projectOnSegment(locked, wall.a, wall.b);
      if (onWall.distance < 1) point = onWall.point;
    }
    best = { point, kind: "wall" };
    bestDistance = hit.distance;
  }
  if (best) return best;

  if (locked) return { point: locked, kind: "angle" };
  return {
    point: {
      x: roundTo(cursor.x, options.grid),
      y: roundTo(cursor.y, options.grid),
    },
    kind: "grid",
  };
}

// Locks the direction to 45 degree steps and rounds the length to the grid
function lockAngle(from: Vec, cursor: Vec, grid: number): Vec | null {
  const delta = sub(cursor, from);
  const len = length(delta);
  if (len < 1) return null;
  const angle = angleOf(delta);
  const stepped = Math.round(angle / ANGLE_STEP) * ANGLE_STEP;
  if (Math.abs(angle - stepped) > ANGLE_TOLERANCE) return null;
  const snapped = add(from, fromAngle(stepped, roundTo(len, grid)));
  return { x: Math.round(snapped.x), y: Math.round(snapped.y) };
}
