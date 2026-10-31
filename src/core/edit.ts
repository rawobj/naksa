import { produce } from "immer";
import { add, almostEqual, type Vec } from "./geometry";
import type { Id, Plan } from "./model";
import { JOIN_TOLERANCE } from "./walls";

// Every edit here takes a plan and returns a new one, it never changes the old plan.
// Immer's produce lets us write the change as if we were mutating, and it copies only what changed.
// Parts that didn't change are shared, which is what makes undo cheap (see store.ts).
// If nothing actually changed produce returns the same plan, so no empty undo step is made.

type ListKey =
  "walls" | "openings" | "items" | "dimensions" | "labels" | "rooms";

type Entry = { id: Id };

export function updateIn<K extends ListKey>(
  plan: Plan,
  key: K,
  id: Id,
  patch: Partial<Plan[K][number]>
): Plan {
  return produce(plan, (draft) => {
    const entry = (draft[key] as Entry[]).find((e) => e.id === id);
    if (entry) Object.assign(entry, patch);
  });
}

export function addTo<K extends ListKey>(
  plan: Plan,
  key: K,
  entry: Plan[K][number]
): Plan {
  return produce(plan, (draft) => {
    (draft[key] as Entry[]).push(entry);
  });
}

export function removeFrom(plan: Plan, key: ListKey, id: Id): Plan {
  return produce(plan, (draft) => {
    const list = draft[key] as Entry[];
    const at = list.findIndex((e) => e.id === id);
    if (at >= 0) list.splice(at, 1);
  });
}

// Moves every wall end sitting at "from" to "to", so joined corners stay joined
export function moveCorner(plan: Plan, from: Vec, to: Vec): Plan {
  return produce(plan, (draft) => {
    for (const wall of draft.walls) {
      if (almostEqual(wall.a, from, JOIN_TOLERANCE)) wall.a = to;
      if (almostEqual(wall.b, from, JOIN_TOLERANCE)) wall.b = to;
    }
  });
}

// Slides a wall sideways, dragging the corners it shares along with it
export function translateWall(plan: Plan, id: Id, delta: Vec): Plan {
  const wall = plan.walls.find((w) => w.id === id);
  if (!wall) return plan;
  const a = add(wall.a, delta);
  const b = add(wall.b, delta);
  return moveCorner(moveCorner(plan, wall.a, a), wall.b, b);
}
