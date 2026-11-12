import { roundTo, vec, type Vec } from "./geometry";
import { catalogueEntry } from "./catalogue";
import {
  DEFAULTS,
  emptyPlan,
  makeOpening,
  makeWall,
  newId,
  type Opening,
  type Plan,
} from "./model";
import { nearestWall, wallLength } from "./walls";

// What a person asks the generator for. Lengths are millimetres.
export type Brief = {
  width: number; // outside width of the building, along the street
  depth: number; // outside depth of the building, front to back
  bedrooms: number;
  bathrooms: number;
  dining: boolean;
  store: boolean;
};

export const BRIEF_LIMITS = {
  minWidth: 6000,
  maxWidth: 24000,
  minDepth: 6000,
  maxDepth: 24000,
  maxBedrooms: 4,
  maxBathrooms: 3,
} as const;

export const DEFAULT_BRIEF: Brief = {
  width: 11000,
  depth: 9000,
  bedrooms: 2,
  bathrooms: 1,
  dining: true,
  store: false,
};

// How many distinct layouts generatePlan can produce for one brief
export const VARIANT_COUNT = 4;

type RoomType =
  "living" | "dining" | "kitchen" | "bedroom" | "bath" | "store" | "passage";

type Cell = {
  type: RoomType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  // For a bath or store tucked behind another: the bedroom it opens into
  attachedTo?: Cell;
};

const FINISH: Record<RoomType, string> = {
  living: "oak",
  dining: "oak",
  kitchen: "ceramic",
  bedroom: "walnut",
  bath: "aqua",
  store: "screed",
  passage: "ceramic",
};

const PASSAGE = 1200;
const STEP = 50;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

// Splits a length between weighted parts, rounded to 50 mm.
// The last part takes whatever is left so the parts always add up to the total.
function share(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let used = 0;
  weights.forEach((weight, i) => {
    const size =
      i === weights.length - 1
        ? total - used
        : roundTo((total * weight) / sum, STEP);
    out.push(size);
    used += size;
  });
  return out;
}

