"use client";

import { produce } from "immer";
import { useAtomValue, useSetAtom } from "jotai";
import { Icon } from "../icons";
import {
  canRedoAtom,
  canUndoAtom,
  commitAtom,
  planNameAtom,
  redoAtom,
  undoAtom,
} from "../editor-atoms";

type TopBarProps = {
  onNew(): void;
  onOpen(): void;
  onSave(): void;
};

// Undo and redo
const iconButton =
  "grid size-[34px] place-items-center rounded-small text-on-navy transition-[background] duration-150 ease-naksa enabled:hover:bg-navy-raised disabled:text-[#7f8aa2]";

// File actions, the label hides below 1280px
const action =
  "flex h-9 items-center gap-[7px] rounded-small px-[11px] font-semibold whitespace-nowrap text-on-navy transition-[background] duration-150 ease-naksa hover:bg-navy-raised max-[1280px]:w-9 max-[1280px]:justify-center max-[1280px]:px-0 [&>span]:max-[1280px]:hidden";

// Top bar: plan name, undo and redo and file actions
export default function TopBar({ onNew, onOpen, onSave }: TopBarProps) {
  const name = useAtomValue(planNameAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  const commit = useSetAtom(commitAtom);
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);

  const rename = (value: string) =>
    commit((plan) =>
      produce(plan, (draft) => {
        draft.name = value;
      })
    );

  return (
    <header className="flex min-w-0 items-center gap-3.5 bg-navy pr-3.5 pl-5 text-on-navy [grid-area:bar] max-[860px]:gap-2 max-[860px]:pr-2 max-[860px]:pl-3 [&_:focus-visible]:outline-brass-bright">
      <span className="text-[21px] font-extrabold tracking-[-0.02em] max-[560px]:text-[17px]">
        Naksa
      </span>
      <input
        className="h-[34px] min-w-[90px] flex-[0_1_230px] text-ellipsis rounded-small border border-transparent bg-transparent px-2.5 font-medium text-on-navy transition-[background,border-color] duration-150 ease-naksa hover:bg-navy-raised focus-visible:border-brass focus-visible:bg-navy-deep focus-visible:outline-none max-[860px]:hidden"
        value={name}
        aria-label="Plan name"
        spellCheck={false}
        // Every keystroke is its own undo step
        onChange={(e) => rename(e.target.value)}
        onBlur={(e) => {
          if (!e.target.value.trim()) rename("Untitled plan");
        }}
      />
      <div className="flex gap-0.5 max-[560px]:hidden">
        <button
          className={iconButton}
          onClick={() => undo()}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Icon name="undo" />
        </button>
        <button
          className={iconButton}
          onClick={() => redo()}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Icon name="redo" />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <button className={action} onClick={onNew} title="Start a blank plan">
          <Icon name="file" size={18} />
          <span>New</span>
        </button>
        <button
          className={action}
          onClick={onOpen}
          title="Open a saved plan file (Ctrl+O)"
        >
          <Icon name="open" size={18} />
          <span>Open</span>
        </button>
        <button
          className={action}
          onClick={onSave}
          title="Save the plan as a file (Ctrl+S)"
        >
          <Icon name="save" size={18} />
          <span>Save</span>
        </button>
      </div>
    </header>
  );
}
