import { commitAtom, wallThicknessAtom } from "../editor-atoms";
import {
  add,
  angleOf,
  distance,
  normalize,
  scale,
  sub,
  type Vec,
} from "@/core/geometry";
import { addTo } from "@/core/edit";
import { makeWall } from "@/core/model";
import { wallBox } from "../hit";
import { outline, readout, snapMarker } from "../overlay";
import type { SnapResult } from "../snap";
import type { Pointer, Tool, ToolHost } from "./types";

const MIN_LENGTH = 100;

// Draws walls as a chain, each click ends one wall and starts the next.
// Typing a number while drawing sets the exact length of the current wall.
export function wallTool(): Tool {
  let from: Vec | null = null;
  let chainStart: Vec | null = null;
  let cursor: SnapResult | null = null;
  let typed = "";

  const stop = () => {
    from = null;
    chainStart = null;
    typed = "";
  };

  const target = (): Vec | null => {
    if (!from || !cursor) return null;
    if (!typed) return cursor.point;
    const len = Number(typed);
    if (!Number.isFinite(len) || len <= 0) return null;
    const dir = normalize(sub(cursor.point, from));
    if (dir.x === 0 && dir.y === 0) return null;
    const p = add(from, scale(dir, len));
    return { x: Math.round(p.x), y: Math.round(p.y) };
  };

  const place = (host: ToolHost, closes: boolean) => {
    const to = target();
    if (!from || !to || distance(from, to) < MIN_LENGTH) return;
    const wall = makeWall(from, to, host.store.get(wallThicknessAtom));
    host.store.set(commitAtom, (plan) => addTo(plan, "walls", wall));
    typed = "";
    if (closes || (chainStart && distance(to, chainStart) < 1)) stop();
    else from = to;
  };

  return {
    cursor: "crosshair",
    hint: () =>
      from
        ? "Click to place the wall. Type a length and press Enter for an exact size. Esc to finish."
        : "Click to start a wall.",

    move(p: Pointer, host: ToolHost) {
      cursor = host.snap(p.world, { from });
    },

    down(p: Pointer, host: ToolHost) {
      cursor = host.snap(p.world, { from });
      if (!from) {
        from = cursor.point;
        chainStart = cursor.point;
        return;
      }
      // Clicking on an existing wall ends the chain, clicking on empty space keeps going
      place(
        host,
        !typed &&
          (cursor.kind === "endpoint" ||
            cursor.kind === "wall" ||
            cursor.kind === "midpoint")
      );
    },

    doubleClick() {
      stop();
    },

    key(event: KeyboardEvent, host: ToolHost) {
      if (!from) return false;
      if (/^[0-9]$/.test(event.key)) {
        if (typed.length < 6) typed += event.key;
        return true;
      }
      if (event.key === "Backspace" && typed) {
        typed = typed.slice(0, -1);
        return true;
      }
      if (event.key === "Enter") {
        if (typed) place(host, false);
        else stop();
        return true;
      }
      return false;
    },

    cancel() {
      if (!from) return false;
      stop();
      return true;
    },

    overlay(ctx, o, host) {
      if (!cursor) return;
      const to = target();
      if (from && to && distance(from, to) > 1) {
        const ghost = makeWall(from, to, host.store.get(wallThicknessAtom));
        outline(ctx, o, wallBox(ghost));
        const degrees =
          Math.round(
            (((-angleOf(sub(to, from)) * 180) / Math.PI + 360) % 360) * 10
          ) / 10;
        readout(
          ctx,
          o,
          to,
          typed
            ? `${typed}▏mm`
            : `${Math.round(distance(from, to))} mm · ${degrees % 360}°`
        );
      }
      snapMarker(
        ctx,
        o,
        typed && to ? to : cursor.point,
        typed ? "angle" : cursor.kind
      );
    },
  };
}
