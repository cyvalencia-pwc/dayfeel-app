import { create } from "zustand";
export const useUI = create<{
  notice: string;
  announce: (notice: string) => void;
}>((set) => ({ notice: "", announce: (notice) => set({ notice }) }));
