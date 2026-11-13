"use client";

import { useAtomValue, useStore } from "jotai";
import { CATALOGUE, ITEM_GROUPS } from "@/core/catalogue";
import { ItemIcon } from "../icons";
import { ITEM_MIME } from "../plan-canvas";
import {
  armedItemAtom,
  is3dAtom,
  pendingItemAtom,
  selectionAtom,
  toolAtom,
} from "../editor-atoms";

// Furniture and fixtures. Drag a tile onto the plan, or click it and then click the plan.
export default function Toolbox() {
  const store = useStore();
  const pending = useAtomValue(armedItemAtom);
  const disabled = useAtomValue(is3dAtom);

  // Clicking the armed piece again puts it back down
  const pick = (kind: string) => {
    if (pending === kind) {
      store.set(toolAtom, "select");
      store.set(pendingItemAtom, null);
      return;
    }
    store.set(toolAtom, "item");
    store.set(pendingItemAtom, kind);
    store.set(selectionAtom, null);
  };

  return (
    <aside
      className="flex min-h-0 flex-col border-r border-line bg-paper [grid-area:toolbox] max-[720px]:hidden"
      aria-label="Furniture and fixtures"
    >
      <div className="border-b border-line px-4 pt-4 pb-3">
        <h2 className="text-[15px] font-bold tracking-[-0.01em]">Furnish</h2>
        <p className="mt-1 text-xs leading-[1.4] text-muted">
          Drag onto the plan, or click a piece and then click where it goes.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-5">
        {ITEM_GROUPS.map((group) => (
          <section key={group}>
            <h3 className="mx-1 mt-4 mb-2 text-xs font-bold text-muted">
              {group}
            </h3>
            <div className="grid grid-cols-3 gap-1.5 max-[1180px]:grid-cols-2">
              {CATALOGUE.filter((entry) => entry.group === group).map(
                (entry) => (
                  <button
                    key={entry.kind}
                    className="flex min-h-[76px] cursor-grab flex-col items-center justify-start gap-[5px] rounded-big bg-tile px-[3px] pt-[9px] pb-[7px] text-center text-[10.5px] leading-[1.2] font-semibold text-navy transition-[background,color,transform] duration-180 ease-naksa hover:bg-tile-hover active:scale-96 active:cursor-grabbing disabled:cursor-not-allowed disabled:text-[#9a9fa9] disabled:hover:bg-tile disabled:active:scale-100 aria-pressed:bg-brass aria-pressed:text-on-brass"
                    aria-pressed={pending === entry.kind}
                    disabled={disabled}
                    draggable={!disabled}
                    title={`${entry.label}, ${entry.width} × ${entry.depth} mm`}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(ITEM_MIME, entry.kind);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => pick(entry.kind)}
                  >
                    <ItemIcon kind={entry.kind} />
                    <span className="text-balance">{entry.label}</span>
                  </button>
                )
              )}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
