import { add, scale, sub, type Vec } from "@/core/geometry";
import type { Wall } from "@/core/model";
import { normalize, perp } from "@/core/geometry";

// The outline of a wall as a plain rectangle, for highlights
export function wallBox(wall: Wall, grow = 0): Vec[] {
  const dir = normalize(sub(wall.b, wall.a));
  const n = scale(perp(dir), wall.thickness / 2 + grow);
  return [add(wall.a, n), add(wall.b, n), sub(wall.b, n), sub(wall.a, n)];
}
