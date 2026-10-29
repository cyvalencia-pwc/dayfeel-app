const tokens = {
  accessToken: "access", refreshToken: "refresh", tokenType: "Bearer" as const, expiresIn: 900,
};
beforeEach(() => { sessionStorage.clear(); vi.resetModules(); });
afterEach(() => { sessionStorage.clear(); });

test("reload restores the rotated tokens but fetches permissions afresh", async () => {
  const { useAuth } = await import("./auth");
  useAuth.getState().login(tokens);
  useAuth.getState().setSession({ roles: ["ADMIN"], onboardingComplete: true });
  useAuth.getState().rotate({ ...tokens, accessToken: "new", refreshToken: "rotated" });
  vi.resetModules();
  const reloaded = (await import("./auth")).useAuth;
  expect(reloaded.getState().tokens?.refreshToken).toBe("rotated");
  expect(reloaded.getState().tokens?.accessToken).toBe("new");
  expect(reloaded.getState().session).toBeNull();
});

test("signing out stays signed out after reload", async () => {
  const { useAuth } = await import("./auth");
  useAuth.getState().login(tokens);
  useAuth.getState().logout();
  vi.resetModules();
  expect((await import("./auth")).useAuth.getState().tokens).toBeNull();
});

test.each(["invalid JSON", JSON.stringify({ accessToken: "fake", session: { roles: ["ADMIN"] } })])(
  "invalid stored credentials do not break startup", async (raw) => {
    sessionStorage.setItem("dayfeel.auth.v1", raw);
    expect((await import("./auth")).useAuth.getState().tokens).toBeNull();
    expect(sessionStorage.getItem("dayfeel.auth.v1")).toBeNull();
  },
);
