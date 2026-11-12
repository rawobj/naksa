"use client";

import { useAtomValue, useStore } from "jotai";
import { suggest, type Suggestion } from "@/core/suggest";
import { cn } from "@/lib/utils";
import { Icon } from "../icons";
import { sceneFor } from "../render/scene";
import { planAtom, selectionAtom, toolAtom } from "../editor-atoms";
import { panel } from "./field";

// Runs the checks again whenever the plan changes
export function useSuggestions(): Suggestion[] {
  const plan = useAtomValue(planAtom);
  return suggest(plan, sceneFor(plan).rooms);
}

export default function Checks({ items }: { items: Suggestion[] }) {
  const store = useStore();

  if (items.length === 0) {
    return (
      <div className={panel.body}>
        <h2 className={panel.title}>Checks</h2>
        <p className="flex items-start gap-[9px] leading-[1.45] font-semibold text-ok [&_svg]:mt-px [&_svg]:flex-none">
          <Icon name="check" size={18} />
          Nothing to flag. Every room has a door and daylight.
        </p>
      </div>
    );
  }

  return (
    <div className={panel.body}>
      <h2 className={panel.title}>Checks</h2>
      <p className={panel.help}>
        Things worth a second look. These are prompts, not a building-code
        review.
      </p>
      <ul className="mt-3.5 space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            {/* Opening a check selects its room */}
            <button
              className="flex w-full items-start gap-2.5 rounded-small bg-tile p-2.5 text-left leading-[1.45] text-ink transition-[background] duration-150 ease-naksa hover:bg-tile-hover disabled:cursor-default disabled:hover:bg-tile"
              disabled={!item.roomKey}
              onClick={() => {
                if (!item.roomKey) return;
                store.set(selectionAtom, { type: "room", id: item.roomKey });
                store.set(toolAtom, "select");
              }}
            >
              <Icon
                name={item.level === "fix" ? "alert" : "eye"}
                size={18}
                className={cn(
                  "mt-px flex-none",
                  item.level === "fix" ? "text-danger" : "text-muted"
                )}
              />
              <span>{item.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
