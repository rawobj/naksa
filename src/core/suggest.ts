import type { Plan } from "./model";
import { formatArea, type Room } from "./rooms";

export type Suggestion = {
  id: string;
  level: "fix" | "consider"; // "fix" blocks a usable home; "consider" is advice
  text: string;
  roomKey?: string; // room to select when the suggestion is opened
};

const isWet = (name: string) => /bath|toilet|wc|wash/i.test(name);
const isService = (name: string) =>
  /store|passage|hall|corridor|lobby|utility/i.test(name);

// Looks over a plan for things someone is likely to have missed.
// These are just hints, not a building code check.
export function suggest(plan: Plan, rooms: readonly Room[]): Suggestion[] {
  const out: Suggestion[] = [];
  if (plan.walls.length === 0) return out;

  if (rooms.length === 0) {
    out.push({
      id: "no-rooms",
      level: "fix",
      text: "No closed rooms yet. Join the walls end to end so they enclose a space.",
    });
    return out;
  }

  for (const room of rooms) {
    const openings = plan.openings.filter((o) =>
      room.wallIds.includes(o.wallId)
    );
    const doors = openings.filter((o) => o.kind === "door");
    const windows = openings.filter((o) => o.kind === "window");
    const m2 = room.area / 1_000_000;

    if (doors.length === 0) {
      out.push({
        id: `door-${room.key}`,
        level: "fix",
        text: `${room.name} has no door.`,
        roomKey: room.key,
      });
    }
    if (windows.length === 0 && !isService(room.name)) {
      out.push({
        id: `window-${room.key}`,
        level: "consider",
        text: isWet(room.name)
          ? `${room.name} has no window. Plan for an exhaust fan or add a small high window.`
          : `${room.name} has no window for daylight and air.`,
        roomKey: room.key,
      });
    }
    if (/bed/i.test(room.name) && m2 < 7.5) {
      out.push({
        id: `small-${room.key}`,
        level: "consider",
        text: `${room.name} is ${formatArea(room.area)}. A bedroom is hard to furnish under 7.5 m².`,
        roomKey: room.key,
      });
    }
    if (isWet(room.name) && m2 < 2.2) {
      out.push({
        id: `small-${room.key}`,
        level: "consider",
        text: `${room.name} is ${formatArea(room.area)}. A toilet, basin and shower need about 2.2 m².`,
        roomKey: room.key,
      });
    }
    for (const door of doors) {
      if (door.width < 700) {
        out.push({
          id: `narrow-${door.id}`,
          level: "consider",
          text: `A door into ${room.name} is ${door.width} mm wide. 750 mm is a practical minimum.`,
          roomKey: room.key,
        });
      }
    }
  }

  const bounding = new Set(rooms.flatMap((room) => room.wallIds));
  const loose = plan.walls.filter((wall) => !bounding.has(wall.id)).length;
  if (loose > 0) {
    out.push({
      id: "loose",
      level: "consider",
      text:
        loose === 1
          ? "1 wall does not enclose a room. Join it to another wall or remove it."
          : `${loose} walls do not enclose a room. Join them to other walls or remove them.`,
    });
  }

  // Report each narrow door once even though two rooms share it
  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}