function layout(brief: Brief, variant: number): Cell[] {
  const W = brief.width;
  const D = brief.depth;
  const mirrorPrivate = (variant & 1) === 1;
  const mirrorPublic = (variant & 2) === 2;

  // The house is two bands: private rooms at the back, public rooms at the front.
  // Baths and the store are small so they are stacked two to a column,
  // the back one opens into the bedroom beside it and the front one opens to the passage.
  const smalls: { type: RoomType; name: string }[] = [];
  for (let i = 0; i < brief.bathrooms; i++) {
    smalls.push({
      type: "bath",
      name: brief.bathrooms > 1 ? `Bath ${i + 1}` : "Bath",
    });
  }
  if (brief.store) smalls.push({ type: "store", name: "Store" });

  type Column = {
    weight: number;
    rooms: { type: RoomType; name: string }[];
  };
  const bedCols: Column[] = [];
  for (let i = 0; i < brief.bedrooms; i++) {
    bedCols.push({
      weight: i === 0 ? 3.9 : 3.3,
      rooms: [
        {
          type: "bedroom",
          name: brief.bedrooms > 1 ? `Bedroom ${i + 1}` : "Bedroom",
        },
      ],
    });
  }
  const smallCols: Column[] = [];
  for (let i = 0; i < smalls.length; i += 2) {
    smallCols.push({ weight: 1.9, rooms: smalls.slice(i, i + 2) });
  }
  // Put each column of small rooms right after a bedroom so it can attach
  const columns: Column[] = [];
  bedCols.forEach((bed, i) => {
    columns.push(bed);
    const small = smallCols[i];
    if (small) columns.push(small);
  });
  for (const extra of smallCols.slice(bedCols.length)) columns.push(extra);
  if (mirrorPrivate) columns.reverse();

  // A passage is only worth it when there are enough back rooms and the house is deep enough
  const privateCount = columns.reduce((n, c) => n + c.rooms.length, 0);
  const hasPassage = privateCount >= 3 && D >= 7500;
  const passage = hasPassage ? PASSAGE : 0;
  const backDepth = roundTo(clamp((D - passage) * 0.45, 2800, 4200), STEP); // 2.8 m to 4.2 m
  const frontTop = backDepth + passage;

  // Back band, left to right
  const cells: Cell[] = [];
  let x = 0;
  const widths = share(
    W,
    columns.map((c) => c.weight)
  );
  let lastBedroom: Cell | undefined;
  const pending: Cell[] = [];
  columns.forEach((column, i) => {
    const w = widths[i]!;
    if (column.rooms.length === 1) {
      const room = column.rooms[0]!;
      const cell: Cell = { ...room, x, y: 0, w, h: backDepth };
      cells.push(cell);
      if (room.type === "bedroom") {
        lastBedroom = cell;
        for (const waiting of pending.splice(0)) waiting.attachedTo = cell;
      }
    } else {
      const split = roundTo(backDepth * 0.5, STEP);
      const [front, back] = [column.rooms[0]!, column.rooms[1]!];
      const backCell: Cell = {
        ...back,
        x,
        y: 0,
        w,
        h: split,
        attachedTo: lastBedroom,
      };
      // No bedroom to the left yet (mirrored), so attach to the next bedroom instead
      if (!lastBedroom) pending.push(backCell);
      cells.push(backCell, { ...front, x, y: split, w, h: backDepth - split });
    }
    x += w;
  });

  if (hasPassage)
    cells.push({
      type: "passage",
      name: "Passage",
      x: 0,
      y: backDepth,
      w: W,
      h: PASSAGE,
    });

  const publics: { type: RoomType; name: string; weight: number }[] = [
    { type: "living", name: "Living", weight: 4.6 },
  ];
  if (brief.dining) publics.push({ type: "dining", name: "Dining", weight: 3 });
  publics.push({ type: "kitchen", name: "Kitchen", weight: 2.9 });
  if (mirrorPublic) publics.reverse();
  const publicWidths = share(
    W,
    publics.map((p) => p.weight)
  );
  x = 0;
  publics.forEach((room, i) => {
    cells.push({
      type: room.type,
      name: room.name,
      x,
      y: frontTop,
      w: publicWidths[i]!,
      h: D - frontTop,
    });
    x += publicWidths[i]!;
  });
  return cells;
}

// Turns the cell edges into walls.
// Edges are grouped by the line they sit on, then overlapping spans on a line are merged,
// so two rooms side by side share one wall instead of getting two.
function wallsFrom(cells: Cell[], W: number, D: number) {
  const horizontal = new Map<number, [number, number][]>();
  const vertical = new Map<number, [number, number][]>();
  const push = (
    map: Map<number, [number, number][]>,
    key: number,
    span: [number, number]
  ) => {
    const list = map.get(key);
    if (list) list.push(span);
    else map.set(key, [span]);
  };
  for (const c of cells) {
    push(horizontal, c.y, [c.x, c.x + c.w]);
    push(horizontal, c.y + c.h, [c.x, c.x + c.w]);
    push(vertical, c.x, [c.y, c.y + c.h]);
    push(vertical, c.x + c.w, [c.y, c.y + c.h]);
  }
  const merge = (spans: [number, number][]) => {
    const sorted = [...spans].sort((a, b) => a[0] - b[0]);
    const out: [number, number][] = [];
    for (const span of sorted) {
      const last = out[out.length - 1];
      if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
      else out.push([span[0], span[1]]);
    }
    return out;
  };
  const walls = [];
  for (const [y, spans] of horizontal) {
    const outer = y === 0 || y === D;
    for (const [from, to] of merge(spans)) {
      walls.push(
        makeWall(
          vec(from, y),
          vec(to, y),
          outer ? DEFAULTS.exteriorThickness : DEFAULTS.interiorThickness
        )
      );
    }
  }
  for (const [x, spans] of vertical) {
    const outer = x === 0 || x === W;
    for (const [from, to] of merge(spans)) {
      walls.push(
        makeWall(
          vec(x, from),
          vec(x, to),
          outer ? DEFAULTS.exteriorThickness : DEFAULTS.interiorThickness
        )
      );
    }
  }
  return walls;
}

