"use client";

import { useState } from "react";
import Checks, { useSuggestions } from "./checks";
import Inspector from "./inspector";

const tabButton =
  "flex h-9 items-center gap-[7px] border-b-2 border-transparent px-3 font-semibold text-muted transition-[color,border-color] duration-150 ease-naksa hover:text-ink aria-selected:border-brass aria-selected:text-ink";

// Right panel with two tabs, properties and checks
export default function SidePanel() {
  const [tab, setTab] = useState<"properties" | "checks">("properties");
  const suggestions = useSuggestions();

  return (
    <aside
      className="flex min-h-0 flex-col border-l border-line bg-paper [grid-area:side] max-[960px]:border-t max-[960px]:border-l-0"
      aria-label="Properties and checks"
    >
      <div
        className="flex gap-1 border-b border-line px-3 pt-2.5"
        role="tablist"
      >
        <button
          className={tabButton}
          role="tab"
          aria-selected={tab === "properties"}
          onClick={() => setTab("properties")}
        >
          Properties
        </button>
        <button
          className={tabButton}
          role="tab"
          aria-selected={tab === "checks"}
          onClick={() => setTab("checks")}
        >
          Checks
          {suggestions.length > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-[10px] bg-navy px-1.5 text-[11px] font-bold text-on-navy">
              {suggestions.length}
            </span>
          )}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
        {tab === "properties" ? <Inspector /> : <Checks items={suggestions} />}
      </div>
    </aside>
  );
}
