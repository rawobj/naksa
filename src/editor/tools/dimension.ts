import { commitAtom, selectionAtom } from "../editor-atoms";
import {
  distance,
  dot,
  normalize,
  perp,
  roundTo,
  sub,
  type Vec,
} from "@/core/geometry";
import { addTo } from "@/core/edit";
import { newId, type Dimension } from "@/core/model";
import { drawDimension } from "../render/draw";
import { INK } from "../render/theme";
import { snapMarker } from "../overlay";
import type { SnapResult } from "../snap";
import type { Pointer, Tool, ToolHost } from "./types";

// Three clicks: the two points to measure, then where the dimension line sits
export function dimensionTool(): Tool {
  let a: Vec | null = null;
  let b: Vec | null = null;
  let cursor: SnapResult | null = null;
  let raw: Vec | null = null;

  const draft = (): Dimension | null => {
    if (!a || !cursor) return null;
    if (!b) return { id: "", a, b: cursor.point, offset: 0 };
    if (!raw) return null;
    const normal = perp(normalize(sub(b, a)));
    return { id: "", a, b, offset: roundTo(dot(sub(raw, a), normal), 50) };
  };

  return {
    cursor: "crosshair",
    hint: () =>
      !a
        ? "Click the first point to measure from."
        : !b
          ? "Click the second point."
          : "Move away from the line and click to place the dimension.",

    move(p: Pointer, host: ToolHost) {
      raw = p.world;
      cursor = host.snap(p.world);
    },

    down(p: Pointer, host: ToolHost) {
      raw = p.world;
      cursor = host.snap(p.world);
      if (!a) {
        a = cursor.point;
      } else if (!b) {
        if (distance(a, cursor.point) >= 50) b = cursor.point;
      } else {
        const d = draft();
        if (d) {
          const dimension = { ...d, id: newId("m") };
          host.store.set(commitAtom, (plan) =>
            addTo(plan, "dimensions", dimension)
          );
          host.store.set(selectionAtom, {
            type: "dimension",
            id: dimension.id,
          });
        }
        a = null;
        b = null;
      }
    },

    cancel() {
      if (!a) return false;
      a = null;
      b = null;
      return true;
    },

    overlay(ctx, o) {
      const d = draft();
      if (d) {
        const font = o.fontFamily;
        drawDimension(
          ctx,
          d,
          o,
          (value, x, y, style = {}) => {
            ctx.save();
            ctx.translate(x, y);
            if (style.angle) ctx.rotate(style.angle);
            ctx.font = `600 11px ${font}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = INK.select;
            ctx.fillText(value, 0, 0);
            ctx.restore();
          },
          INK.select
        );
      }
      if (cursor && !b) snapMarker(ctx, o, cursor.point, cursor.kind);
    },
  };
}
