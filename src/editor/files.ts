import type { Plan } from "@/core/model";
import { parsePlan, serializePlan } from "@/core/serialize";

const STORAGE_KEY = "naksa.plan";

// The plan saved in this browser, if there is a readable one
export function loadSaved(): Plan | null {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    return text ? parsePlan(text) : null;
  } catch {
    return null;
  }
}

export function saveLocal(plan: Plan): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializePlan(plan));
  } catch {
    // Storage can be full or blocked; the plan is still open and can be saved to a file
  }
}

export function fileName(plan: Plan, extension: string): string {
  const base = plan.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "plan"}.${extension}`;
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadPlan(plan: Plan): void {
  download(
    new Blob([serializePlan(plan)], { type: "application/json" }),
    fileName(plan, "naksa.json")
  );
}

// Asks for a plan file and reads it. Resolves null if the user cancels.
export function pickPlanFile(): Promise<Plan | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(parsePlan(await file.text()));
      } catch (error) {
        reject(error);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
