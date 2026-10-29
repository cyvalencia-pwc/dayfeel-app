import { create } from "zustand";
import type { I } from "../types";
interface AuthState {
  tokens: I["Tokens"] | null;
  session: I["Session"] | null;
  generation: number;
  login: (tokens: I["Tokens"]) => void;
  rotate: (tokens: I["Tokens"]) => void;
  setSession: (session: I["Session"]) => void;
  logout: () => void;
}
const storageKey = "dayfeel.auth.v1";
function saveTokens(tokens: I["Tokens"] | null) {
  try {
    if (tokens) sessionStorage.setItem(storageKey, JSON.stringify(tokens));
    else sessionStorage.removeItem(storageKey);
  } catch {
    // Storage may be disabled by the browser; in-memory login still works.
  }
}
function restoreTokens(): I["Tokens"] | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      typeof value?.accessToken === "string" && value.accessToken.length > 0 &&
      typeof value.refreshToken === "string" && value.refreshToken.length > 0 &&
      value.tokenType === "Bearer" &&
      typeof value.expiresIn === "number" && value.expiresIn > 0
    ) return {
      accessToken: value.accessToken, refreshToken: value.refreshToken,
      tokenType: "Bearer", expiresIn: value.expiresIn,
    };
  } catch {
    // Ignore corrupt storage rather than preventing the application from loading.
  }
  saveTokens(null);
  return null;
}
// Tokens survive reloads in this tab. Roles/onboarding are always fetched afresh.
// Login/logout change the generation so late responses cannot restore a logout.
export const useAuth = create<AuthState>((set) => ({
  tokens: restoreTokens(),
  session: null,
  generation: 0,
  login: (tokens) => {
    saveTokens(tokens);
    set((s) => ({ tokens, session: null, generation: s.generation + 1 }));
  },
  rotate: (tokens) => {
    saveTokens(tokens);
    set({ tokens });
  },
  setSession: (session) => set({ session }),
  logout: () => {
    saveTokens(null);
    set((s) => ({ tokens: null, session: null, generation: s.generation + 1 }));
  },
}));
