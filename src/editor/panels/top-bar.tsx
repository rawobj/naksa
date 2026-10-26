"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { planAtom, planNameAtom } from "../editor-atoms";

// Top bar: app name and plan name
export default function TopBar() {
  const name = useAtomValue(planNameAtom);
  const setPlan = useSetAtom(planAtom);

  const rename = (value: string) =>
    setPlan((plan) => ({ ...plan, name: value }));

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
        onChange={(e) => rename(e.target.value)}
        onBlur={(e) => {
          if (!e.target.value.trim()) rename("Untitled plan");
        }}
      />
    </header>
  );
}
