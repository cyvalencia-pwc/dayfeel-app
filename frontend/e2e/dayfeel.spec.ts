import { test, expect } from "@playwright/test";
test("register, complete onboarding, write an entry, and see the mood chart", async ({
  page,
}) => {
  let onboarded = false;
  let entry: Record<string, unknown> | null = null;
  const consent = {
    aiAnalysis: false,
    companionMemory: false,
  };
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      let body: unknown = {};
      let status = 200;
      if (path.endsWith("/auth/register")) {
        status = 201;
        body = {
          accessToken: "browser-test",
          refreshToken: "refresh-test",
          tokenType: "Bearer",
          expiresIn: 900,
        };
      } else if (path.endsWith("/me/session"))
        body = { roles: ["USER"], onboardingComplete: onboarded };
      else if (path.endsWith("/me/onboarding")) {
        onboarded = true;
        status = 204;
      } else if (path.endsWith("/me/consent"))
        body = request.postDataJSON() ?? consent;
      else if (path.endsWith("/me"))
        body = { alias: "QuietWillow", avatarUrl: null, consent };
      else if (path.endsWith("/journal") && request.method() === "POST") {
        const input = request.postDataJSON();
        entry = {
          ...input,
          _id: "507f1f77bcf86cd799439011",
          userId: "test",
          crisisFlag: false,
          analysis: { status: "skipped" },
          createdAt: "2026-10-22T08:00:00Z",
          updatedAt: "2026-10-22T08:00:00Z",
        };
        body = { entry, support: null, streak: 1 };
        status = 201;
      } else if (path.endsWith("/journal/507f1f77bcf86cd799439011"))
        body = entry;
      else if (path.endsWith("/mood/summary"))
        body = {
          range: "7d",
          from: "2026-10-16",
          to: "2026-10-22",
          count: entry ? 1 : 0,
          averageMood: entry ? 4 : null,
          streak: entry ? 1 : 0,
          days: entry
            ? [
                {
                  _id: "mood-1",
                  userId: "test",
                  date: "2026-10-22",
                  moodScore: 4,
                  tags: [],
                },
              ]
            : [],
        };
      else if (path.endsWith("/insights/weekly/latest")) {
        status = 404;
        body = { code: "NOT_FOUND" };
      } else {
        status = 404;
        body = { code: "UNEXPECTED_TEST_REQUEST" };
      }
      await route.fulfill({
        status,
        contentType: "application/json",
        body: status === 204 ? undefined : JSON.stringify(body),
      });
    },
  );
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill("person@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("a-long-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Make this space yours" }),
  ).toBeVisible();
  await page.getByLabel("Your community alias").fill("QuietWillow");
  await expect(
    page.getByRole("switch", { name: "Reflection insights" }),
  ).not.toBeChecked();
  await page
    .getByLabel("I understand what DayFeel can and cannot offer.")
    .check();
  await page.getByRole("button", { name: "Begin my DayFeel" }).click();
  await expect(
    page.getByRole("heading", { name: "A moment for you" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Put it into words" }).click();
  await page.getByText("Calm", { exact: true }).click();
  await page
    .getByLabel("What would you like to put into words?")
    .fill("A slow walk and a kind conversation.");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(
    page.getByText("A slow walk and a kind conversation."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Your mood over time" }),
  ).toBeVisible();
  await page.getByText("View check-ins as a table").click();
  await expect(page.getByRole("cell", { name: "4 — Calm" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Need help now?" }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("link", { name: "Need help now?" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
});
