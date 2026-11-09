import {
  beginGestureAtom,
  cancelGestureAtom,
  endGestureAtom,
  planAtom,
  previewAtom,
  selectionAtom,
} from "../editor-atoms";
import {
  add,
  angleOf,
  distance,
  dot,
  normalize,
  perp,
  roundTo,
  sub,
  type Vec,
} from "@/core/geometry";
import { moveCorner, translateWall, updateIn } from "@/core/edit";
import { handle, outline, readout } from "../overlay";
import { hitTest, near, rotateHandle } from "../hit";
import { sceneFor } from "../render/scene";
import type { Pointer, Tool, ToolHost } from "./types";
import { openingOnWall, settleItem } from "./place";
import { wallLength } from "@/core/walls";

type Drag =
  | { kind: "corner"; from: Vec; anchor: Vec; wallIds: Set<string> }
  | { kind: "wall"; id: string; start: Vec }
  | { kind: "opening"; id: string }
  | { kind: "item"; id: string; grab: Vec }
  | { kind: "rotate"; id: string }
  | { kind: "dimension"; id: string }
  | { kind: "label"; id: string; grab: Vec };

const HANDLE = 9;
const ROTATE_REACH = 22;

export function selectTool(): Tool {
  let drag: Drag | null = null;
  let moved = false;
  let note = "";

  const begin = (next: Drag, host: ToolHost) => {
    drag = next;
    moved = false;
    host.store.set(beginGestureAtom);
  };

  return {
    cursor: "default",
    hint: () => "Click to select. Drag to move. Drag a wall end to reshape.",

    down(p: Pointer, host: ToolHost) {
      const plan = host.store.get(planAtom);
      const sel = host.store.get(selectionAtom);
      const reach = host.toWorld(HANDLE);

      if (sel?.type === "wall") {
        const wall = plan.walls.find((w) => w.id === sel.id);
        if (wall) {
          for (const [end, other] of [
            [wall.a, wall.b],
            [wall.b, wall.a],
          ] as const) {
            if (near(p.world, end, reach)) {
              const wallIds = new Set(
                plan.walls
                  .filter(
                    (w) => distance(w.a, end) < 1 || distance(w.b, end) < 1
                  )
                  .map((w) => w.id)
              );
              begin(
                { kind: "corner", from: end, anchor: other, wallIds },
                host
              );
              return;
            }
          }
        }
      }
      if (sel?.type === "item") {
        const item = plan.items.find((i) => i.id === sel.id);
        if (
          item &&
          near(p.world, rotateHandle(item, host.toWorld(ROTATE_REACH)), reach)
        ) {
          begin({ kind: "rotate", id: item.id }, host);
          return;
        }
      }

      const hit = hitTest(sceneFor(plan), p.world, host.toWorld(5));
      host.store.set(selectionAtom, hit);
      if (!hit) return;
      if (hit.type === "wall")
        begin({ kind: "wall", id: hit.id, start: p.world }, host);
      else if (hit.type === "opening")
        begin({ kind: "opening", id: hit.id }, host);
      else if (hit.type === "dimension")
        begin({ kind: "dimension", id: hit.id }, host);
      else if (hit.type === "item") {
        const item = plan.items.find((i) => i.id === hit.id)!;
        begin(
          { kind: "item", id: hit.id, grab: sub(p.world, item.position) },
          host
        );
      } else if (hit.type === "label") {
        const label = plan.labels.find((l) => l.id === hit.id)!;
        begin(
          { kind: "label", id: hit.id, grab: sub(p.world, label.position) },
          host
        );
      }
    },

    move(p: Pointer, host: ToolHost) {
      if (!drag) return;
      const d = drag;
      moved = true;
      note = "";
      if (d.kind === "corner") {
        const target = host.snap(p.world, {
          from: d.anchor,
          ignore: d.wallIds,
        }).point;
        note = `${Math.round(distance(d.anchor, target))} mm`;
        host.store.set(previewAtom, (base) => moveCorner(base, d.from, target));
      } else if (d.kind === "wall") {
        const delta = {
          x: roundTo(p.world.x - d.start.x, 50),
          y: roundTo(p.world.y - d.start.y, 50),
        };
        host.store.set(previewAtom, (base) => translateWall(base, d.id, delta));
      } else if (d.kind === "opening") {
        host.store.set(previewAtom, (base) => {
          const opening = base.openings.find((o) => o.id === d.id);
          if (!opening) return base;
          const spot = openingOnWall(
            base,
            p.world,
            opening.width,
            host.toWorld(60) + 400
          );
          if (!spot) return base;
          return updateIn(base, "openings", d.id, {
            wallId: spot.wall.id,
            offset: spot.offset,
            width: spot.width,
            swing: opening.kind === "door" ? spot.swing : opening.swing,
          });
        });
      } else if (d.kind === "item") {
        host.store.set(previewAtom, (base) => {
          const item = base.items.find((i) => i.id === d.id);
          if (!item) return base;
          return updateIn(
            base,
            "items",
            d.id,
            settleItem(base, item, sub(p.world, d.grab), p.alt)
          );
        });
      } else if (d.kind === "rotate") {
        host.store.set(previewAtom, (base) => {
          const item = base.items.find((i) => i.id === d.id);
          if (!item) return base;
          const raw =
            (angleOf(sub(p.world, item.position)) * 180) / Math.PI - 90;
          const rotation = ((roundTo(raw, p.shift ? 1 : 15) % 360) + 360) % 360;
          note = `${rotation}°`;
          return updateIn(base, "items", d.id, { rotation });
        });
      } else if (d.kind === "dimension") {
        host.store.set(previewAtom, (base) => {
          const dim = base.dimensions.find((x) => x.id === d.id);
          if (!dim) return base;
          const normal = perp(normalize(sub(dim.b, dim.a)));
          return updateIn(base, "dimensions", d.id, {
            offset: roundTo(dot(sub(p.world, dim.a), normal), 50),
          });
        });
      } else {
        const at = sub(p.world, d.grab);
        host.store.set(previewAtom, (base) =>
          updateIn(base, "labels", d.id, {
            position: { x: roundTo(at.x, 50), y: roundTo(at.y, 50) },
          })
        );
      }
    },

    up(_p: Pointer, host: ToolHost) {
      if (!drag) return;
      if (moved) host.store.set(endGestureAtom);
      else host.store.set(cancelGestureAtom);
      drag = null;
      note = "";
    },

    cancel(host: ToolHost) {
      if (drag) {
        host.store.set(cancelGestureAtom);
        drag = null;
        return true;
      }
      if (host.store.get(selectionAtom)) {
        host.store.set(selectionAtom, null);
        return true;
      }
      return false;
    },

    overlay(ctx, o, host) {
      const plan = host.store.get(planAtom);
      const selection = host.store.get(selectionAtom);
      if (selection?.type === "wall") {
        const wall = plan.walls.find((w) => w.id === selection.id);
        if (wall) {
          handle(ctx, o, wall.a);
          handle(ctx, o, wall.b);
          if (drag?.kind === "corner" && note)
            readout(ctx, o, drag.from === wall.a ? wall.a : wall.b, note);
          else if (drag?.kind === "wall")
            readout(ctx, o, wall.b, `${Math.round(wallLength(wall))} mm`);
        }
      } else if (selection?.type === "item") {
        const item = plan.items.find((i) => i.id === selection.id);
        if (item) {
          const grip = rotateHandle(item, host.toWorld(ROTATE_REACH));
          const front = rotateHandle(item, 0);
          outline(ctx, o, [front, grip, grip], false);
          handle(ctx, o, grip, 5.5);
          if (drag?.kind === "rotate" && note)
            readout(ctx, o, add(grip, { x: 0, y: 0 }), note);
        }
      }
    },
  };
}
