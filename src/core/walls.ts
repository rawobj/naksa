import {
  add,
  almostEqual,
  angleOf,
  distance,
  intersectLines,
  normalize,
  perp,
  projectOnSegment,
  scale,
  sub,
  type Vec,
} from "./geometry";
import type { Opening, Plan, Wall } from "./model";

// Two wall ends closer than this are treated as the same corner
export const JOIN_TOLERANCE = 1;

export const wallLength = (wall: Wall): number => distance(wall.a, wall.b);
export const wallDirection = (wall: Wall): Vec =>
  normalize(sub(wall.b, wall.a));

// The point on the centreline at a distance from a
export const pointAlong = (wall: Wall, offset: number): Vec =>
  add(wall.a, scale(wallDirection(wall), offset));

type EndCorners = {
  left: Vec;
  right: Vec;
};

type Spoke = {
  wall: Wall;
  out: Vec; // unit vector pointing away from the shared corner
  angle: number;
};

// Corner points for one end of a wall, mitred against the other walls meeting at that end.
// "left" and "right" are as seen walking from a to b.
function endCorners(
  wall: Wall,
  end: "a" | "b",
  walls: readonly Wall[]
): EndCorners {
  const node = wall[end];
  const dir = wallDirection(wall);
  const half = wall.thickness / 2;
  const left = perp(dir);
  const square: EndCorners = {
    left: add(node, scale(left, half)),
    right: add(node, scale(left, -half)),
  };

  // Collect every wall meeting at this end as a spoke pointing away from the corner
  const spokes: Spoke[] = [];
  for (const other of walls) {
    if (wallLength(other) < JOIN_TOLERANCE) continue;
    for (const otherEnd of ["a", "b"] as const) {
      if (!almostEqual(other[otherEnd], node, JOIN_TOLERANCE)) continue;
      const d = wallDirection(other);
      const out = otherEnd === "a" ? d : scale(d, -1);
      spokes.push({ wall: other, out, angle: angleOf(out) });
    }
  }
  // A free end is just cut square
  if (spokes.length < 2) return square;

  // Sort the spokes by angle, so the neighbours on each side are the ones before and after this wall
  spokes.sort((p, q) => p.angle - q.angle);
  const self = spokes.findIndex((s) => s.wall.id === wall.id);
  if (self < 0) return square;
  const next = spokes[(self + 1) % spokes.length]!;
  const prev = spokes[(self + spokes.length - 1) % spokes.length]!;
  const me = spokes[self]!;

  // Looking outward along a spoke, perp(out) is its left side.
  // The gap towards the next spoke (clockwise on screen) is on this spoke's right.
  // Each corner point is where this wall's face line meets the neighbour's face line.
  const edge = (spoke: Spoke, side: 1 | -1) => ({
    p: add(node, scale(perp(spoke.out), (side * spoke.wall.thickness) / 2)),
    d: spoke.out,
  });
  // Very sharp angles shoot the mitre far away, so fall back to a square end past this
  const limit =
    Math.max(wall.thickness, next.wall.thickness, prev.wall.thickness) * 3;
  const meet = (mine: 1 | -1, neighbour: Spoke): Vec => {
    const m = edge(me, mine);
    const o = edge(neighbour, mine === 1 ? -1 : 1);
    const hit = intersectLines(m.p, m.d, o.p, o.d);
    return hit && distance(hit, node) <= limit ? hit : m.p;
  };
  const outRight = meet(-1, next);
  const outLeft = meet(1, prev);

  // Convert from the outward-facing frame back to the wall's a-to-b frame
  return end === "a"
    ? { left: outLeft, right: outRight }
    : { left: outRight, right: outLeft };
}

export type WallSolid = {
  wallId: string;
  points: Vec[]; // a closed outline of one solid stretch of wall, between openings
};

// Openings on a wall, clamped to its length and sorted from a
export function openingsOn(
  wall: Wall,
  openings: readonly Opening[]
): Opening[] {
  return openings
    .filter((o) => o.wallId === wall.id)
    .sort((p, q) => p.offset - q.offset);
}

// The solid parts of every wall as polygons, mitred at corners and broken where a door or window cuts through
export function wallSolids(
  plan: Pick<Plan, "walls" | "openings">
): WallSolid[] {
  const solids: WallSolid[] = [];
  for (const wall of plan.walls) {
    const len = wallLength(wall);
    if (len < JOIN_TOLERANCE) continue;
    const dir = wallDirection(wall);
    const left = scale(perp(dir), wall.thickness / 2);
    const start = endCorners(wall, "a", plan.walls);
    const finish = endCorners(wall, "b", plan.walls);

    const gaps = openingsOn(wall, plan.openings).map((o) => ({
      from: Math.max(0, o.offset - o.width / 2),
      to: Math.min(len, o.offset + o.width / 2),
    }));
    // Walk along the wall and keep the parts between the openings
    let cursor = 0;
    const stretches: { from: number; to: number }[] = [];
    for (const gap of gaps) {
      if (gap.from > cursor) stretches.push({ from: cursor, to: gap.from });
      cursor = Math.max(cursor, gap.to);
    }
    if (cursor < len) stretches.push({ from: cursor, to: len });

    // Only the stretches touching an end of the wall get the mitred corners
    for (const s of stretches) {
      const p0 = add(wall.a, scale(dir, s.from));
      const p1 = add(wall.a, scale(dir, s.to));
      const points =
        s.from === 0 && s.to === len
          ? [start.left, wall.a, start.right, finish.right, wall.b, finish.left]
          : s.from === 0
            ? [start.left, wall.a, start.right, sub(p1, left), add(p1, left)]
            : s.to === len
              ? [
                  add(p0, left),
                  sub(p0, left),
                  finish.right,
                  wall.b,
                  finish.left,
                ]
              : [add(p0, left), sub(p0, left), sub(p1, left), add(p1, left)];
      solids.push({ wallId: wall.id, points });
    }
  }
  return solids;
}

export type WallHit = {
  wall: Wall;
  point: Vec; // closest point on the centreline
  offset: number; // distance along the wall from a
  distance: number;
};

// The wall whose centreline is nearest to a point
export function nearestWall(
  point: Vec,
  walls: readonly Wall[],
  maxDistance = Infinity
): WallHit | null {
  let best: WallHit | null = null;
  for (const wall of walls) {
    const hit = projectOnSegment(point, wall.a, wall.b);
    if (hit.distance > maxDistance) continue;
    if (!best || hit.distance < best.distance) {
      best = {
        wall,
        point: hit.point,
        offset: hit.t * wallLength(wall),
        distance: hit.distance,
      };
    }
  }
  return best;
}
