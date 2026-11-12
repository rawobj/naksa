"use client";

import { generatePlan, PRESET_BRIEFS } from "@/core/generate";
import type { Plan } from "@/core/model";
import { Icon } from "./icons";

type WelcomeProps = {
  onDraw(): void;
  onPreset(plan: Plan): void;
  onGenerate(): void;
};

// Shown over an empty plan: three ways to begin
export default function Welcome({
  onDraw,
  onPreset,
  onGenerate,
}: WelcomeProps) {
  return (
    <div className="absolute top-1/2 left-1/2 w-[min(440px,calc(100%-32px))] -translate-x-1/2 -translate-y-[54%] animate-settle rounded-[14px] bg-paper px-[26px] pt-[26px] pb-[22px] shadow-raised">
      <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-balance">
        Start your floor plan
      </h1>
      <p className="mt-1.5 text-sm leading-normal text-muted">
        Begin with a ready layout and change anything, or draw your own walls
        from nothing.
      </p>

      {/* Preset layouts */}
      <div className="mt-[18px] grid grid-cols-2 gap-2">
        {PRESET_BRIEFS.map((preset) => (
          <button
            key={preset.key}
            className="flex flex-col gap-px rounded-big bg-tile px-[13px] py-[11px] text-left transition-[background] duration-150 ease-naksa hover:bg-tile-hover"
            onClick={() => onPreset(generatePlan(preset.brief, 0))}
          >
            <strong className="text-sm">{preset.label}</strong>
            <span className="text-xs text-muted">{preset.note}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="flex h-10 items-center gap-2 rounded-small bg-navy px-4 font-bold text-on-navy hover:bg-navy-raised"
          onClick={onDraw}
        >
          <Icon name="wall" size={18} />
          Draw walls
        </button>
        <button
          className="flex h-10 items-center gap-2 rounded-small bg-transparent px-4 font-bold text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-tile"
          onClick={onGenerate}
        >
          <Icon name="generate" size={18} />
          Generate from a brief
        </button>
      </div>
    </div>
  );
}
