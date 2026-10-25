import Flatten from "@flatten-js/core";

// Basic 2D maths used everywhere. All lengths are in millimetres.
// The y axis points down (same as the canvas), so "clockwise" means clockwise on screen.
// The heavier geometry (projection, intersections, area, bounds) is done by flatten-js,
// the plan itself keeps plain { x, y } objects so it stays simple JSON.

export type Vec = {
  x: number;
  y: number;
};

// Tolerance for comparing lengths, in millimetres
export const EPS = 1e-6;

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const length = (a: Vec): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec, b: Vec): number =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const midpoint = (a: Vec, b: Vec): Vec => lerp(a, b, 0.5);
export const angleOf = (a: Vec): number => Math.atan2(a.y, a.x);
export const fromAngle = (radians: number, len = 1): Vec => ({
  x: Math.cos(radians) * len,
  y: Math.sin(radians) * len,
});

export function normalize(a: Vec): Vec {
  const l = length(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

// Rotates the vector a quarter turn, which is its left hand normal in y-down space
export const perp = (a: Vec): Vec => ({ x: a.y, y: -a.x });

export function rotate(a: Vec, radians: number): Vec {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

export const almostEqual = (a: Vec, b: Vec, tolerance = 0.5): boolean =>
  Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;

export const roundTo = (value: number, step: number): number =>
  step <= 0 ? value : Math.round(value / step) * step;

export type Projection = {
  point: Vec; // closest point on the segment
  t: number; // how far along the segment, clamped to 0..1
  distance: number;
};

const toPoint = (p: Vec) => Flatten.point(p.x, p.y);

// How far along a-b a point on it is, 0 at a and 1 at b
function paramAlong(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const lenSq = dot(ab, ab);
  return lenSq < EPS ? 0 : dot(sub(p, a), ab) / lenSq;
}

// Closest point to p on the segment a-b
export function projectOnSegment(p: Vec, a: Vec, b: Vec): Projection {
  // A zero length segment is just the point a
  if (dot(sub(b, a), sub(b, a)) < EPS)
    return { point: a, t: 0, distance: distance(p, a) };

  // distanceTo gives the distance and the shortest segment, which ends on a-b
  const [dist, shortest] = toPoint(p).distanceTo(
    Flatten.segment(toPoint(a), toPoint(b))
  );
  const point = { x: shortest.end.x, y: shortest.end.y };
  const t = Math.min(1, Math.max(0, paramAlong(point, a, b)));
  return { point, t, distance: dist };
}

// Intersection of two infinite lines given as point and direction
export function intersectLines(p: Vec, d: Vec, q: Vec, e: Vec): Vec | null {
  // Parallel lines never meet
  if (Math.abs(cross(d, e)) < EPS) return null;

  // flatten-js describes a line by a point and its normal, so turn the direction a quarter
  const first = Flatten.line(
    toPoint(p),
    Flatten.vector(d.x, d.y).rotate90CCW()
  );
  const second = Flatten.line(
    toPoint(q),
    Flatten.vector(e.x, e.y).rotate90CCW()
  );
  const hit = first.intersect(second)[0];
  return hit ? { x: hit.x, y: hit.y } : null;
}

export type SegmentHit = {
  point: Vec;
  t: number; // parameter along the first segment
  u: number; // parameter along the second segment
};

// Intersection of segments a-b and c-d, ends included
export function intersectSegments(
  a: Vec,
  b: Vec,
  c: Vec,
  d: Vec
): SegmentHit | null {
  // Parallel (or overlapping) segments are treated as not crossing,
  // flatten-js would return the ends of the overlap instead
  if (Math.abs(cross(sub(b, a), sub(d, c))) < EPS) return null;

  const hit = Flatten.segment(toPoint(a), toPoint(b)).intersect(
    Flatten.segment(toPoint(c), toPoint(d))
  )[0];
  if (!hit) return null;
  const point = { x: hit.x, y: hit.y };
  return { point, t: paramAlong(point, a, b), u: paramAlong(point, c, d) };
}

// The single face of a polygon made from the points
function faceOf(points: readonly Vec[]) {
  return [...new Flatten.Polygon(points.map(toPoint)).faces][0]!;
}

// Shoelace formula. Positive when the points run clockwise on screen.
export function signedArea(points: readonly Vec[]): number {
  if (points.length < 3) return 0;
  // flatten-js works with y up, so its sign is the opposite of ours
  return -faceOf(points).signedArea();
}

export const polygonArea = (points: readonly Vec[]): number =>
  points.length < 3 ? 0 : new Flatten.Polygon(points.map(toPoint)).area();

export const polygonPerimeter = (points: readonly Vec[]): number =>
  points.length < 2 ? 0 : faceOf(points).perimeter;

// Area weighted centroid. Falls back to the average of the points for a flat polygon.
export function polygonCentroid(points: readonly Vec[]): Vec {
  const area = signedArea(points);
  if (Math.abs(area) < EPS) {
    const n = Math.max(1, points.length);
    return scale(points.reduce(add, vec(0, 0)), 1 / n);
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    const k = cross(p, q);
    cx += (p.x + q.x) * k;
    cy += (p.y + q.y) * k;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

// Ray casting: shoot a ray to the right and count how many edges it crosses, odd means inside
export function pointInPolygon(p: Vec, points: readonly Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    const crosses = a.y > p.y !== b.y > p.y;
    if (crosses && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function boundsOf(points: readonly Vec[]): Bounds | null {
  if (points.length === 0) return null;
  // Merge a zero size box for every point
  const box = points.reduce(
    (all, p) => all.merge(new Flatten.Box(p.x, p.y, p.x, p.y)),
    new Flatten.Box()
  );
  return { minX: box.xmin, minY: box.ymin, maxX: box.xmax, maxY: box.ymax };
}

// Moves every edge of a polygon inward by its own distance and rebuilds the corners.
// insets[i] is for the edge from points[i] to points[i + 1].
// Returns null when the polygon collapses (too thin for the insets).
export function insetPolygon(
  points: readonly Vec[],
  insets: readonly number[]
): Vec[] | null {
  const n = points.length;
  if (n < 3) return null;
  const sign = signedArea(points) >= 0 ? 1 : -1;
  const lines: { p: Vec; d: Vec }[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    const d = normalize(sub(b, a));
    // For a clockwise polygon in y-down space the interior lies to the right
    const inward = scale(perp(d), -sign);
    lines.push({ p: add(a, scale(inward, insets[i] ?? 0)), d });
  }
  // New corners are where each moved edge meets the one before it
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i + n - 1) % n]!;
    const cur = lines[i]!;
    out.push(intersectLines(prev.p, prev.d, cur.p, cur.d) ?? cur.p);
  }
  // If the winding flipped the edges crossed over each other
  const area = signedArea(out);
  if (Math.abs(area) < 1 || Math.sign(area) !== sign) return null;
  return out;
}
