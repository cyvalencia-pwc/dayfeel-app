import { identity } from "./client";
import type { I } from "../types";
export const privacyApi = {
  export: () =>
    identity.post<I["PrivacyRequest"]>("/me/exports").then((r) => r.data),
  deleteAccount: () =>
    identity.post<I["PrivacyRequest"]>("/me/deletion").then((r) => r.data),
  status: (id: string) =>
    identity
      .get<I["PrivacyRequest"]>(`/me/privacy-requests/${id}`)
      .then((r) => r.data),
};
