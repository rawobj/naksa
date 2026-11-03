import { commitAtom, planAtom, selectionAtom } from "../editor-atoms";
import { addTo } from "@/core/edit";
import { DEFAULTS, makeOpening, type OpeningKind } from "@/core/model";
import { openingBox } from "../hit";
import { outline, readout } from "../overlay";
import { openingOnWall } from "./place";
import type { Pointer, Tool, ToolHost } from "./types";

// Places a door or window on whichever wall is under the cursor
export function openingTool(kind: OpeningKind): Tool {
  const width = kind === "door" ? DEFAULTS.doorWidth : DEFAULTS.windowWidth;
  let spot: ReturnType<typeof openingOnWall> = null;

  const find = (p: Pointer, host: ToolHost) => {
    spot = openingOnWall(
      host.store.get(planAtom),
      p.world,
      width,
      host.toWorld(36) + 200
    );
  };

  return {
    cursor: "copy",
    hint: () =>
      kind === "door"
        ? "Click a wall to place a door. It opens towards the side your cursor is on."
        : "Click a wall to place a window.",

    move: find,

    down(p: Pointer, host: ToolHost) {
      find(p, host);
      if (!spot) return;
      const opening = {
        ...makeOpening(kind, spot.wall.id, spot.offset, spot.width),
        swing: spot.swing,
      };
      host.store.set(commitAtom, (plan) => addTo(plan, "openings", opening));
      host.store.set(selectionAtom, { type: "opening", id: opening.id });
    },

    overlay(ctx, o) {
      if (!spot) return;
      const ghost = makeOpening(kind, spot.wall.id, spot.offset, spot.width);
      const box = openingBox(ghost, spot.wall, 20);
      outline(ctx, o, box);
      readout(ctx, o, box[1]!, `${spot.width} mm wide`);
    },
  };
}
