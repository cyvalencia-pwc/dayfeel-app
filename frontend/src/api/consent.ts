import { identity } from "./client";
import type { I } from "../types";
export const consentApi = {
  save: (body: I["Consent"]) =>
    identity.put<I["Consent"]>("/me/consent", body).then((r) => r.data),
};
