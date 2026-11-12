import { describe, expect, test } from "bun:test";
import {
  DEFAULT_BRIEF,
  generatePlan,
  PRESET_BRIEFS,
  VARIANT_COUNT,
} from "../src/core/generate";
import { detectRooms } from "../src/core/rooms";
import { wallLength } from "../src/core/walls";

describe("generator", () => {
  for (const preset of PRESET_BRIEFS) {
    for (let variant = 0; variant < VARIANT_COUNT; variant++) {
      test(`${preset.label}, layout ${variant + 1}`, () => {
        const plan = generatePlan(preset.brief, variant);
        const rooms = detectRooms(plan);
        const { bedrooms, bathrooms, dining, store } = preset.brief;

        // Every room asked for exists and has a name
        expect(rooms.filter((r) => r.name.startsWith("Bedroom"))).toHaveLength(
          bedrooms
        );
        expect(rooms.filter((r) => r.name.startsWith("Bath"))).toHaveLength(
          bathrooms
        );
        expect(rooms.some((r) => r.name === "Dining")).toBe(dining);
        expect(rooms.some((r) => r.name === "Store")).toBe(store);
        expect(rooms.every((r) => r.tag !== null)).toBe(true);

        // Every room can be entered
        for (const room of rooms) {
          const doors = plan.openings.filter(
            (o) => o.kind === "door" && room.wallIds.includes(o.wallId)
          );
          expect(doors.length).toBeGreaterThan(0);
        }

        // Openings sit fully within their walls
        for (const o of plan.openings) {
          const wall = plan.walls.find((w) => w.id === o.wallId)!;
          expect(o.offset - o.width / 2).toBeGreaterThanOrEqual(0);
          expect(o.offset + o.width / 2).toBeLessThanOrEqual(wallLength(wall));
        }

        // Furniture stays inside the building
        for (const item of plan.items) {
          expect(item.position.x).toBeGreaterThan(0);
          expect(item.position.x).toBeLessThan(preset.brief.width);
          expect(item.position.y).toBeGreaterThan(0);
          expect(item.position.y).toBeLessThan(preset.brief.depth);
        }
      });
    }
  }

  test("out-of-range briefs are clamped, not rejected", () => {
    const plan = generatePlan(
      { ...DEFAULT_BRIEF, width: 100, bedrooms: 40 },
      0
    );
    expect(
      detectRooms(plan).filter((r) => r.name.startsWith("Bedroom"))
    ).toHaveLength(4);
  });
});
