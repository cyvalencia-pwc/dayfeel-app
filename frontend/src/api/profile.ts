import { identity } from "./client";
import type { I } from "../types";
export const profileApi = {
  get: () => identity.get<I["Profile"]>("/me").then((r) => r.data),
  session: () => identity.get<I["Session"]>("/me/session").then((r) => r.data),
  alias: (alias: string) =>
    identity.patch<I["Profile"]>("/me", { alias }).then((r) => r.data),
  onboard: () => identity.post("/me/onboarding", { acknowledged: true }),
};
