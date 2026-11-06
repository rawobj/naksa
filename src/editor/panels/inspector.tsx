"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { removeFrom, setWallLength, tagRoom, updateIn } from "@/core/edit";
import { polygonPerimeter } from "@/core/geometry";
import { formatArea } from "@/core/rooms";
import { wallLength } from "@/core/walls";
import { Icon } from "../icons";
import { sceneFor } from "../render/scene";
import {
  commitAtom,
  LISTS,
  planAtom,
  selectionAtom,
  toolAtom,
  wallThicknessAtom,
  type EntityType,
} from "../editor-atoms";
import { Fact, NumberField, panel, TextField } from "./field";

// Grey buttons in a row under the fields
const rowButton =
  "flex h-9 flex-1 items-center justify-center gap-[7px] rounded-small bg-tile px-2.5 font-semibold text-navy transition-[background] duration-150 ease-naksa hover:bg-tile-hover";

// Properties of whatever is selected, or a summary of the plan when nothing is
export default function Inspector() {
  const plan = useAtomValue(planAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const [wallThickness, setWallThickness] = useAtom(wallThicknessAtom);
  const setTool = useSetAtom(toolAtom);
  const commit = useSetAtom(commitAtom);
  const scene = sceneFor(plan);

  const remove = () => {
    if (!selection || selection.type === "room") return;
    commit((p) =>
      removeFrom(
        p,
        LISTS[selection.type as Exclude<EntityType, "room">],
        selection.id
      )
    );
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

  // Door or window selected
  if (selection?.type === "opening") {
    const opening = plan.openings.find((o) => o.id === selection.id);
    const wall = opening && plan.walls.find((w) => w.id === opening.wallId);
    if (opening && wall) {
      const len = wallLength(wall);
      const set = (patch: Partial<typeof opening>) =>
        commit((p) => updateIn(p, "openings", opening.id, patch));
      const door = opening.kind === "door";
      return (
        <div className={panel.body}>
          <h2 className={panel.title}>{door ? "Door" : "Window"}</h2>
          <NumberField
            label="Width"
            value={opening.width}
            min={300}
            max={Math.max(300, len - 200)}
            onCommit={(v) =>
              set({
                width: v,
                offset: Math.min(Math.max(opening.offset, v / 2), len - v / 2),
              })
            }
          />
          <NumberField
            label="Height"
            value={opening.height}
            min={300}
            max={wall.height}
            onCommit={(v) => set({ height: v })}
          />
          {!door && (
            <NumberField
              label="Sill height"
              value={opening.sill}
              min={0}
              max={wall.height - 300}
              onCommit={(v) => set({ sill: v })}
            />
          )}
          <NumberField
            label="From wall start"
            value={opening.offset - opening.width / 2}
            min={0}
            max={Math.max(0, len - opening.width)}
            onCommit={(v) => set({ offset: v + opening.width / 2 })}
          />
          {door && (
            <div className="mt-3.5 flex gap-2">
              <button
                className={rowButton}
                onClick={() =>
                  set({ hinge: opening.hinge === "start" ? "end" : "start" })
                }
              >
                <Icon name="flip" size={17} />
                Flip hinge
              </button>
              <button
                className={rowButton}
                onClick={() =>
                  set({ swing: opening.swing === "left" ? "right" : "left" })
                }
              >
                <Icon name="rotate" size={17} />
                Flip swing
              </button>
            </div>
          )}
          {removeButton(door ? "door" : "window")}
        </div>
      );
    }
  }

  // Room selected
  if (selection?.type === "room") {
    const room = scene.rooms.find((r) => r.key === selection.id);
    if (room) {
      return (
        <div className={panel.body}>
          <h2 className={panel.title}>Room</h2>
          <TextField
            label="Name"
            value={room.name}
            onChange={(name) => commit((p) => tagRoom(p, room, { name }))}
          />
          <Fact label="Floor area" value={formatArea(room.area)} />
          <Fact
            label="Perimeter"
            value={`${(polygonPerimeter(room.inner) / 1000).toFixed(2)} m`}
          />
        </div>
      );
    }
  }

  // Nothing selected: room list, total area and new wall thickness
  const total = scene.rooms.reduce((sum, room) => sum + room.area, 0);
  return (
    <div className={panel.body}>
      <h2 className={panel.title}>Plan</h2>
      {scene.rooms.length === 0 ? (
        <p className={panel.help}>
          Rooms appear here once walls close around a space. Select anything on
          the plan to edit it.
        </p>
      ) : (
        <>
          <ul className="mb-1">
            {scene.rooms.map((room) => (
              <li key={room.key}>
                <button
                  className="-mx-2 flex w-[calc(100%+16px)] justify-between rounded-small px-2 py-[9px] text-left transition-[background] duration-150 ease-naksa hover:bg-tile"
                  onClick={() => {
                    setSelection({ type: "room", id: room.key });
                    setTool("select");
                  }}
                >
                  <span>{room.name}</span>
                  <span className="font-semibold text-muted">
                    {formatArea(room.area)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Fact label="Total floor area" value={formatArea(total)} />
        </>
      )}

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
