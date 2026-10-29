import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { createApi, publicApi } from "./client";
import { useAuth } from "../store/auth";
const tokens = {
  accessToken: "old",
  refreshToken: "refresh",
  tokenType: "Bearer" as const,
  expiresIn: 900,
};
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({
  config,
  data,
  status,
  statusText: String(status),
  headers: new AxiosHeaders(),
});
const unauthorized = (config: InternalAxiosRequestConfig) =>
  Promise.reject(
    new AxiosError(
      "Unauthorized",
      "ERR_BAD_REQUEST",
      config,
      undefined,
      response(config, {}, 401),
    ),
  );
const original = publicApi.defaults.adapter;
beforeEach(() => useAuth.getState().login(tokens));
afterEach(() => {
  publicApi.defaults.adapter = original;
  useAuth.getState().logout();
});
test("concurrent 401s share one refresh and retry with the rotated access token", async () => {
  const api = createApi("/test");
  let refreshCalls = 0;
  let attempts = 0;
  publicApi.defaults.adapter = async (config) => {
    refreshCalls++;
    await new Promise((r) => setTimeout(r, 10));
    return response(config, {
      ...tokens,
      accessToken: "new",
      refreshToken: "rotated",
    });
  };
  api.defaults.adapter = async (config) => {
    attempts++;
    return config.headers.get("Authorization") === "Bearer new"
      ? response(config, { ok: true })
      : unauthorized(config);
  };
  const results = await Promise.all([api.get("/one"), api.get("/two")]);
  expect(results.every((r) => r.data.ok)).toBe(true);
  expect(refreshCalls).toBe(1);
  expect(attempts).toBe(4);
  expect(useAuth.getState().tokens?.refreshToken).toBe("rotated");
});
test("a request is retried only once, then authentication is cleared", async () => {
  const api = createApi("/test");
  let attempts = 0;
  let refreshCalls = 0;
  publicApi.defaults.adapter = async (config) => {
    refreshCalls++;
    return response(config, { ...tokens, accessToken: "new" });
  };
  api.defaults.adapter = (config) => {
    attempts++;
    return unauthorized(config);
  };
  await expect(api.get("/protected")).rejects.toBeInstanceOf(AxiosError);
  expect(attempts).toBe(2);
  expect(refreshCalls).toBe(1);
  expect(useAuth.getState().tokens).toBeNull();
});
test("refresh failure signs out without looping through the interceptor", async () => {
  const api = createApi("/test");
  publicApi.defaults.adapter = unauthorized;
  api.defaults.adapter = unauthorized;
  await expect(api.get("/protected")).rejects.toBeInstanceOf(AxiosError);
  expect(useAuth.getState().tokens).toBeNull();
});
test("a late refresh cannot restore a session after logout", async () => {
  const api = createApi("/test");
  let finish!: () => void;
  let started!: () => void;
  const ready = new Promise<void>((r) => (started = r));
  publicApi.defaults.adapter = async (config) => {
    started();
    await new Promise<void>((r) => (finish = r));
    return response(config, { ...tokens, accessToken: "new" });
  };
  api.defaults.adapter = unauthorized;
  const pending = api.get("/protected");
  const outcome = expect(pending).rejects.toThrow("Session changed");
  await ready;
  useAuth.getState().logout();
  finish();
  await outcome;
  expect(useAuth.getState().tokens).toBeNull();
});
