import { atom } from "jotai";
import { emptyPlan, type Id, type Plan } from "@/core/model";

export type ToolId = "select" | "pan";
export type EntityType = "wall";

export type Selection = {
  type: EntityType;
  id: Id;
};

// Screen position of the world origin, and pixels per millimetre
export type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

type Edit = Plan | ((plan: Plan) => Plan);

// Plan. Only change it through the action atoms below so undo stays right.
export const planAtom = atom<Plan>(emptyPlan());

export const toolAtom = atom<ToolId>("select");

export const selectionAtom = atom<Selection | null>(null);

export const viewportAtom = atom<Viewport>({ x: 0, y: 0, zoom: 0.05 });

// Cursor position on the plan in millimetres, when it is over the canvas
export const cursorAtom = atom<{ x: number; y: number } | null>(null);

export const fitRequestAtom = atom(0); // incremented to ask the canvas to zoom to fit the plan

// Derived values, components using these only re-render when the value itself changes
export const planNameAtom = atom((get) => get(planAtom).name);
export const zoomAtom = atom((get) => get(viewportAtom).zoom);

// Undo history. A plan is never changed in place, every edit makes a new one,
// so the history is just lists of older and newer plans.
const HISTORY_LIMIT = 200;
const pastAtom = atom<Plan[]>([]);
const futureAtom = atom<Plan[]>([]);
const gestureStartAtom = atom<Plan | null>(null); // plan at the start of a drag

export const canUndoAtom = atom((get) => get(pastAtom).length > 0);
export const canRedoAtom = atom((get) => get(futureAtom).length > 0);

// Pushes a plan onto the undo list and clears redo
const pushPastAtom = atom(null, (get, set, plan: Plan) => {
  set(pastAtom, [...get(pastAtom), plan].slice(-HISTORY_LIMIT));
  set(futureAtom, []);
});

// Applies an edit as one undoable step
export const commitAtom = atom(null, (get, set, next: Edit) => {
  const current = get(planAtom);
  const plan = typeof next === "function" ? next(current) : next;
  if (plan === current) return;
  set(pushPastAtom, get(gestureStartAtom) ?? current);
  set(gestureStartAtom, null);
  set(planAtom, plan);
});

// Starts a drag, everything shown with preview until endGesture becomes one undo step
export const beginGestureAtom = atom(null, (get, set) => {
  set(gestureStartAtom, get(planAtom));
});

// Shows an in-progress edit without touching history.
// The edit is always applied to the plan from the start of the drag, so rounding never builds up.
export const previewAtom = atom(null, (get, set, next: Edit) => {
  const base = get(gestureStartAtom) ?? get(planAtom);
  set(planAtom, typeof next === "function" ? next(base) : next);
});

// Ends a drag, recording it if anything changed
export const endGestureAtom = atom(null, (get, set) => {
  const start = get(gestureStartAtom);
  set(gestureStartAtom, null);
  if (!start || start === get(planAtom)) return;
  set(pushPastAtom, start);
});

export const cancelGestureAtom = atom(null, (get, set) => {
  const start = get(gestureStartAtom);
  set(gestureStartAtom, null);
  if (start) set(planAtom, start);
});

export const undoAtom = atom(null, (get, set) => {
  const past = get(pastAtom);
  const previous = past[past.length - 1];
  if (!previous) return;
  set(pastAtom, past.slice(0, -1));
  set(futureAtom, [...get(futureAtom), get(planAtom)]);
  set(planAtom, previous);
  set(selectionAtom, null);
});

export const redoAtom = atom(null, (get, set) => {
  const future = get(futureAtom);
  const next = future[future.length - 1];
  if (!next) return;
  set(futureAtom, future.slice(0, -1));
  set(pastAtom, [...get(pastAtom), get(planAtom)]);
  set(planAtom, next);
  set(selectionAtom, null);
});
