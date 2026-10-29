import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RouteGuard } from "./guards";
import { useAuth } from "../store/auth";
import type { Role } from "../types";
function show(roles: Role[] = ["USER"], onboard = true, signed = true) {
  useAuth.setState({
    tokens: signed
      ? {
          accessToken: "a",
          refreshToken: "r",
          tokenType: "Bearer",
          expiresIn: 900,
        }
      : null,
    session: { roles, onboardingComplete: onboard },
  });
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="login" element={<p>Login page</p>} />
        <Route path="onboarding" element={<p>Onboarding page</p>} />
        <Route element={<RouteGuard roles={["ADMIN"]} />}>
          <Route path="admin" element={<p>Admin page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}
test("anonymous visitors must sign in", () => {
  show(["USER"], true, false);
  expect(screen.getByText("Login page")).toBeInTheDocument();
});
test("first-run accounts must complete onboarding", () => {
  show(["ADMIN"], false);
  expect(screen.getByText("Onboarding page")).toBeInTheDocument();
});
test("ordinary users cannot open admin routes", () => {
  show();
  expect(screen.queryByText("Admin page")).not.toBeInTheDocument();
  expect(screen.getByText(/does not have access/)).toBeInTheDocument();
});
test("moderators cannot open admin routes", () => {
  show(["USER", "MODERATOR"]);
  expect(screen.queryByText("Admin page")).not.toBeInTheDocument();
});
test("admins can open authorized routes", () => {
  show(["USER", "ADMIN"]);
  expect(screen.getByText("Admin page")).toBeInTheDocument();
});
