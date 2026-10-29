import { create } from "zustand";
import type { C } from "../types";
type Item = { support: C["CrisisSupport"]; resolve: () => void };
export const useCrisis = create<{
  queue: Item[];
  open: (support: C["CrisisSupport"]) => Promise<void>;
  acknowledge: () => void;
}>((set) => ({
  queue: [],
  open: (support) =>
    new Promise<void>((resolve) =>
      set((s) => ({ queue: [...s.queue, { support, resolve }] })),
    ),
  acknowledge: () =>
    set((s) => {
      s.queue[0]?.resolve();
      return { queue: s.queue.slice(1) };
    }),
}));
export function crisisPayload(
  data: unknown,
  depth = 0,
): C["CrisisSupport"] | null {
  if (!data || typeof data !== "object" || depth > 12) return null;
  const value = data as Record<string, unknown>;
  if (
    value.crisisDetected === true &&
    typeof value.message === "string" &&
    Array.isArray(value.resources)
  )
    return value as C["CrisisSupport"];
  for (const child of Object.values(value)) {
    const found = crisisPayload(child, depth + 1);
    if (found) return found;
  }
  return null;
}
export async function handleCrisis(data: unknown) {
  const support = crisisPayload(data);
  if (support) await useCrisis.getState().open(support);
}
