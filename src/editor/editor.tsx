"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStore } from "jotai";
import StatusBar from "./panels/status-bar";
import ToolRail, { TOOLS } from "./panels/tool-rail";
import TopBar from "./panels/top-bar";
import PlanCanvas, { isTyping } from "./plan-canvas";
import { snapPoint } from "./snap";
import {
  fitRequestAtom,
  planAtom,
  redoAtom,
  redrawAtom,
  snappingAtom,
  toolAtom,
  undoAtom,
  viewportAtom,
} from "./editor-atoms";
import { createTools, type ToolHost } from "./tools";
import { zoomAt } from "./viewport";
import { cn } from "@/lib/utils";

// Grid layout. On a phone the tools run across the top.
const layout = cn(
  "grid h-dvh",
  "grid-cols-[var(--rail)_minmax(0,1fr)] grid-rows-[var(--bar)_minmax(0,1fr)]",
  "[grid-template-areas:'bar_bar'_'rail_stage']",
  "max-[720px]:grid-cols-[minmax(0,1fr)] max-[720px]:grid-rows-[var(--bar)_auto_minmax(0,1fr)]",
  "max-[720px]:[grid-template-areas:'bar'_'rail'_'stage']"
);

export default function Editor() {
  // The jotai store from <Providers>, the tools and the canvas use it outside of React
  const store = useStore();
  const tools = useMemo(() => createTools(), []);
  const stageRef = useRef<HTMLDivElement>(null);

  // What the tools can use from the canvas (snapping at the current zoom, px to mm)
  const host = useMemo<ToolHost>(
    () => ({
      store,
      snap: (world, options) => {
        return snapPoint(world, {
          walls: store.get(planAtom).walls,
          radius: 12 / store.get(viewportAtom).zoom, // 12px on screen, whatever the zoom
          grid: 50,
          enabled: store.get(snappingAtom),
          ...options,
        });
      },
      toWorld: (pixels) => pixels / store.get(viewportAtom).zoom,
    }),
    [store]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Shortcuts are ignored while typing in a field
      if (isTyping(e.target)) return;
      if (mod && key === "z") {
        e.preventDefault();
        return store.set(e.shiftKey ? redoAtom : undoAtom);
      }
      if (mod && key === "y") {
        e.preventDefault();
        return store.set(redoAtom);
      }
      if (mod || e.altKey) return;

      // The active tool gets the key first (the wall tool uses numbers for typed lengths)
      const active = tools[store.get(toolAtom)];
      if (active.key?.(e, host)) {
        e.preventDefault();
        store.set(redrawAtom, (n) => n + 1);
        return;
      }
      if (e.key === "Escape") {
        if (!active.cancel?.(host)) store.set(toolAtom, "select");
        else store.set(redrawAtom, (n) => n + 1);
        return;
      }

      // Zoom around the middle of the canvas
      const centre = () => {
        const rect = stageRef.current?.getBoundingClientRect();
        return { x: (rect?.width ?? 800) / 2, y: (rect?.height ?? 600) / 2 };
      };
      const viewport = store.get(viewportAtom);
      if (e.key === "0") return store.set(fitRequestAtom, (n) => n + 1);
      if (e.key === "+" || e.key === "=")
        return store.set(viewportAtom, zoomAt(viewport, centre(), 1.25));
      if (e.key === "-")
        return store.set(viewportAtom, zoomAt(viewport, centre(), 0.8));

      // Tool letters (V, H, W)
      const picked = TOOLS.find((t) => t.key.toLowerCase() === key);
      if (picked) store.set(toolAtom, picked.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, tools, host]);

  // Middle of the canvas for the zoom buttons, 34 is the status bar height
  const centre = useCallback(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    return { x: (rect?.width ?? 800) / 2, y: ((rect?.height ?? 600) - 34) / 2 };
  }, []);

  return (
    <div className={layout}>
      <TopBar />
      <ToolRail />

      {/* Canvas in the middle */}
      <main
        className="flex min-h-0 min-w-0 flex-col [grid-area:stage]"
        ref={stageRef}
      >
        <div className="relative flex min-h-0 flex-1">
          <PlanCanvas tools={tools} host={host} />
        </div>
        <StatusBar tools={tools} centre={centre} />
      </main>
    </div>
  );
}
