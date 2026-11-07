// Furniture and fixtures.
// Each symbol is drawn with simple shapes in unit space (0..1 across, 0..1 down),
// so the same drawing is used for the toolbox icon, the plan and the PNG export.
// The back of an item (the side against a wall) is y = 0.

export type Shape =
  | { t: "rect"; x: number; y: number; w: number; h: number; r?: number }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number };

export type ItemGroup =
  "Living" | "Bedroom" | "Kitchen" | "Dining" | "Bath" | "Other";

export type CatalogueEntry = {
  kind: string;
  label: string;
  group: ItemGroup;
  width: number; // default footprint in millimetres
  depth: number;
  height: number; // height used by the 3D view, in millimetres
  shapes: Shape[];
};

const rect = (x: number, y: number, w: number, h: number, r = 0): Shape => ({
  t: "rect",
  x,
  y,
  w,
  h,
  r,
});
const oval = (cx: number, cy: number, rx: number, ry: number): Shape => ({
  t: "ellipse",
  cx,
  cy,
  rx,
  ry,
});
const line = (x1: number, y1: number, x2: number, y2: number): Shape => ({
  t: "line",
  x1,
  y1,
  x2,
  y2,
});
const frame = rect(0, 0, 1, 1, 0.04);

export const CATALOGUE: CatalogueEntry[] = [
  {
    kind: "sofa-3",
    label: "Sofa, 3 seat",
    group: "Living",
    width: 2100,
    depth: 900,
    height: 800,
    shapes: [
      rect(0, 0, 1, 1, 0.1),
      rect(0.09, 0.3, 0.82, 0.7, 0.06),
      line(0.363, 0.3, 0.363, 1),
      line(0.637, 0.3, 0.637, 1),
    ],
  },
  {
    kind: "sofa-2",
    label: "Sofa, 2 seat",
    group: "Living",
    width: 1500,
    depth: 900,
    height: 800,
    shapes: [
      rect(0, 0, 1, 1, 0.1),
      rect(0.12, 0.3, 0.76, 0.7, 0.06),
      line(0.5, 0.3, 0.5, 1),
    ],
  },
  {
    kind: "armchair",
    label: "Armchair",
    group: "Living",
    width: 850,
    depth: 850,
    height: 800,
    shapes: [rect(0, 0, 1, 1, 0.14), rect(0.18, 0.3, 0.64, 0.7, 0.08)],
  },
  {
    kind: "coffee-table",
    label: "Coffee table",
    group: "Living",
    width: 1100,
    depth: 600,
    height: 420,
    shapes: [rect(0, 0, 1, 1, 0.12), rect(0.08, 0.14, 0.84, 0.72, 0.08)],
  },
  {
    kind: "tv-unit",
    label: "TV unit",
    group: "Living",
    width: 1600,
    depth: 450,
    height: 550,
    shapes: [frame, rect(0.15, 0.2, 0.7, 0.22)],
  },
  {
    kind: "bed-double",
    label: "Double bed",
    group: "Bedroom",
    width: 1500,
    depth: 2000,
    height: 550,
    shapes: [
      frame,
      rect(0.08, 0.05, 0.38, 0.17, 0.06),
      rect(0.54, 0.05, 0.38, 0.17, 0.06),
      line(0, 0.3, 1, 0.3),
    ],
  },
  {
    kind: "bed-single",
    label: "Single bed",
    group: "Bedroom",
    width: 900,
    depth: 1900,
    height: 550,
    shapes: [frame, rect(0.15, 0.05, 0.7, 0.17, 0.06), line(0, 0.3, 1, 0.3)],
  },
  {
    kind: "wardrobe",
    label: "Wardrobe",
    group: "Bedroom",
    width: 1800,
    depth: 600,
    height: 2100,
    shapes: [
      frame,
      line(0.5, 0, 0.5, 1),
      line(0.44, 0.7, 0.44, 0.9),
      line(0.56, 0.7, 0.56, 0.9),
    ],
  },
  {
    kind: "desk",
    label: "Desk and chair",
    group: "Bedroom",
    width: 1200,
    depth: 1100,
    height: 750,
    shapes: [rect(0, 0, 1, 0.55, 0.03), rect(0.3, 0.64, 0.4, 0.36, 0.08)],
  },
  {
    kind: "counter",
    label: "Counter",
    group: "Kitchen",
    width: 1800,
    depth: 600,
    height: 900,
    shapes: [frame],
  },
  {
    kind: "hob",
    label: "Hob",
    group: "Kitchen",
    width: 600,
    depth: 600,
    height: 900,
    shapes: [
      frame,
      oval(0.3, 0.3, 0.14, 0.14),
      oval(0.7, 0.3, 0.14, 0.14),
      oval(0.3, 0.7, 0.14, 0.14),
      oval(0.7, 0.7, 0.14, 0.14),
    ],
  },
  {
    kind: "sink",
    label: "Kitchen sink",
    group: "Kitchen",
    width: 900,
    depth: 600,
    height: 900,
    shapes: [
      frame,
      rect(0.08, 0.2, 0.5, 0.64, 0.08),
      line(0.66, 0.3, 0.92, 0.3),
      line(0.66, 0.5, 0.92, 0.5),
      line(0.66, 0.7, 0.92, 0.7),
    ],
  },
  {
    kind: "fridge",
    label: "Fridge",
    group: "Kitchen",
    width: 700,
    depth: 700,
    height: 1800,
    shapes: [frame, line(0, 0.88, 1, 0.88), line(0.15, 0.94, 0.4, 0.94)],
  },
  {
    kind: "dining-4",
    label: "Dining, 4 seat",
    group: "Dining",
    width: 1300,
    depth: 1700,
    height: 750,
    shapes: [
      rect(0, 0.24, 1, 0.52, 0.04),
      rect(0.1, 0, 0.3, 0.19, 0.2),
      rect(0.6, 0, 0.3, 0.19, 0.2),
      rect(0.1, 0.81, 0.3, 0.19, 0.2),
      rect(0.6, 0.81, 0.3, 0.19, 0.2),
    ],
  },
  {
    kind: "dining-6",
    label: "Dining, 6 seat",
    group: "Dining",
    width: 1900,
    depth: 1700,
    height: 750,
    shapes: [
      rect(0, 0.24, 1, 0.52, 0.04),
      rect(0.06, 0, 0.22, 0.19, 0.2),
      rect(0.39, 0, 0.22, 0.19, 0.2),
      rect(0.72, 0, 0.22, 0.19, 0.2),
      rect(0.06, 0.81, 0.22, 0.19, 0.2),
      rect(0.39, 0.81, 0.22, 0.19, 0.2),
      rect(0.72, 0.81, 0.22, 0.19, 0.2),
    ],
  },
  {
    kind: "toilet",
    label: "Toilet",
    group: "Bath",
    width: 400,
    depth: 700,
    height: 420,
    shapes: [rect(0.02, 0, 0.96, 0.28, 0.08), oval(0.5, 0.64, 0.42, 0.36)],
  },
  {
    kind: "basin",
    label: "Basin",
    group: "Bath",
    width: 550,
    depth: 450,
    height: 850,
    shapes: [
      rect(0, 0, 1, 1, 0.1),
      oval(0.5, 0.56, 0.34, 0.3),
      line(0.5, 0.08, 0.5, 0.22),
    ],
  },
  {
    kind: "shower",
    label: "Shower",
    group: "Bath",
    width: 900,
    depth: 900,
    height: 100,
    shapes: [
      frame,
      line(0, 0, 1, 1),
      line(1, 0, 0, 1),
      oval(0.5, 0.5, 0.07, 0.07),
    ],
  },
  {
    kind: "bathtub",
    label: "Bathtub",
    group: "Bath",
    width: 1700,
    depth: 750,
    height: 550,
    shapes: [
      frame,
      rect(0.05, 0.1, 0.9, 0.8, 0.4),
      oval(0.14, 0.5, 0.025, 0.05),
    ],
  },
  {
    kind: "washer",
    label: "Washing machine",
    group: "Other",
    width: 600,
    depth: 600,
    height: 850,
    shapes: [frame, oval(0.5, 0.56, 0.3, 0.3), line(0, 0.16, 1, 0.16)],
  },
  {
    kind: "stairs",
    label: "Stairs",
    group: "Other",
    width: 1000,
    depth: 2700,
    height: 2850,
    shapes: [
      rect(0, 0, 1, 1),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => line(0, i / 10, 1, i / 10)),
      line(0.5, 0.92, 0.5, 0.1),
      line(0.5, 0.1, 0.36, 0.17),
      line(0.5, 0.1, 0.64, 0.17),
    ],
  },
  {
    kind: "car",
    label: "Car",
    group: "Other",
    width: 1800,
    depth: 4400,
    height: 1500,
    shapes: [
      rect(0, 0, 1, 1, 0.22),
      rect(0.12, 0.2, 0.76, 0.16, 0.2),
      rect(0.12, 0.66, 0.76, 0.12, 0.2),
      line(0.12, 0.36, 0.12, 0.66),
      line(0.88, 0.36, 0.88, 0.66),
    ],
  },
  {
    kind: "plant",
    label: "Plant",
    group: "Other",
    width: 500,
    depth: 500,
    height: 900,
    shapes: [
      oval(0.5, 0.5, 0.5, 0.5),
      oval(0.5, 0.5, 0.2, 0.2),
      line(0.5, 0.06, 0.5, 0.3),
      line(0.5, 0.7, 0.5, 0.94),
      line(0.06, 0.5, 0.3, 0.5),
      line(0.7, 0.5, 0.94, 0.5),
    ],
  },
];

