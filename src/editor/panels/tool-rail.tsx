"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { Icon, type IconName } from "../icons";
import {
  is3dAtom,
  pendingItemAtom,
  toolAtom,
  type ToolId,
} from "../editor-atoms";

export const TOOLS: {
  id: ToolId;
  label: string;
  icon: IconName;
  key: string;
  title: string;
}[] = [
  {
    id: "select",
    label: "Select",
    icon: "select",
    key: "V",
    title: "Select and move things",
  },
  {
    id: "pan",
    label: "Move view",
    icon: "pan",
    key: "H",
    title: "Drag the plan around",
  },
  { id: "wall", label: "Wall", icon: "wall", key: "W", title: "Draw walls" },
  {
    id: "door",
    label: "Door",
    icon: "door",
    key: "D",
    title: "Place a door on a wall",
  },
  {
    id: "window",
    label: "Window",
    icon: "window",
    key: "N",
    title: "Place a window on a wall",
  },
  {
    id: "dimension",
    label: "Measure",
    icon: "dimension",
    key: "M",
    title: "Add a dimension between two points",
  },
  {
    id: "text",
    label: "Note",
    icon: "text",
    key: "T",
    title: "Write a note on the plan",
  },
];

// Left rail of drawing tools, all disabled in the 3D view
export default function ToolRail() {
  const tool = useAtomValue(toolAtom);
  const setTool = useSetAtom(toolAtom);
  const setPendingItem = useSetAtom(pendingItemAtom);
  const disabled = useAtomValue(is3dAtom);

  return (
    <nav
      className="flex flex-col items-center gap-1 overflow-y-auto border-t border-navy-raised bg-navy py-2.5 [grid-area:rail] max-[720px]:flex-row max-[720px]:justify-start max-[720px]:overflow-x-auto max-[720px]:overflow-y-hidden max-[720px]:border-t-0 max-[720px]:px-2 max-[720px]:py-1.5"
      aria-label="Drawing tools"
    >
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className="flex min-h-14 w-[62px] flex-col items-center justify-center gap-1 rounded-big px-0.5 pt-[7px] pb-1.5 text-[10.5px] leading-[1.1] font-semibold text-on-navy-muted transition-[background,color] duration-180 ease-naksa focus-visible:outline-brass-bright enabled:hover:bg-navy-raised enabled:hover:text-on-navy enabled:aria-pressed:bg-brass enabled:aria-pressed:text-on-brass disabled:text-[#6f7b94] max-[720px]:min-h-[50px] max-[720px]:flex-none"
          aria-pressed={tool === t.id}
          disabled={disabled}
          title={`${t.title} (${t.key})`}
          onClick={() => {
            setTool(t.id);
            setPendingItem(null);
          }}
        >
          <Icon name={t.icon} size={22} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
