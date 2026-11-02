"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { removeFrom, setWallLength, updateIn } from "@/core/edit";
import { wallLength } from "@/core/walls";
import { Icon } from "../icons";
import {
  commitAtom,
  LISTS,
  planAtom,
  selectionAtom,
  wallThicknessAtom,
} from "../editor-atoms";
import { NumberField, panel } from "./field";

// Properties of whatever is selected, or a summary of the plan when nothing is
export default function Inspector() {
  const plan = useAtomValue(planAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const [wallThickness, setWallThickness] = useAtom(wallThicknessAtom);
  const commit = useSetAtom(commitAtom);

  const remove = () => {
    if (!selection) return;
    commit((p) => removeFrom(p, LISTS[selection.type], selection.id));
    setSelection(null);
  };
  const removeButton = (what: string) => (
    <button
      className="mt-[22px] flex h-9 w-full items-center justify-center gap-[7px] rounded-small px-2.5 font-semibold text-danger shadow-[inset_0_0_0_1px_var(--line-strong)] transition-[background] duration-150 ease-naksa hover:bg-[#f8e9e6] hover:shadow-[inset_0_0_0_1px_#e3b6b0]"
      onClick={remove}
    >
      <Icon name="trash" size={17} />
      Delete {what}
    </button>
  );

  // Wall selected
  if (selection?.type === "wall") {
    const wall = plan.walls.find((w) => w.id === selection.id);
    if (wall) {
      return (
        <div className={panel.body}>
          <h2 className={panel.title}>Wall</h2>
          <NumberField
            label="Length"
            value={wallLength(wall)}
            min={100}
            onCommit={(v) => commit((p) => setWallLength(p, wall.id, v))}
          />
          <NumberField
            label="Thickness"
            value={wall.thickness}
            min={50}
            max={600}
            step={5}
            onCommit={(v) =>
              commit((p) => updateIn(p, "walls", wall.id, { thickness: v }))
            }
          />
          <NumberField
            label="Height"
            value={wall.height}
            min={300}
            max={6000}
            onCommit={(v) =>
              commit((p) => updateIn(p, "walls", wall.id, { height: v }))
            }
          />
          <p className={panel.help}>
            Drag either end on the plan to reshape it. Joined walls follow.
          </p>
          {removeButton("wall")}
        </div>
      );
    }
  }

  // Nothing selected: the thickness given to new walls
  return (
    <div className={panel.body}>
      <h2 className={panel.title}>Plan</h2>
      <p className={panel.help}>Select anything on the plan to edit it.</p>

      <h3 className={panel.heading}>New walls</h3>
      <div
        className="flex rounded-big bg-tile p-[3px]"
        role="group"
        aria-label="Thickness of new walls"
      >
        {[
          { value: 230, label: "Outer, 230 mm" },
          { value: 115, label: "Inner, 115 mm" },
        ].map((option) => (
          <button
            key={option.value}
            className="h-8 flex-1 rounded-small text-xs font-semibold text-muted transition-[background,color] duration-150 ease-naksa aria-pressed:bg-navy aria-pressed:text-on-navy"
            aria-pressed={wallThickness === option.value}
            onClick={() => setWallThickness(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
