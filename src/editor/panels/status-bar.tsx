"use client";

import { useAtom, useAtomValue, useStore } from "jotai";
import { Icon } from "../icons";
import {
  cursorAtom,
  fitRequestAtom,
  snappingAtom,
  toolAtom,
  viewportAtom,
  zoomAtom,
} from "../editor-atoms";
import type { Tool } from "../tools";
import { zoomAt } from "../viewport";

type StatusBarProps = {
  tools: Record<string, Tool>;
  // Centre of the canvas in its own pixels, used as the zoom anchor
  centre(): { x: number; y: number };
};

// Small buttons in the bar
const small =
  "flex items-center h-[26px] gap-[5px] rounded-[6px] px-[7px] text-[12px] font-semibold text-muted transition-[background,color] duration-150 ease-naksa hover:bg-tile hover:text-ink";

// Bottom bar: what to do next, cursor position, snapping and zoom
export default function StatusBar({ tools, centre }: StatusBarProps) {
  const store = useStore();
  // Re-renders on every cursor move, which also keeps the tool hint up to date
  const tool = useAtomValue(toolAtom);
  const cursor = useAtomValue(cursorAtom);
  const zoom = useAtomValue(zoomAtom);
  const [snapping, setSnapping] = useAtom(snappingAtom);

  const step = (factor: number) =>
    store.set(viewportAtom, zoomAt(store.get(viewportAtom), centre(), factor));

  return (
    <footer className="flex h-(--status) items-center gap-3.5 border-t border-line bg-paper pr-1.5 pl-3.5 text-xs text-muted">
      <p className="min-w-0 flex-1 truncate max-[720px]:invisible">
        {tools[tool]?.hint()}
      </p>
      <span className="min-w-[150px] text-right whitespace-pre max-[1100px]:hidden">
        {cursor ? `X ${cursor.x}  Y ${cursor.y} mm` : ""}
      </span>

      {/* Snapping on and off */}
      <button
        className={`${small} aria-pressed:bg-navy aria-pressed:text-on-navy`}
        aria-pressed={snapping}
        onClick={() => setSnapping(!snapping)}
        title="Snap to wall ends, walls and the 50 mm grid"
      >
        <Icon name="snap" size={16} />
        Snap
      </button>

      {/* Zoom */}
      <div className="flex items-center">
        <button
          className={small}
          onClick={() => step(1 / 1.25)}
          aria-label="Zoom out"
          title="Zoom out (-)"
        >
          <Icon name="minus" size={16} />
        </button>
        <span
          className="min-w-11 text-center font-semibold text-ink"
          aria-label="Zoom level"
        >
          {Math.round(zoom * 1000)}%
        </span>
        <button
          className={small}
          onClick={() => step(1.25)}
          aria-label="Zoom in"
          title="Zoom in (+)"
        >
          <Icon name="plus" size={16} />
        </button>
        <button
          className={small}
          onClick={() => store.set(fitRequestAtom, (n) => n + 1)}
          aria-label="Fit plan to screen"
          title="Fit plan to screen (0)"
        >
          <Icon name="fit" size={16} />
        </button>
      </div>
    </footer>
  );
}
