"use client";

import Inspector from "./inspector";

// Right panel with the properties of the selection
export default function SidePanel() {
  return (
    <aside
      className="flex min-h-0 flex-col border-l border-line bg-paper [grid-area:side] max-[960px]:border-t max-[960px]:border-l-0"
      aria-label="Properties"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Inspector />
      </div>
    </aside>
  );
}
