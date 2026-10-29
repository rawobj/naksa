import { boundsOf, signedArea, type Bounds, type Vec } from "@/core/geometry";
import type { Plan } from "@/core/model";
import { wallSolids } from "@/core/walls";

// Everything the drawing needs that is worked out from the plan.
// Cached per plan object, and since plans are never changed in place the cache is always right.
export type Scene = {
  plan: Plan;
  solids: Vec[][]; // solid wall outlines, all wound the same way so they can be unioned
  bounds: Bounds | null;
};

const cache = new WeakMap<Plan, Scene>();

export function sceneFor(plan: Plan): Scene {
  const hit = cache.get(plan);
  if (hit) return hit;
  const solids = wallSolids(plan).map((solid) =>
    signedArea(solid.points) < 0 ? [...solid.points].reverse() : solid.points
  );
  const scene: Scene = {
    plan,
    solids,
    bounds: boundsOf(solids.flat()),
  };
  cache.set(plan, scene);
  return scene;
}
