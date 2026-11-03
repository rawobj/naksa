import { normalize, roundTo, sub, type Vec } from "@/core/geometry";
import type { Opening, Plan, Wall } from "@/core/model";
import { nearestWall, wallLength } from "@/core/walls";
import { perp, dot } from "@/core/geometry";

// Where an opening of a given width would sit on the wall nearest a point
export function openingOnWall(
  plan: Plan,
  point: Vec,
  width: number,
  reach: number
): {
  wall: Wall;
  offset: number;
  width: number;
  swing: Opening["swing"];
} | null {
  const hit = nearestWall(point, plan.walls, reach);
  if (!hit) return null;
  const len = wallLength(hit.wall);
  if (len < 500) return null;
  const fitted = Math.min(width, len - 200);
  const offset = roundTo(
    Math.min(Math.max(hit.offset, fitted / 2 + 100), len - fitted / 2 - 100),
    10
  );
  const normal = perp(normalize(sub(hit.wall.b, hit.wall.a)));
  const swing = dot(sub(point, hit.point), normal) >= 0 ? "left" : "right";
  return { wall: hit.wall, offset, width: fitted, swing };
}