// Lays out a single storey home for a brief.
// The result is a normal plan (walls, doors, windows, named rooms, furniture), all editable.
// variant (0 to VARIANT_COUNT - 1) picks which halves are mirrored.
export function generatePlan(input: Brief, variant = 0): Plan {
  const brief: Brief = {
    width: roundTo(
      clamp(input.width, BRIEF_LIMITS.minWidth, BRIEF_LIMITS.maxWidth),
      STEP
    ),
    depth: roundTo(
      clamp(input.depth, BRIEF_LIMITS.minDepth, BRIEF_LIMITS.maxDepth),
      STEP
    ),
    bedrooms: clamp(Math.round(input.bedrooms), 1, BRIEF_LIMITS.maxBedrooms),
    bathrooms: clamp(Math.round(input.bathrooms), 1, BRIEF_LIMITS.maxBathrooms),
    dining: input.dining,
    store: input.store,
  };
  // 1. Rooms as rectangles, 2. walls from their edges
  const { width: W, depth: D } = brief;
  const cells = layout(brief, variant);
  const plan = emptyPlan(`${brief.bedrooms} bedroom home`);
  plan.walls = wallsFrom(cells, W, D);

  // Function to put an opening on the wall nearest a point.
  // Skips it if the wall is too short or it would overlap another opening.
  const place = (
    kind: "door" | "window",
    at: Vec,
    width: number,
    tweak?: Partial<Opening>
  ) => {
    const hit = nearestWall(at, plan.walls, 5);
    if (!hit) return;
    const len = wallLength(hit.wall);
    const margin = width / 2 + 150;
    if (len < width + 300) return;
    const offset = clamp(hit.offset, margin, len - margin);
    const clash = plan.openings.some(
      (o) =>
        o.wallId === hit.wall.id &&
        Math.abs(o.offset - offset) < (o.width + width) / 2 + 100
    );
    if (clash) return;
    plan.openings.push({
      ...makeOpening(kind, hit.wall.id, offset, width),
      ...tweak,
    });
  };

  // 3. Room names, doors and windows for every cell
  const passage = cells.find((c) => c.type === "passage");
  const living = cells.find((c) => c.type === "living")!;
  const seam = passage ? passage.y : living.y;

  for (const c of cells) {
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    plan.rooms.push({
      id: newId("r"),
      anchor: vec(cx, cy),
      name: c.name,
      finish: FINISH[c.type],
    });

    // Doors
    if (c.type === "living") {
      place("door", vec(c.x + c.w * 0.3, D), 1050);
      if (passage) place("door", vec(cx, passage.y + passage.h), 1000);
    } else if (c.type === "dining" || c.type === "kitchen") {
      // Open to whichever public room is next to it on the living side
      const towardLiving = living.x < c.x ? c.x : c.x + c.w;
      place("door", vec(towardLiving, c.y + c.h * 0.6), 900);
    } else if (c.type === "bedroom") {
      place("door", vec(c.x + Math.min(650, c.w / 2), seam), 900);
    } else if (c.type === "bath" || c.type === "store") {
      const width = 750;
      if (c.y + c.h === seam) {
        place("door", vec(cx, seam), width);
      } else if (c.attachedTo) {
        const side = c.attachedTo.x < c.x ? c.x : c.x + c.w;
        place("door", vec(side, cy), width);
      } else {
        place("door", vec(cx, c.y + c.h), width);
      }
    }

    // Windows on outside walls
    if (c.type === "passage") {
      place("window", vec(0, cy), 600, { sill: 1200, height: 900 });
      continue;
    }
    const small = c.type === "bath" || c.type === "store";
    const size = small ? 600 : c.type === "kitchen" ? 1200 : 1500;
    const tweak = small ? { sill: 1500, height: 600 } : undefined;
    if (c.y === 0)
      place("window", vec(cx, 0), Math.min(size, c.w - 900), tweak);
    if (c.y + c.h === D)
      place(
        "window",
        vec(c.type === "living" ? c.x + c.w * 0.7 : cx, D),
        Math.min(size, c.w - 900),
        tweak
      );
    if (c.x === 0 && !small)
      place("window", vec(0, cy), Math.min(1200, c.h - 900));
    if (c.x + c.w === W && !small)
      place("window", vec(W, cy), Math.min(1200, c.h - 900));
    if (small && c.y !== 0 && c.x === 0)
      place("window", vec(0, cy), 600, tweak);
    if (small && c.y !== 0 && c.x + c.w === W)
      place("window", vec(W, cy), 600, tweak);
  }

  // 4. Furniture
  furnish(plan, cells);
  return plan;
}

