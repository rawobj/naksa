"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BRIEF_LIMITS,
  DEFAULT_BRIEF,
  generatePlan,
  PRESET_BRIEFS,
  VARIANT_COUNT,
  type Brief,
} from "@/core/generate";
import type { Plan } from "@/core/model";
import { Icon } from "../icons";
import PlanThumb from "../plan-thumb";

type GenerateDialogProps = {
  open: boolean;
  onClose(): void;
  onUse(plan: Plan): void;
};

const heading = "mt-[18px] mb-2 text-xs font-bold text-muted first:mt-1";
const row =
  "flex min-h-[46px] items-center justify-between border-b border-line";

// Minus and plus buttons around a number, for the room counts
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(v: number): void;
}) {
  const step =
    "grid size-8 place-items-center rounded-small bg-tile text-navy enabled:hover:bg-tile-hover disabled:text-[#b3b0a7]";
  return (
    <div className={row}>
      <span>{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={step}
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          aria-label={`Fewer ${label.toLowerCase()}`}
        >
          <Icon name="minus" size={16} />
        </button>
        <output aria-live="polite" className="min-w-7 text-center font-bold">
          {value}
        </output>
        <button
          type="button"
          className={step}
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          aria-label={`More ${label.toLowerCase()}`}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  );
}

// Input in metres, stored in millimetres rounded to 50 mm
function Metres({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(v: number): void;
}) {
  const [text, setText] = useState((value / 1000).toFixed(1));

  // Show the new value when a preset changes it
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText((value / 1000).toFixed(1));
  }

  const apply = () => {
    const metres = Number(text);
    if (!Number.isFinite(metres)) return setText((value / 1000).toFixed(1));
    const next = Math.min(max, Math.max(min, Math.round(metres * 20) * 50));
    setText((next / 1000).toFixed(1));
    onChange(next);
  };

  return (
    <label>
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <div className="flex h-[38px] items-center rounded-small border border-line-strong bg-white px-2.5 focus-within:border-select focus-within:shadow-[0_0_0_3px_rgba(31,111,235,0.16)]">
        <input
          className="w-0 flex-1 border-0 bg-transparent font-semibold outline-0"
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            apply();
          }}
        />
        <span className="text-muted">m</span>
      </div>
    </label>
  );
}

