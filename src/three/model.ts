import * as THREE from "three";
import { catalogueEntry, finishFor, type ItemGroup } from "@/core/catalogue";
import type { Plan, Wall } from "@/core/model";
import { detectRooms } from "@/core/rooms";
import { openingsOn, wallLength } from "@/core/walls";
import { almostEqual } from "@/core/geometry";

// Millimetres to scene units (metres)
const M = 0.001;

export type ModelOptions = {
  // Cut every wall off at this height in millimetres, to see inside
  cutHeight: number | null;
  furniture: boolean;
};

export type Model = {
  group: THREE.Group;
  // Centre of the building on the ground, and its largest horizontal size, in metres
  centre: THREE.Vector3;
  size: number;
  dispose(): void;
};

const FURNITURE: Record<ItemGroup, number> = {
  Living: 0xb9a78b,
  Bedroom: 0xe9e3d6,
  Kitchen: 0xd8d4cb,
  Dining: 0xb98f63,
  Bath: 0xf7f7f4,
  Other: 0xa9b3a0,
};

// Builds the 3D model of a plan: floors, walls with their openings, glazing, doors and furniture
export function buildModel(plan: Plan, options: ModelOptions): Model {
  const group = new THREE.Group();
  // Every geometry and material made here is kept so dispose() can free the GPU memory later
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(thing: T): T => {
    owned.push(thing);
    return thing;
  };

  const wallSide = keep(
    new THREE.MeshStandardMaterial({ color: 0xfbf8f1, roughness: 0.92 })
  );
  const wallCap = keep(
    new THREE.MeshStandardMaterial({ color: 0x1d2a44, roughness: 0.8 })
  );
  // Box faces are +x, -x, +y, -y, +z, -z, so index 2 (top) gets the dark cap colour
  const wallMaterials = [
    wallSide,
    wallSide,
    wallCap,
    wallSide,
    wallSide,
    wallSide,
  ];
  const glass = keep(
    new THREE.MeshStandardMaterial({
      color: 0xa9cfe0,
      roughness: 0.15,
      transparent: true,
      opacity: 0.45,
    })
  );
  const doorMaterial = keep(
    new THREE.MeshStandardMaterial({ color: 0xa97c50, roughness: 0.7 })
  );

  const box = (
    w: number,
    h: number,
    d: number,
    material: THREE.Material | THREE.Material[],
    shadow = true
  ) => {
    const mesh = new THREE.Mesh(
      keep(new THREE.BoxGeometry(w * M, h * M, d * M)),
      material
    );
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    return mesh;
  };

  // Floors
  for (const room of detectRooms(plan)) {
    const shape = new THREE.Shape(
      room.outline.map((p) => new THREE.Vector2(p.x * M, p.y * M))
    );
    const geometry = keep(new THREE.ShapeGeometry(shape));
    geometry.rotateX(Math.PI / 2);
    const material = keep(
      new THREE.MeshStandardMaterial({
        color: finishFor(room.finish).color,
        roughness: 0.85,
        side: THREE.DoubleSide,
      })
    );
    const floor = new THREE.Mesh(geometry, material);
    floor.position.y = 0.005;
    floor.receiveShadow = true;
    group.add(floor);
  }

  // Walls. Each wall is a row of boxes along it, with gaps for the openings.
  const joined = (wall: Wall, end: "a" | "b") =>
    plan.walls.some(
      (other) =>
        other !== wall &&
        (almostEqual(other.a, wall[end], 1) ||
          almostEqual(other.b, wall[end], 1))
    );
  for (const wall of plan.walls) {
    const len = wallLength(wall);
    if (len < 1) continue;
    const top = options.cutHeight
      ? Math.min(wall.height, options.cutHeight)
      : wall.height;
    // A group placed at the wall's start and turned along it, so pieces only need x positions.
    // Plan y becomes 3D z, and the angle is negated because 3D rotation goes the other way.
    const frame = new THREE.Group();
    frame.position.set(wall.a.x * M, 0, wall.a.y * M);
    frame.rotation.y = -Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
    group.add(frame);

    // A box for part of this wall, from "from" to "to" along it, between two heights
    const piece = (
      from: number,
      to: number,
      y0: number,
      y1: number,
      material: THREE.Material | THREE.Material[],
      depth = wall.thickness
    ) => {
      if (to - from < 1 || y1 - y0 < 1) return;
      const mesh = box(to - from, y1 - y0, depth, material);
      mesh.position.set(((from + to) / 2) * M, ((y0 + y1) / 2) * M, 0);
      frame.add(mesh);
      return mesh;
    };

    // Run a little past joined ends so corners close up
    const start = joined(wall, "a") ? -wall.thickness / 2 : 0;
    const finish = len + (joined(wall, "b") ? wall.thickness / 2 : 0);
    let cursor = start;
    for (const o of openingsOn(wall, plan.openings)) {
      const from = Math.max(0, o.offset - o.width / 2);
      const to = Math.min(len, o.offset + o.width / 2);
      // Full height wall up to the opening, then below the sill and above the head
      piece(cursor, from, 0, top, wallMaterials);
      cursor = to;
      const head = o.sill + o.height;
      if (o.sill > 0) piece(from, to, 0, Math.min(o.sill, top), wallMaterials);
      if (head < top) piece(from, to, head, top, wallMaterials);
      if (o.kind === "window") {
        const pane = piece(from, to, o.sill, Math.min(head, top), glass, 30);
        if (pane) pane.castShadow = false;
      } else if (!options.cutHeight || options.cutHeight >= o.height) {
        // The leaf stands open at a right angle, as it is drawn on the plan
        const side = o.swing === "left" ? -1 : 1;
        const hinge = o.hinge === "start" ? from : to;
        const leaf = box(40, o.height, o.width, doorMaterial);
        leaf.position.set(
          hinge * M,
          (o.height / 2) * M,
          side * (wall.thickness / 2 + o.width / 2) * M
        );
        frame.add(leaf);
      }
    }
    piece(cursor, finish, 0, top, wallMaterials);
  }

  // Furniture as simple massing blocks
  if (options.furniture) {
    const materials = new Map<ItemGroup, THREE.Material>();
    for (const item of plan.items) {
      const entry = catalogueEntry(item.kind);
      if (!entry || entry.kind === "stairs") continue;
      let material = materials.get(entry.group);
      if (!material) {
        material = keep(
          new THREE.MeshStandardMaterial({
            color: FURNITURE[entry.group],
            roughness: 0.85,
          })
        );
        materials.set(entry.group, material);
      }
      const height = options.cutHeight
        ? Math.min(entry.height, options.cutHeight)
        : entry.height;
      const mesh = box(item.width, height, item.depth, material);
      mesh.position.set(
        item.position.x * M,
        (height / 2) * M + 0.006,
        item.position.y * M
      );
      mesh.rotation.y = (-item.rotation * Math.PI) / 180;
      group.add(mesh);
    }
  }

  const bounds = new THREE.Box3().setFromObject(group);
  const centre = new THREE.Vector3();
  const extent = new THREE.Vector3(8, 0, 8);
  if (!bounds.isEmpty()) {
    bounds.getCenter(centre);
    bounds.getSize(extent);
  }
  centre.y = 0;

  return {
    group,
    centre,
    size: Math.max(extent.x, extent.z, 4),
    dispose: () => owned.forEach((thing) => thing.dispose()),
  };
}
