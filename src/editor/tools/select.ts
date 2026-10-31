import {
  beginGestureAtom,
  cancelGestureAtom,
  endGestureAtom,
  planAtom,
  previewAtom,
  selectionAtom,
} from "../editor-atoms";
import { distance, roundTo, type Vec } from "@/core/geometry";
import { moveCorner, translateWall } from "@/core/edit";
import { handle, readout } from "../overlay";
import { hitTest, near } from "../hit";
import { sceneFor } from "../render/scene";
import type { Pointer, Tool, ToolHost } from "./types";
import { wallLength } from "@/core/walls";

type Drag =
  | { kind: "corner"; from: Vec; anchor: Vec; wallIds: Set<string> }
  | { kind: "wall"; id: string; start: Vec };

const HANDLE = 9;

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

      const hit = hitTest(sceneFor(plan), p.world, host.toWorld(5));
      host.store.set(selectionAtom, hit);
      if (!hit) return;
      begin({ kind: "wall", id: hit.id, start: p.world }, host);
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
      }
    },
  };
}