// Asks for a short brief and shows a few layouts for it to pick from
export default function GenerateDialog({
  open,
  onClose,
  onUse,
}: GenerateDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [choice, setChoice] = useState(0);

  // A native modal dialog, opened and closed to follow the open prop
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Every variant for the current brief, only worked out while the dialog is open
  const layouts = useMemo(
    () =>
      open
        ? Array.from({ length: VARIANT_COUNT }, (_, variant) =>
            generatePlan(brief, variant)
          )
        : [],
    [brief, open]
  );
  const patch = (next: Partial<Brief>) => setBrief((b) => ({ ...b, ...next }));

  return (
    <dialog
      ref={ref}
      // m-auto puts back the centring that Tailwind's reset takes away
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(900px,calc(100vw-32px))] overflow-hidden rounded-[14px] border-0 bg-paper p-0 text-ink shadow-[0_24px_70px_rgba(19,29,49,0.35)] open:animate-rise backdrop:bg-[rgba(19,29,49,0.5)]"
      onClose={onClose}
      aria-labelledby="generate-title"
    >
      <form
        method="dialog"
        className="flex max-h-[calc(100dvh-32px)] flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          const plan = layouts[choice];
          if (plan) onUse(plan);
        }}
      >
        <header className="flex justify-between gap-4 px-6 pt-[22px] pb-4">
          <div>
            <h2
              id="generate-title"
              className="text-xl font-extrabold tracking-[-0.02em]"
            >
              Generate a floor plan
            </h2>
            <p className="mt-1 max-w-[62ch] text-muted">
              Say how big the home is and what it needs. Pick a layout, then
              edit it like any other plan.
            </p>
          </div>
          <button
            type="button"
            className="grid size-9 flex-none place-items-center rounded-small text-muted hover:bg-tile hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="grid min-h-0 grid-cols-[272px_1fr] gap-6 overflow-y-auto px-6 pb-5 max-[760px]:grid-cols-1">
          {/* The brief */}
          <div>
            <h3 className={heading}>Start from</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_BRIEFS.map((preset) => {
                const active =
                  JSON.stringify(preset.brief) === JSON.stringify(brief);
                return (
                  <button
                    key={preset.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setBrief(preset.brief)}
                    className="group flex flex-col gap-px rounded-small bg-tile px-[11px] py-[9px] text-left transition-[background,color] duration-150 ease-naksa hover:bg-tile-hover aria-pressed:bg-navy aria-pressed:text-on-navy"
                  >
                    <strong>{preset.label}</strong>
                    <span className="text-xs text-muted group-aria-pressed:text-on-navy-muted">
                      {preset.note}
                    </span>
                  </button>
                );
              })}
            </div>

            <h3 className={heading}>Outside size</h3>
            <div className="grid grid-cols-2 gap-2">
              <Metres
                label="Width"
                value={brief.width}
                min={BRIEF_LIMITS.minWidth}
                max={BRIEF_LIMITS.maxWidth}
                onChange={(width) => patch({ width })}
              />
              <Metres
                label="Depth"
                value={brief.depth}
                min={BRIEF_LIMITS.minDepth}
                max={BRIEF_LIMITS.maxDepth}
                onChange={(depth) => patch({ depth })}
              />
            </div>

            <h3 className={heading}>Rooms</h3>
            <Stepper
              label="Bedrooms"
              value={brief.bedrooms}
              min={1}
              max={BRIEF_LIMITS.maxBedrooms}
              onChange={(bedrooms) => patch({ bedrooms })}
            />
            <Stepper
              label="Bathrooms"
              value={brief.bathrooms}
              min={1}
              max={BRIEF_LIMITS.maxBathrooms}
              onChange={(bathrooms) => patch({ bathrooms })}
            />
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 border-b border-line">
              <input
                type="checkbox"
                className="size-[18px] accent-navy"
                checked={brief.dining}
                onChange={(e) => patch({ dining: e.target.checked })}
              />
              Separate dining room
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 border-b border-line">
              <input
                type="checkbox"
                className="size-[18px] accent-navy"
                checked={brief.store}
                onChange={(e) => patch({ store: e.target.checked })}
              />
              Store room
            </label>
          </div>

          {/* Layout choices */}
          <div
            className="grid grid-cols-2 content-start gap-2.5 max-[460px]:grid-cols-1"
            role="radiogroup"
            aria-label="Layouts"
          >
            {layouts.map((plan, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={choice === i}
                className="flex flex-col items-center gap-2 rounded-big bg-white px-2.5 pt-2.5 pb-[9px] font-semibold text-muted shadow-[inset_0_0_0_1px_var(--line)] transition-[box-shadow,color] duration-180 ease-naksa hover:shadow-[inset_0_0_0_1px_var(--line-strong)] aria-checked:text-ink aria-checked:shadow-[inset_0_0_0_2px_var(--brass)] [&_canvas]:max-w-full"
                onClick={() => setChoice(i)}
              >
                <PlanThumb plan={plan} width={252} height={178} />
                <span>Layout {i + 1}</span>
              </button>
            ))}
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-6 py-3.5 max-[760px]:justify-end">
          <p className="flex-1 text-[12.5px] text-muted max-[760px]:hidden">
            This replaces the plan on screen. Undo brings the old one back.
          </p>
          <button
            type="button"
            className="h-10 rounded-small px-[18px] font-bold text-ink hover:bg-tile"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-10 rounded-small bg-navy px-[18px] font-bold text-on-navy hover:bg-navy-raised"
          >
            Use layout {choice + 1}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
