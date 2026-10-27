"use client";

import { useCallback, useEffect, useRef } from "react";
import { useStore } from "jotai";
import StatusBar from "./panels/status-bar";
import ToolRail, { TOOLS } from "./panels/tool-rail";
import TopBar from "./panels/top-bar";
import PlanCanvas, { isTyping } from "./plan-canvas";
import { fitRequestAtom, toolAtom, viewportAtom } from "./editor-atoms";
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
  // The jotai store from <Providers>, the canvas uses it outside of React
  const store = useStore();
  const stageRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Shortcuts are ignored while typing in a field
      if (isTyping(e.target)) return;
      if (mod || e.altKey) return;

      if (e.key === "Escape") return store.set(toolAtom, "select");

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

      // Tool letters (V, H)
      const picked = TOOLS.find((t) => t.key.toLowerCase() === key);
      if (picked) store.set(toolAtom, picked.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

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
          <PlanCanvas />
        </div>
        <StatusBar centre={centre} />
      </main>
    </div>
  );
}
