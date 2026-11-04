import {
  angleOf,
  insetPolygon,
  intersectSegments,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  projectOnSegment,
  signedArea,
  sub,
  type Vec,
} from "./geometry";
import type { Plan, RoomTag, Wall } from "./model";

export type Room = {
  key: string; // stable for as long as the room keeps the same corners
  outline: Vec[]; // outline along the wall centrelines
  inner: Vec[]; // outline along the inside faces of the walls; what you can stand on
  area: number; // floor area inside the walls, in square millimetres
  centroid: Vec;
  wallIds: string[]; // ids of the walls that bound the room
  tag: RoomTag | null;
  name: string;
  finish: string;
};

// Points closer than this, in millimetres, are one graph node
const NODE_GRID = 1;

type Edge = {
  from: number;
  to: number;
  wallId: string;
  thickness: number;
  angle: number;
  used: boolean;
};

// Finds the closed rooms of a plan.
// Walls are cut wherever they cross or touch, which gives a planar graph,
// and every bounded face of that graph is a room.
export function detectRooms(plan: Pick<Plan, "walls" | "rooms">): Room[] {
  const nodes: Vec[] = [];
  const index = new Map<string, number>();

  // Function to get the node at a point, points within NODE_GRID share one node
  const nodeFor = (p: Vec): number => {
    const key = `${Math.round(p.x / NODE_GRID)},${Math.round(p.y / NODE_GRID)}`;
    let i = index.get(key);
    if (i === undefined) {
      i = nodes.length;
      nodes.push({
        x: Math.round(p.x / NODE_GRID) * NODE_GRID,
        y: Math.round(p.y / NODE_GRID) * NODE_GRID,
      });
      index.set(key, i);
    }
    return i;
  };

  // Cut every wall at each point where another wall meets or crosses it
  const pieces: { a: number; b: number; wall: Wall }[] = [];
  for (const wall of plan.walls) {
    const cuts: number[] = [0, 1];
    for (const other of plan.walls) {
      if (other === wall) continue;
      const hit = intersectSegments(wall.a, wall.b, other.a, other.b);
      if (hit) cuts.push(hit.t);
      for (const end of [other.a, other.b]) {
        const proj = projectOnSegment(end, wall.a, wall.b);
        if (proj.distance <= NODE_GRID) cuts.push(proj.t);
      }
    }
    cuts.sort((p, q) => p - q);
    let prev = nodeFor(wall.a);
    for (const t of cuts.slice(1)) {
      const next = nodeFor({
        x: wall.a.x + (wall.b.x - wall.a.x) * t,
        y: wall.a.y + (wall.b.y - wall.a.y) * t,
      });
      if (next !== prev) pieces.push({ a: prev, b: next, wall });
      prev = next;
    }
  }

  // 1. Drop duplicate pieces (two walls drawn over each other)
  const seen = new Set<string>();
  let live = pieces.filter((p) => {
    const key = p.a < p.b ? `${p.a}-${p.b}` : `${p.b}-${p.a}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // 2. Strip dead ends, a node with one edge can't be part of a room.
  // Removing one can make a new dead end so keep going until nothing changes.
  for (;;) {
    const degree = new Map<number, number>();
    for (const p of live) {
      degree.set(p.a, (degree.get(p.a) ?? 0) + 1);
      degree.set(p.b, (degree.get(p.b) ?? 0) + 1);
    }
    const kept = live.filter(
      (p) => degree.get(p.a)! > 1 && degree.get(p.b)! > 1
    );
    if (kept.length === live.length) break;
    live = kept;
  }

  // 3. Every piece becomes two directed edges (one each way), grouped by start node
  const outgoing = new Map<number, Edge[]>();
  for (const p of live) {
    for (const [from, to] of [
      [p.a, p.b],
      [p.b, p.a],
    ] as const) {
      const edge: Edge = {
        from,
        to,
        wallId: p.wall.id,
        thickness: p.wall.thickness,
        angle: angleOf(sub(nodes[to]!, nodes[from]!)),
        used: false,
      };
      const list = outgoing.get(from);
      if (list) list.push(edge);
      else outgoing.set(from, [edge]);
    }
  }
  // Sort the edges around each node by angle so "next edge" means the next one round
  for (const list of outgoing.values()) list.sort((p, q) => p.angle - q.angle);

  // 4. Trace faces. Every directed edge belongs to exactly one face.
  const rooms: Room[] = [];
  for (const list of outgoing.values()) {
    for (const start of list) {
      if (start.used) continue;
      const loop: Edge[] = [];
      let edge = start;
      // Walk the face by always taking the next edge after the one we came in on
      while (!edge.used) {
        edge.used = true;
        loop.push(edge);
        const spokes = outgoing.get(edge.to)!;
        const back = spokes.findIndex((s) => s.to === edge.from);
        edge = spokes[(back + 1) % spokes.length]!;
      }
      const outline = loop.map((e) => nodes[e.from]!);
      // With this turning rule rooms come out anticlockwise on screen (negative area)
      // and the outside of the building comes out clockwise, so skip that one
      if (outline.length < 3 || signedArea(outline) >= -1) continue;
      const inner = insetPolygon(
        outline,
        loop.map((e) => e.thickness / 2)
      );
      if (!inner) continue;
      rooms.push({
        key: roomKey(outline),
        outline,
        inner,
        area: polygonArea(inner),
        centroid: polygonCentroid(inner),
        wallIds: [...new Set(loop.map((e) => e.wallId))],
        tag: null,
        name: "",
        finish: "",
      });
    }
  }

  // 5. Sort top to bottom, left to right, so unnamed rooms get stable numbers
  rooms.sort(
    (p, q) => p.centroid.y - q.centroid.y || p.centroid.x - q.centroid.x
  );
  // 6. Give each room the saved tag whose anchor point is inside it
  const free = [...plan.rooms];
  let unnamed = 0;
  for (const room of rooms) {
    const at = free.findIndex((tag) =>
      pointInPolygon(tag.anchor, room.outline)
    );
    const tag = at >= 0 ? free.splice(at, 1)[0]! : null;
    room.tag = tag;
    room.name = tag?.name ?? `Room ${++unnamed}`;
    room.finish = tag?.finish ?? "";
  }
  return rooms;
}

// Sorted corners, so the key doesn't depend on where the walk started
function roomKey(outline: readonly Vec[]): string {
  const parts = outline
    .map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)
    .sort();
  return parts.join("|");
}

// The room containing a point, if any
export function roomAt(point: Vec, rooms: readonly Room[]): Room | null {
  return rooms.find((room) => pointInPolygon(point, room.outline)) ?? null;
}

// Formats an area in square millimetres as square metres
export function formatArea(area: number): string {
  return `${(area / 1_000_000).toFixed(1)} m²`;
}
