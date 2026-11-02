"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

// Shared classes for the side panel content
export const panel = {
  body: "px-4 pt-[18px] pb-6",
  title: "mb-2.5 text-[15px] font-bold tracking-[-0.01em]",
  heading: "mt-[22px] mb-2 text-xs font-bold text-muted",
  help: "mt-2.5 text-[12.5px] leading-normal text-muted",
};

const field =
  "flex min-h-[46px] items-center justify-between gap-3 border-b border-line";
const labelClass = "text-muted";

// The box around an input, with a unit on the right
const box =
  "flex h-[34px] w-[124px] items-center rounded-small border border-line-strong bg-white px-2.5 transition-[border-color,box-shadow] duration-150 ease-naksa focus-within:border-select focus-within:shadow-[0_0_0_3px_rgba(31,111,235,0.16)]";
const bare =
  "w-0 min-w-0 flex-1 border-0 bg-transparent font-semibold caret-select outline-none focus-visible:outline-none";

type NumberFieldProps = {
  label: string;
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  onCommit(value: number): void;
};

// A numeric input that applies on Enter or blur and reverts on Escape or bad input
export function NumberField({
  label,
  value,
  unit = "mm",
  min = 0,
  max = 100000,
  step = 50,
  onCommit,
}: NumberFieldProps) {
  const id = useId();
  const shown = String(Math.round(value * 100) / 100);
  const [text, setText] = useState(shown);

  // When the value changes from outside (undo, dragging on the plan) show the new value.
  // Done during render instead of in an effect so there's no extra render with the old text.
  const [lastShown, setLastShown] = useState(shown);
  if (shown !== lastShown) {
    setLastShown(shown);
    setText(shown);
  }

  const apply = () => {
    const next = Number(text);
    if (text.trim() === "" || !Number.isFinite(next)) return setText(shown);
    const clamped = Math.min(max, Math.max(min, next));
    setText(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <div className={field}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className={box}>
        <input
          id={id}
          className={cn(bare, "text-right")}
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setText(shown);
              e.currentTarget.blur();
            }
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const next = Math.min(
                max,
                Math.max(min, value + (e.key === "ArrowUp" ? step : -step))
              );
              if (next !== value) onCommit(next);
            }
          }}
        />
        {unit && <span className="ml-1.5 text-xs text-muted">{unit}</span>}
      </div>
    </div>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  autoFocus?: boolean;
  onChange(value: string): void;
};

export function TextField({
  label,
  value,
  autoFocus,
  onChange,
}: TextFieldProps) {
  const id = useId();
  return (
    <div className={field}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className={cn(box, "w-[170px]")}>
        <input
          id={id}
          className={cn(bare, "text-left")}
          value={value}
          autoFocus={autoFocus}
          onFocus={(e) => autoFocus && e.currentTarget.select()}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          }}
        />
      </div>
    </div>
  );
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={field}>
      <span className="text-muted">{label}</span>
      <strong className="font-bold">{value}</strong>
    </div>
  );
}
