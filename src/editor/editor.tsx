"use client";

import { useCallback, useRef } from "react";
import StatusBar from "./panels/status-bar";
import ToolRail from "./panels/tool-rail";
import TopBar from "./panels/top-bar";
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
  const stageRef = useRef<HTMLDivElement>(null);

  // Middle of the canvas for the zoom buttons, 34 is the status bar height
  const centre = useCallback(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    return { x: (rect?.width ?? 800) / 2, y: ((rect?.height ?? 600) - 34) / 2 };
  }, []);

  return (
    <div className={layout}>
      <TopBar />
      <ToolRail />

      {/* Drawing area in the middle */}
      <main
        className="flex min-h-0 min-w-0 flex-col [grid-area:stage]"
        ref={stageRef}
      >
        <div className="relative flex min-h-0 flex-1 bg-paper" />
        <StatusBar centre={centre} />
      </main>
    </div>
  );
}