export const ITEM_GROUPS: ItemGroup[] = [
  "Living",
  "Bedroom",
  "Kitchen",
  "Dining",
  "Bath",
  "Other",
];

const byKind = new Map(CATALOGUE.map((entry) => [entry.kind, entry]));

export const catalogueEntry = (kind: string): CatalogueEntry | undefined =>
  byKind.get(kind);

// Floor finishes for rooms. Planks and tiles are drawn at their real size in the plan view.
export type Finish = {
  key: string;
  label: string;
  color: string;
  line: string; // colour of the joints between planks or tiles
  pattern: "planks" | "tiles" | "none";
  size: number; // plank width or tile side, in millimetres
};

export const FINISHES: Finish[] = [
  {
    key: "oak",
    label: "Oak boards",
    color: "#e8d2ad",
    line: "#d2b889",
    pattern: "planks",
    size: 180,
  },
  {
    key: "walnut",
    label: "Walnut boards",
    color: "#d3b48d",
    line: "#b99870",
    pattern: "planks",
    size: 180,
  },
  {
    key: "ceramic",
    label: "Ceramic tile",
    color: "#ece6d9",
    line: "#d4ccbb",
    pattern: "tiles",
    size: 600,
  },
  {
    key: "aqua",
    label: "Bathroom tile",
    color: "#d2e0e5",
    line: "#b4c8d0",
    pattern: "tiles",
    size: 300,
  },
  {
    key: "slate",
    label: "Slate",
    color: "#d5d6d8",
    line: "#b9bbc0",
    pattern: "tiles",
    size: 800,
  },
  {
    key: "carpet",
    label: "Carpet",
    color: "#dcdfd2",
    line: "#dcdfd2",
    pattern: "none",
    size: 0,
  },
  {
    key: "screed",
    label: "Cement screed",
    color: "#e2dfd8",
    line: "#e2dfd8",
    pattern: "none",
    size: 0,
  },
  {
    key: "plain",
    label: "No finish",
    color: "#f7f4ec",
    line: "#f7f4ec",
    pattern: "none",
    size: 0,
  },
];

const byFinish = new Map(FINISHES.map((finish) => [finish.key, finish]));

export const finishFor = (key: string): Finish =>
  byFinish.get(key) ?? FINISHES[FINISHES.length - 1]!;
