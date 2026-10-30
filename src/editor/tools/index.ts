import type { ToolId } from "../editor-atoms";
import { selectTool } from "./select";
import type { Tool } from "./types";
import { wallTool } from "./wall";

const panTool = (): Tool => ({
  cursor: "grab",
  hint: () => "Drag to move around the plan. Scroll to zoom.",
});

// One instance of every tool, so each keeps its own in-progress state
export function createTools(): Record<ToolId, Tool> {
  return {
    select: selectTool(),
    pan: panTool(),
    wall: wallTool(),
  };
}

export type { Tool, ToolHost, Pointer } from "./types";
