import { atom } from "jotai";
import { emptyPlan, type Plan } from "@/core/model";

export type ToolId = "select" | "pan";

// Screen position of the world origin, and pixels per millimetre
export type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

// The plan being edited
export const planAtom = atom<Plan>(emptyPlan());

export const toolAtom = atom<ToolId>("select");

export const viewportAtom = atom<Viewport>({ x: 0, y: 0, zoom: 0.05 });

// Cursor position on the plan in millimetres, when it is over the canvas
export const cursorAtom = atom<{ x: number; y: number } | null>(null);

export const fitRequestAtom = atom(0); // incremented to ask the canvas to zoom to fit the plan

// Derived values, components using these only re-render when the value itself changes
export const planNameAtom = atom((get) => get(planAtom).name);
export const zoomAtom = atom((get) => get(viewportAtom).zoom);
