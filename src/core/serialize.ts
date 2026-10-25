import { z } from "zod";
import { SCHEMA_VERSION, type Plan } from "./model";

// The file format is the plan itself, tagged so other files are rejected
type PlanFile = {
  app: "naksa";
  version: number;
  plan: Plan;
};

export function serializePlan(plan: Plan): string {
  const file: PlanFile = { app: "naksa", version: SCHEMA_VERSION, plan };
  return JSON.stringify(file, null, 2);
}

export class PlanFileError extends Error {}

// Schemas for what a file has to look like.
// looseObject keeps any extra fields instead of stripping them, so nothing in a file is lost.
// z.number() already rejects NaN and Infinity.
const vecSchema = z.looseObject({ x: z.number(), y: z.number() });

const fileSchema = z.looseObject({
  app: z.literal("naksa"),
  plan: z.looseObject({}),
});

const entry = <T extends z.core.$ZodLooseShape>(shape: T) =>
  z.looseObject({ id: z.string(), ...shape });

const wallSchema = entry({
  a: vecSchema,
  b: vecSchema,
  thickness: z.number(),
  height: z.number(),
});

const openingSchema = entry({
  kind: z.enum(["door", "window"]),
  wallId: z.string(),
  offset: z.number(),
  width: z.number(),
  height: z.number(),
  sill: z.number(),
});

const itemSchema = entry({
  kind: z.string(),
  position: vecSchema,
  rotation: z.number(),
  width: z.number(),
  depth: z.number(),
});

const dimensionSchema = entry({
  a: vecSchema,
  b: vecSchema,
  offset: z.number(),
});
const labelSchema = entry({ position: vecSchema, text: z.string() });
const roomSchema = entry({
  anchor: vecSchema,
  name: z.string(),
  finish: z.string(),
});

// A missing list is empty, anything else that isn't a list makes the whole file invalid
const listSchema = z.array(z.unknown()).optional();

// Keeps the entries of a list that match the schema, as they are in the file
function list<T extends z.ZodType>(
  source: Record<string, unknown>,
  key: string,
  schema: T
): z.infer<T>[] {
  const value = listSchema.safeParse(source[key]);
  if (!value.success) throw new PlanFileError(`"${key}" should be a list.`);
  return (value.data ?? []).filter(
    (item): item is z.infer<T> => schema.safeParse(item).success
  );
}

// Reads a plan file. Broken entries are dropped,
// a file that isn't a Naksa plan at all throws a PlanFileError with a message for the user.
export function parsePlan(text: string): Plan {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new PlanFileError("This file is not valid JSON.");
  }

  const file = fileSchema.safeParse(data);
  if (!file.success) throw new PlanFileError("This file is not a Naksa plan.");

  // A missing version counts as newer too, there's no way to know how to read it
  const version = z.number().max(SCHEMA_VERSION).safeParse(file.data.version);
  if (!version.success)
    throw new PlanFileError("This plan was saved by a newer version of Naksa.");

  const p = file.data.plan;
  const walls = list(p, "walls", wallSchema);
  const wallIds = new Set(walls.map((w) => w.id));

  return {
    version: SCHEMA_VERSION,
    name:
      typeof p.name === "string" && p.name.trim() ? p.name : "Untitled plan",
    walls,
    // A door or window must sit on a wall that is in the file
    openings: list(p, "openings", openingSchema)
      .filter((o) => wallIds.has(o.wallId))
      .map((o) => ({
        ...o,
        hinge: o.hinge === "end" ? "end" : "start",
        swing: o.swing === "right" ? "right" : "left",
      })),
    items: list(p, "items", itemSchema),
    dimensions: list(p, "dimensions", dimensionSchema),
    labels: list(p, "labels", labelSchema),
    rooms: list(p, "rooms", roomSchema),
  } as unknown as Plan;
}
