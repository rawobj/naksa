import { describe, expect, test } from "bun:test";
import { vec } from "../src/core/geometry";
import { makeOpening, makeWall, type Plan, emptyPlan } from "../src/core/model";
import { detectRooms } from "../src/core/rooms";
import { parsePlan, PlanFileError, serializePlan } from "../src/core/serialize";
import { wallSolids } from "../src/core/walls";

function box(): Plan {
  const plan = emptyPlan("Box");
  plan.walls = [
    makeWall(vec(0, 0), vec(6000, 0)),
    makeWall(vec(6000, 0), vec(6000, 4000)),
    makeWall(vec(6000, 4000), vec(0, 4000)),
    makeWall(vec(0, 4000), vec(0, 0)),
  ];
  return plan;
}

describe("room detection", () => {
  test("four walls make one room, measured inside the walls", () => {
    const rooms = detectRooms(box());
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.area).toBeCloseTo((6000 - 230) * (4000 - 230));
  });

  test("a partition that stops on other walls splits the room", () => {
    const plan = box();
    plan.walls.push(makeWall(vec(2500, 0), vec(2500, 4000), 115));
    const rooms = detectRooms(plan);
    expect(rooms).toHaveLength(2);
    const total = rooms.reduce((sum, r) => sum + r.area, 0);
    expect(total).toBeCloseTo((6000 - 230 - 115) * (4000 - 230));
  });

  test("a wall that leads nowhere does not make a room", () => {
    const plan = box();
    plan.walls.push(makeWall(vec(2500, 0), vec(2500, 1500), 115));
    expect(detectRooms(plan)).toHaveLength(1);
  });

  test("an open outline has no rooms", () => {
    const plan = box();
    plan.walls.pop();
    expect(detectRooms(plan)).toHaveLength(0);
  });

  test("a tag names the room its anchor sits in", () => {
    const plan = box();
    plan.walls.push(makeWall(vec(2500, 0), vec(2500, 4000), 115));
    plan.rooms.push({
      id: "r1",
      anchor: vec(4000, 2000),
      name: "Living",
      finish: "oak",
    });
    const rooms = detectRooms(plan);
    expect(rooms.find((r) => r.centroid.x > 2500)!.name).toBe("Living");
    expect(rooms.find((r) => r.centroid.x < 2500)!.name).toBe("Room 1");
  });
});

describe("wall solids", () => {
  test("corners are mitred so the outline is the outer rectangle", () => {
    const solids = wallSolids(box());
    const xs = solids.flatMap((s) => s.points.map((p) => p.x));
    const ys = solids.flatMap((s) => s.points.map((p) => p.y));
    expect(Math.min(...xs)).toBeCloseTo(-115);
    expect(Math.max(...xs)).toBeCloseTo(6115);
    expect(Math.min(...ys)).toBeCloseTo(-115);
    expect(Math.max(...ys)).toBeCloseTo(4115);
  });

  test("an opening breaks its wall into two solids", () => {
    const plan = box();
    plan.openings.push(makeOpening("door", plan.walls[0]!.id, 3000));
    expect(wallSolids(plan)).toHaveLength(5);
  });
});

describe("plan files", () => {
  test("a plan survives a round trip", () => {
    const plan = box();
    plan.openings.push(makeOpening("window", plan.walls[1]!.id, 2000));
    expect(parsePlan(serializePlan(plan))).toEqual(plan);
  });

  test("other files are rejected with a readable message", () => {
    expect(() => parsePlan("{")).toThrow(PlanFileError);
    expect(() => parsePlan('{"app":"other"}')).toThrow("not a Naksa plan");
  });

  test("openings on missing walls are dropped", () => {
    const plan = box();
    plan.openings.push(makeOpening("door", "gone", 100));
    expect(parsePlan(serializePlan(plan)).openings).toHaveLength(0);
  });
});
