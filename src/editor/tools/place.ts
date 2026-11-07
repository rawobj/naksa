import {
  angleOf,
  normalize,
  roundTo,
  scale,
  sub,
  add,
  type Vec,
} from "@/core/geometry";
import type { Item, Opening, Plan, Wall } from "@/core/model";
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

// Positions an item under the cursor.
// Near a wall it turns its back to the wall and sits against it, otherwise it follows the 50 mm grid.
export function settleItem(
  plan: Plan,
  item: Item,
  at: Vec,
  free: boolean
): Pick<Item, "position" | "rotation"> {
  if (!free) {
    const hit = nearestWall(at, plan.walls, item.depth / 2 + 420);
    if (hit) {
      const away = sub(at, hit.point);
      const side =
        Math.hypot(away.x, away.y) < 1
          ? perp(normalize(sub(hit.wall.b, hit.wall.a)))
          : normalize(away);
      const gap = hit.wall.thickness / 2 + item.depth / 2;
      const position = add(hit.point, scale(side, gap));
      const rotation = roundTo((angleOf(side) * 180) / Math.PI - 90, 1);
      return {
        position: { x: Math.round(position.x), y: Math.round(position.y) },
        rotation: ((rotation % 360) + 360) % 360,
      };
    }
  }
  return {
    position: { x: roundTo(at.x, 50), y: roundTo(at.y, 50) },
    rotation: item.rotation,
  };
}
