import type { Vec } from "./geometry";

// Every length in the plan is in millimetres.
// Rooms are not stored, they are found from the walls every time (see rooms.ts).
// Only the name and floor finish given to a room are saved, pinned to a point inside it.

export type Id = string;

export const SCHEMA_VERSION = 1;

export type Wall = {
  id: Id;
  a: Vec; // centreline start
  b: Vec; // centreline end
  thickness: number;
  height: number;
};

export type OpeningKind = "door" | "window";

export type Opening = {
  id: Id;
  kind: OpeningKind;
  wallId: Id;
  offset: number; // distance along the wall from a to the centre of the opening
  width: number;
  height: number; // clear height of the opening
  sill: number; // height of the bottom edge from the floor, 0 for doors
  hinge: "start" | "end"; // doors only, which jamb has the hinge
  swing: "left" | "right"; // doors only, which side of the wall the door opens into
};

export type Item = {
  id: Id;
  kind: string; // key into the furniture catalogue
  position: Vec; // centre of the item
  rotation: number; // rotation in degrees, clockwise on screen
  width: number;
  depth: number;
};

export type Dimension = {
  id: Id;
  a: Vec;
  b: Vec;
  offset: number; // perpendicular distance from the measured line to the dimension line
};

export type Label = {
  id: Id;
  position: Vec;
  text: string;
};

export type RoomTag = {
  id: Id;
  anchor: Vec; // a point inside the room this tag names
  name: string;
  finish: string; // key into the floor finish catalogue
};

export type Plan = {
  version: number;
  name: string;
  walls: Wall[];
  openings: Opening[];
  items: Item[];
  dimensions: Dimension[];
  labels: Label[];
  rooms: RoomTag[];
};

export const DEFAULTS = {
  exteriorThickness: 230,
  interiorThickness: 115,
  wallHeight: 2850,
  doorWidth: 900,
  doorHeight: 2100,
  windowWidth: 1200,
  windowHeight: 1200,
  windowSill: 900,
} as const;

let counter = 0;

// Random part keeps ids from clashing across files, counter keeps them unique in a session
export function newId(prefix: string): Id {
  counter = (counter + 1) % 1679616;
  const random = Math.floor(Math.random() * 1679616);
  return `${prefix}_${random.toString(36).padStart(4, "0")}${counter.toString(36)}`;
}

export function emptyPlan(name = "Untitled plan"): Plan {
  return {
    version: SCHEMA_VERSION,
    name,
    walls: [],
    openings: [],
    items: [],
    dimensions: [],
    labels: [],
    rooms: [],
  };
}

export function makeWall(
  a: Vec,
  b: Vec,
  thickness: number = DEFAULTS.exteriorThickness
): Wall {
  return { id: newId("w"), a, b, thickness, height: DEFAULTS.wallHeight };
}

export function makeOpening(
  kind: OpeningKind,
  wallId: Id,
  offset: number,
  width?: number
): Opening {
  const door = kind === "door";
  return {
    id: newId(door ? "d" : "n"),
    kind,
    wallId,
    offset,
    width: width ?? (door ? DEFAULTS.doorWidth : DEFAULTS.windowWidth),
    height: door ? DEFAULTS.doorHeight : DEFAULTS.windowHeight,
    sill: door ? 0 : DEFAULTS.windowSill,
    hinge: "start",
    swing: "left",
  };
}
