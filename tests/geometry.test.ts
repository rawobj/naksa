import { describe, expect, test } from "bun:test";
import {
  insetPolygon,
  intersectLines,
  intersectSegments,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  projectOnSegment,
  signedArea,
  vec,
} from "../src/core/geometry";

const square = [vec(0, 0), vec(4000, 0), vec(4000, 3000), vec(0, 3000)];

describe("segments", () => {
  test("projection clamps to the ends", () => {
    const hit = projectOnSegment(vec(5000, 200), vec(0, 0), vec(4000, 0));
    expect(hit.t).toBe(1);
    expect(hit.point).toEqual(vec(4000, 0));
  });

  test("projection measures perpendicular distance", () => {
    const hit = projectOnSegment(vec(1000, 250), vec(0, 0), vec(4000, 0));
    expect(hit.t).toBeCloseTo(0.25);
    expect(hit.distance).toBeCloseTo(250);
  });

  test("crossing segments intersect", () => {
    const hit = intersectSegments(
      vec(0, 0),
      vec(2000, 2000),
      vec(0, 2000),
      vec(2000, 0)
    );
    expect(hit?.point.x).toBeCloseTo(1000);
    expect(hit?.point.y).toBeCloseTo(1000);
  });

  test("a segment ending on another counts as a hit", () => {
    const hit = intersectSegments(
      vec(0, 0),
      vec(4000, 0),
      vec(1500, 0),
      vec(1500, 3000)
    );
    expect(hit?.t).toBeCloseTo(0.375);
    expect(hit?.u).toBeCloseTo(0);
  });

  test("parallel segments do not intersect", () => {
    expect(
      intersectSegments(vec(0, 0), vec(1, 0), vec(0, 1), vec(1, 1))
    ).toBeNull();
    expect(
      intersectLines(vec(0, 0), vec(1, 0), vec(0, 5), vec(2, 0))
    ).toBeNull();
  });
});

describe("polygons", () => {
  test("area and orientation", () => {
    expect(polygonArea(square)).toBe(12_000_000);
    expect(signedArea(square)).toBeGreaterThan(0);
    expect(signedArea([...square].reverse())).toBeLessThan(0);
  });

  test("centroid of a rectangle is its centre", () => {
    const c = polygonCentroid(square);
    expect(c.x).toBeCloseTo(2000);
    expect(c.y).toBeCloseTo(1500);
  });

  test("point containment", () => {
    expect(pointInPolygon(vec(10, 10), square)).toBe(true);
    expect(pointInPolygon(vec(4010, 10), square)).toBe(false);
  });

  test("inset uses a separate distance per edge", () => {
    const inner = insetPolygon(square, [115, 115, 115, 57.5]);
    expect(inner).not.toBeNull();
    expect(polygonArea(inner!)).toBeCloseTo((4000 - 115 - 57.5) * (3000 - 230));
  });

  test("inset works for either winding", () => {
    const inner = insetPolygon([...square].reverse(), [100, 100, 100, 100]);
    expect(polygonArea(inner!)).toBeCloseTo(3800 * 2800);
  });

  test("inset that swallows the polygon returns null", () => {
    expect(insetPolygon(square, [2000, 2000, 2000, 2000])).toBeNull();
  });
});
