import {
  commitAtom,
  pendingItemAtom,
  planAtom,
  selectionAtom,
} from "../editor-atoms";
import { catalogueEntry } from "@/core/catalogue";
import { addTo } from "@/core/edit";
import { newId, type Item, type Plan } from "@/core/model";
import type { Vec } from "@/core/geometry";
import { itemCorners } from "../hit";
import { outline } from "../overlay";
import { settleItem } from "./place";
import type { Pointer, Tool, ToolHost } from "./types";

// A new item of a catalogue kind, settled against walls near at
export function makeItem(
  plan: Plan,
  kind: string,
  at: Vec,
  free = false
): Item | null {
  const entry = catalogueEntry(kind);
  if (!entry) return null;
  const item: Item = {
    id: newId("i"),
    kind,
    position: at,
    rotation: 0,
    width: entry.width,
    depth: entry.depth,
  };
  return { ...item, ...settleItem(plan, item, at, free) };
}

// Stamps the furniture picked in the toolbox wherever the user clicks
export function itemTool(): Tool {
  let ghost: Item | null = null;

  const update = (p: Pointer, host: ToolHost) => {
    const plan = host.store.get(planAtom);
    const pendingItem = host.store.get(pendingItemAtom);
    ghost = pendingItem ? makeItem(plan, pendingItem, p.world, p.alt) : null;
  };

  return {
    cursor: "copy",
    hint: () =>
      "Click to place. Near a wall it turns to sit against it. Hold Alt to place freely.",
    move: update,
    down(p: Pointer, host: ToolHost) {
      update(p, host);
      if (!ghost) return;
      const item = ghost;
      host.store.set(commitAtom, (plan) => addTo(plan, "items", item));
      host.store.set(selectionAtom, { type: "item", id: item.id });
      ghost = null;
    },
    overlay(ctx, o) {
      if (ghost) outline(ctx, o, itemCorners(ghost));
    },
  };
}
