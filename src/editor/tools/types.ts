import type { Vec } from "@/core/geometry";
import type { DrawOptions } from "../render/draw";
import type { SnapOptions, SnapResult } from "../snap";
import type { Store } from "jotai";

export type Pointer = {
  world: Vec; // cursor position in plan millimetres
  screen: Vec; // cursor position in canvas CSS pixels
  shift: boolean;
  alt: boolean;
};

// What a tool can ask of the canvas it is running on
export type ToolHost = {
  store: Store; // the jotai store, tools read and write atoms through it
  // Snaps a world point using the current plan and zoom
  snap(
    world: Vec,
    options?: Partial<Pick<SnapOptions, "from" | "ignore">>
  ): SnapResult;
  // Converts a length in screen pixels to millimetres at the current zoom
  toWorld(pixels: number): number;
};

export type Tool = {
  cursor: string; // cSS cursor shown over the canvas
  // One line telling the user what to do next
  hint(): string;
  down?(pointer: Pointer, host: ToolHost): void;
  move?(pointer: Pointer, host: ToolHost): void;
  up?(pointer: Pointer, host: ToolHost): void;
  doubleClick?(pointer: Pointer, host: ToolHost): void;
  // Returns true when the key was handled
  key?(event: KeyboardEvent, host: ToolHost): boolean;
  // Abandons whatever is in progress. Returns false if nothing was.
  cancel?(host: ToolHost): boolean;
  // Draws tool feedback over the plan, in screen space
  overlay?(
    ctx: CanvasRenderingContext2D,
    options: DrawOptions,
    host: ToolHost
  ): void;
};
