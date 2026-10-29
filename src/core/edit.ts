import { produce } from "immer";
import type { Id, Plan } from "./model";

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
