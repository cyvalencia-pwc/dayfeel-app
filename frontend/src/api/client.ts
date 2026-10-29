import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuth } from "../store/auth";
import { handleCrisis } from "../store/crisis";
import type { I } from "../types";
export const identityBase =
  import.meta.env.VITE_IDENTITY_API || "/api/identity";
export const contentBase = import.meta.env.VITE_CONTENT_API || "/api/content";
export const publicApi = axios.create({
  baseURL: identityBase,
  timeout: 15000,
});
publicApi.interceptors.response.use(
  async (response) => {
    await handleCrisis(response.data);
    return response;
  },
  async (error) => {
    await handleCrisis(error.response?.data);
    throw error;
  },
);
type Config = InternalAxiosRequestConfig & {
  retried?: boolean;
  generation?: number;
};
let refresh: { generation: number; promise: Promise<string> } | null = null;
export function refreshAccess(): Promise<string> {
  const state = useAuth.getState();
  if (!state.tokens) return Promise.reject(new Error("Please sign in again."));
  if (refresh?.generation === state.generation) return refresh.promise;
  const generation = state.generation;
  const promise = publicApi
    .post<I["Tokens"]>("/auth/refresh", {
      refreshToken: state.tokens.refreshToken,
    })
    .then((r) => {
      if (useAuth.getState().generation !== generation)
        throw new Error("Session changed.");
      useAuth.getState().rotate(r.data);
      return r.data.accessToken;
    })
    .catch((error) => {
      if (useAuth.getState().generation === generation)
        useAuth.getState().logout();
      throw error;
    })
    .finally(() => {
      if (refresh?.generation === generation) refresh = null;
    });
  refresh = { generation, promise };
  return promise;
}
export function createApi(baseURL: string) {
  const api = axios.create({ baseURL, timeout: 30000 });
  api.interceptors.request.use((config: Config) => {
    const auth = useAuth.getState();
    config.generation ??= auth.generation;
    if (config.generation !== auth.generation)
      throw new Error("Session changed.");
    if (auth.tokens)
      config.headers.set("Authorization", `Bearer ${auth.tokens.accessToken}`);
    return config;
  });
  api.interceptors.response.use(
    async (response) => {
      if (
        (response.config as Config).generation !== useAuth.getState().generation
      )
        throw new Error("Session changed.");
      await handleCrisis(response.data);
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as Config | undefined;
      if (config?.generation !== useAuth.getState().generation) throw error;
      await handleCrisis(error.response?.data);
      if (
        !config ||
        error.response?.status !== 401 ||
        config.generation !== useAuth.getState().generation
      )
        throw error;
      if (config.retried) {
        useAuth.getState().logout();
        throw error;
      }
      config.retried = true;
      // Another concurrent response may already have refreshed this old token.
      if (
        config.headers.get("Authorization") ===
        `Bearer ${useAuth.getState().tokens?.accessToken}`
      )
        await refreshAccess();
      return api.request(config);
    },
  );
  return api;
}
export const identity = createApi(identityBase);
export const content = createApi(contentBase);
