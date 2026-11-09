"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "jotai";
import { removeFrom, updateIn } from "@/core/edit";
import { emptyPlan, type Plan } from "@/core/model";
import { PlanFileError } from "@/core/serialize";
import { downloadPlan, loadSaved, pickPlanFile, saveLocal } from "./files";
import SidePanel from "./panels/side-panel";
import StatusBar from "./panels/status-bar";
import Toolbox from "./panels/toolbox";
import ToolRail, { TOOLS } from "./panels/tool-rail";
import TopBar from "./panels/top-bar";
import PlanCanvas, { isTyping } from "./plan-canvas";
import { snapPoint } from "./snap";
import {
  commitAtom,
  fitRequestAtom,
  LISTS,
  loadAtom,
  pendingItemAtom,
  planAtom,
  redoAtom,
  redrawAtom,
  selectionAtom,
  snappingAtom,
  toolAtom,
  undoAtom,
  viewportAtom,
  type EntityType,
} from "./editor-atoms";
import { createTools, type ToolHost } from "./tools";
import { zoomAt } from "./viewport";
import { cn } from "@/lib/utils";

// Grid layout. Below 960px the side panel moves under the drawing,
// on a phone the tools run across the top and the furniture list is dropped.
const layout = cn(
  "grid h-dvh",
  "grid-cols-[var(--rail)_var(--toolbox)_minmax(0,1fr)_var(--side)] grid-rows-[var(--bar)_minmax(0,1fr)]",
  "[grid-template-areas:'bar_bar_bar_bar'_'rail_toolbox_stage_side']",
  "max-[1180px]:[--side:264px] max-[1180px]:[--toolbox:172px]",
  "max-[960px]:[--toolbox:150px] max-[960px]:grid-cols-[var(--rail)_var(--toolbox)_minmax(0,1fr)] max-[960px]:grid-rows-[var(--bar)_minmax(0,1fr)_minmax(0,34dvh)]",
  "max-[960px]:[grid-template-areas:'bar_bar_bar'_'rail_toolbox_stage'_'side_side_side']",
  "max-[720px]:grid-cols-[minmax(0,1fr)] max-[720px]:grid-rows-[var(--bar)_auto_minmax(0,1fr)_minmax(0,32dvh)]",
  "max-[720px]:[grid-template-areas:'bar'_'rail'_'stage'_'side']"
);

export default function Editor() {
  // The jotai store from <Providers>, the tools and the canvas use it outside of React
  const store = useStore();
  const tools = useMemo(() => createTools(), []);
  const stageRef = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState("");

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

  // Shows a message at the bottom for 4 seconds
  const say = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(
      () => setNotice((current) => (current === message ? "" : current)),
      4000
    );
  }, []);

  const replacePlan = useCallback(
    (plan: Plan) => {
      store.set(commitAtom, plan);
      store.set(selectionAtom, null);
      store.set(toolAtom, "select");
      store.set(pendingItemAtom, null);
      store.set(fitRequestAtom, (n) => n + 1);
    },
    [store]
  );

  // Restore the last plan, then keep saving it as it changes
  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      store.set(loadAtom, saved);
      store.set(fitRequestAtom, (n) => n + 1);
    }

    // Save 400ms after the last change, not on every single edit
    let timer = 0;
    const unsubscribe = store.sub(planAtom, () => {
      const plan = store.get(planAtom);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => saveLocal(plan), 400);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [store]);

  const open = useCallback(async () => {
    try {
      const plan = await pickPlanFile();
      if (plan) {
        replacePlan(plan);
        say(`Opened “${plan.name}”.`);
      }
    } catch (error) {
      say(
        error instanceof PlanFileError
          ? `${error.message} Choose a file saved from Naksa.`
          : "That file could not be read."
      );
    }
  }, [replacePlan, say]);

  const save = useCallback(() => {
    downloadPlan(store.get(planAtom));
    say("Plan file saved to your downloads.");
  }, [store, say]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const plan = store.get(planAtom);
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Save and open work everywhere, even while typing in a field
      if (mod && key === "s") {
        e.preventDefault();
        return save();
      }
      if (mod && key === "o") {
        e.preventDefault();
        return void open();
      }
      // Everything else is ignored while typing or when a dialog is open
      if (isTyping(e.target) || document.querySelector("dialog[open]")) return;
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
        if (!active.cancel?.(host)) {
          store.set(toolAtom, "select");
          store.set(pendingItemAtom, null);
        } else store.set(redrawAtom, (n) => n + 1);
        return;
      }

      // Selection shortcuts: delete, rotate (R), nudge (arrows), flip door (F)
      const sel = store.get(selectionAtom);
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        sel &&
        sel.type !== "room"
      ) {
        e.preventDefault();
        store.set(commitAtom, (p) =>
          removeFrom(p, LISTS[sel.type as Exclude<EntityType, "room">], sel.id)
        );
        store.set(selectionAtom, null);
        return;
      }
      if (sel?.type === "item") {
        const item = plan.items.find((i) => i.id === sel.id);
        if (item && key === "r") {
          return store.set(commitAtom, (p) =>
            updateIn(p, "items", item.id, {
              rotation: (item.rotation + 90) % 360,
            })
          );
        }
        const nudge: Record<string, [number, number]> = {
          ArrowLeft: [-50, 0],
          ArrowRight: [50, 0],
          ArrowUp: [0, -50],
          ArrowDown: [0, 50],
        };
        const by = nudge[e.key];
        if (item && by) {
          e.preventDefault();
          const k = e.shiftKey ? 10 : 1;
          return store.set(commitAtom, (p) =>
            updateIn(p, "items", item.id, {
              position: {
                x: item.position.x + by[0] * k,
                y: item.position.y + by[1] * k,
              },
            })
          );
        }
      }
      if (sel?.type === "opening" && key === "f") {
        const o = plan.openings.find((x) => x.id === sel.id);
        if (o?.kind === "door") {
          return store.set(commitAtom, (p) =>
            updateIn(p, "openings", o.id, {
              swing: o.swing === "left" ? "right" : "left",
            })
          );
        }
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

      // Tool letters (V, H, W, D, N, M, T)
      const picked = TOOLS.find((t) => t.key.toLowerCase() === key);
      if (picked) {
        store.set(toolAtom, picked.id);
        store.set(pendingItemAtom, null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, tools, host, save, open]);

  // Middle of the canvas for the zoom buttons, 34 is the status bar height
  const centre = useCallback(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    return { x: (rect?.width ?? 800) / 2, y: ((rect?.height ?? 600) - 34) / 2 };
  }, []);

  return (
    <div className={layout}>
      <TopBar
        onNew={() => replacePlan(emptyPlan())}
        onOpen={open}
        onSave={save}
      />
      <ToolRail />
      <Toolbox />

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

      <SidePanel />

      {/* Toast message */}
      <div
        className={cn(
          "pointer-events-none fixed bottom-[52px] left-1/2 max-w-[min(480px,calc(100vw-32px))] rounded-big bg-navy px-4 py-2.5 font-semibold text-on-navy shadow-raised",
          "transition-[opacity,transform] duration-250 ease-naksa",
          notice
            ? "[transform:translate(-50%,0)] opacity-100"
            : "[transform:translate(-50%,8px)] opacity-0"
        )}
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
    </div>
  );
}
