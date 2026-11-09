import { commitAtom, selectionAtom, toolAtom } from "../editor-atoms";
import { addTo } from "@/core/edit";
import { roundTo } from "@/core/geometry";
import { newId } from "@/core/model";
import type { Pointer, Tool, ToolHost } from "./types";

// Drops a note on the plan and hands over to the select tool to edit it
export function textTool(): Tool {
  return {
    cursor: "text",
    hint: () =>
      "Click where the note should go, then type it in the properties panel.",
    down(p: Pointer, host: ToolHost) {
      const label = {
        id: newId("t"),
        position: { x: roundTo(p.world.x, 50), y: roundTo(p.world.y, 50) },
        text: "Note",
      };
      host.store.set(commitAtom, (plan) => addTo(plan, "labels", label));
      host.store.set(selectionAtom, { type: "label", id: label.id });
      host.store.set(toolAtom, "select");
    },
  };
}
