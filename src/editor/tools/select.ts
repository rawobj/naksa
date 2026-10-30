import type { Tool } from "./types";

// Picking and moving things comes later, for now it just leaves the plan alone
export function selectTool(): Tool {
  return {
    cursor: "default",
    hint: () => "Pick the wall tool to start drawing.",
  };
}
