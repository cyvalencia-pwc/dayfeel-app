import { useEffect } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { profileApi } from "../api/profile";
import { authApi } from "../api/auth";
import { queryClient } from "../hooks/queries";
import { ErrorNotice } from "./Feedback";
export function Layout() {
  const { tokens, session, generation } = useAuth();
  const notice = useUI((s) => s.notice);
  const location = useLocation();
  const isAuthPage = ["/login", "/register"].includes(location.pathname);
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ["session", generation],
    queryFn: profileApi.session,
    enabled: !!tokens,
    retry: false,
  });
  useEffect(() => {
    if (q.data) useAuth.getState().setSession(q.data);
  }, [q.data]);
  useEffect(() => {
    document.title = `DayFeel — Your day, your feelings.`;
    document.getElementById("main")?.focus();
    useUI.getState().announce("");
  }, [location.pathname]);
  async function logout() {
    try {
      await authApi.logout();
    } finally {
      useAuth.getState().logout();
      queryClient.clear();
      nav("/login");
    }
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!isAuthPage && <header className="topbar">
        <Link to={tokens ? "/" : "/login"} className="brand">
          <img className="brand-mark" src="/dayfeel.svg" alt="" aria-hidden="true" />
          <span>
            <strong>DayFeel</strong>
            <small>Your day, your feelings.</small>
          </span>
        </Link>
        <a className="help-link" href="https://findahelpline.com/">
          Need help now?
        </a>
        {tokens && (
          <button className="text-button" onClick={() => void logout()}>
            Sign out
          </button>
        )}
      </header>}
      <div className={tokens ? "app-shell" : isAuthPage ? "public-shell auth-shell" : "public-shell"}>
        {tokens && (
          <nav className="sidebar" aria-label="Main navigation">
            {[
              ["/", "Today"],
              ["/journal", "Journal"],
              ["/companion", "Companion"],
              ["/circles", "Circles"],
              ["/settings", "Settings"],
            ].map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"}>
                {label}
              </NavLink>
            ))}
            {session?.roles.some((r) => r === "MODERATOR" || r === "ADMIN") && (
              <NavLink to="/moderator">Moderation</NavLink>
            )}
            {session?.roles.includes("ADMIN") && (
              <NavLink to="/admin">Admin</NavLink>
            )}
            <p className="sidebar-note">
              A small pause.
              <br />A little room for you.
            </p>
          </nav>
        )}
        <main id="main" tabIndex={-1} className={isAuthPage ? "page auth-page" : "page"}>
          <div role="status" className="notice">
            {notice}
          </div>
          {tokens && q.isError ? (
            <>
              <ErrorNotice error={q.error} />
              <button onClick={() => void q.refetch()}>
                Try loading your account again
              </button>
            </>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <footer className={isAuthPage ? "auth-footer" : undefined}>DayFeel · Take this at your own pace.</footer>
    </>
  );
}