// Adds starter furniture, kept clear of the walls
function furnish(plan: Plan, cells: Cell[]) {
  const gap = 180;
  const put = (kind: string, x: number, y: number, rotation = 0) => {
    const entry = catalogueEntry(kind);
    if (!entry) return;
    plan.items.push({
      id: newId("i"),
      kind,
      position: vec(Math.round(x), Math.round(y)),
      rotation,
      width: entry.width,
      depth: entry.depth,
    });
  };
  for (const c of cells) {
    const left = c.x + gap;
    const right = c.x + c.w - gap;
    const top = c.y + gap;
    const bottom = c.y + c.h - gap;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    if (c.type === "bedroom") {
      const bed = c.w >= 3000 ? "bed-double" : "bed-single";
      const depth = catalogueEntry(bed)!.depth;
      // Head against the back wall when the room is on the back of the house
      put(bed, cx, top + depth / 2, 0);
      // Wardrobe on the passage wall, in the corner away from the door
      if (c.w >= 3600 && c.h >= 3200)
        put("wardrobe", right - 900, bottom - 300, 180);
    } else if (c.type === "living") {
      if (c.w >= 3200 && c.h >= 3000) {
        // Seating sits to one side so the way in from the front door stays clear
        const sx = c.x + c.w * 0.64;
        put("sofa-3", sx, top + 450, 0);
        put("coffee-table", sx, top + 450 + 1150, 0);
        if (c.h >= 4000) put("tv-unit", sx, bottom - 225, 180);
      }
    } else if (c.type === "dining") {
      if (c.w >= 2400 && c.h >= 2600)
        put(c.w >= 3200 ? "dining-6" : "dining-4", cx, cy, 0);
    } else if (c.type === "kitchen") {
      // A run along whichever side wall is further from the living room
      const onRight = c.x > 0;
      const x = onRight ? right - 300 : left + 300;
      const rot = onRight ? 90 : 270;
      let y = top + 350;
      for (const kind of ["fridge", "sink", "hob"]) {
        const entry = catalogueEntry(kind)!;
        if (y + entry.width > bottom - 900) break;
        put(kind, x, y + entry.width / 2, rot);
        y += entry.width + 50;
      }
    } else if (c.type === "bath") {
      if (c.w >= 1400 && c.h >= 1300) {
        put("toilet", left + 350, top + 350, 0);
        put("basin", right - 380, top + 225, 0);
      }
    }
  }
}

// Ready-made briefs offered as starting points
export const PRESET_BRIEFS: {
  key: string;
  label: string;
  note: string;
  brief: Brief;
}[] = [
  {
    key: "1bhk",
    label: "1 bedroom",
    note: "8.0 × 7.0 m",
    brief: {
      width: 8000,
      depth: 7000,
      bedrooms: 1,
      bathrooms: 1,
      dining: false,
      store: false,
    },
  },
  {
    key: "2bhk",
    label: "2 bedroom",
    note: "11.0 × 9.0 m",
    brief: {
      width: 11000,
      depth: 9000,
      bedrooms: 2,
      bathrooms: 1,
      dining: true,
      store: false,
    },
  },
  {
    key: "3bhk",
    label: "3 bedroom",
    note: "14.5 × 9.5 m",
    brief: {
      width: 14500,
      depth: 9500,
      bedrooms: 3,
      bathrooms: 2,
      dining: true,
      store: false,
    },
  },
  {
    key: "4bhk",
    label: "4 bedroom",
    note: "18.0 × 10.0 m",
    brief: {
      width: 18000,
      depth: 10000,
      bedrooms: 4,
      bathrooms: 3,
      dining: true,
      store: true,
    },
  },
];
