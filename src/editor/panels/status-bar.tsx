"use client";

import { useAtomValue, useStore } from "jotai";
import { Icon } from "../icons";
import {
  cursorAtom,
  fitRequestAtom,
  viewportAtom,
  zoomAtom,
} from "../editor-atoms";
import { zoomAt } from "../viewport";

type StatusBarProps = {
  // Centre of the canvas in its own pixels, used as the zoom anchor
  centre(): { x: number; y: number };
};

// Small buttons in the bar
const small =
  "flex items-center h-[26px] gap-[5px] rounded-[6px] px-[7px] text-[12px] font-semibold text-muted transition-[background,color] duration-150 ease-naksa hover:bg-tile hover:text-ink";

// Bottom bar: cursor position and zoom
export default function StatusBar({ centre }: StatusBarProps) {
  const store = useStore();
  const cursor = useAtomValue(cursorAtom);
  const zoom = useAtomValue(zoomAtom);

  const step = (factor: number) =>
    store.set(viewportAtom, zoomAt(store.get(viewportAtom), centre(), factor));

  return (
    <footer className="flex h-(--status) items-center gap-3.5 border-t border-line bg-paper pr-1.5 pl-3.5 text-xs text-muted">
      <span className="min-w-[150px] flex-1 whitespace-pre max-[1100px]:invisible">
        {cursor ? `X ${cursor.x}  Y ${cursor.y} mm` : ""}
      </span>

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
