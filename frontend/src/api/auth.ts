import { identity, publicApi } from "./client";
import type { I } from "../types";
export const authApi = {
  login: (body: I["Credentials"]) =>
    publicApi.post<I["Tokens"]>("/auth/login", body).then((r) => r.data),
  register: (body: I["Credentials"]) =>
    publicApi.post<I["Tokens"]>("/auth/register", body).then((r) => r.data),
  logout: () => identity.post("/auth/logout"),
};
