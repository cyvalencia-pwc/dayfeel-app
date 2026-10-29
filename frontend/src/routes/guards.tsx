import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";
import type { Role } from "../types";
import { Loading } from "../components/Feedback";
export function RouteGuard({
  roles,
  onboarding = false,
}: {
  roles?: Role[];
  onboarding?: boolean;
}) {
  const { tokens, session } = useAuth();
  const location = useLocation();
  if (!tokens)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!session) return <Loading />;
  if (!onboarding && !session.onboardingComplete)
    return <Navigate to="/onboarding" replace />;
  if (roles && !roles.some((role) => session.roles.includes(role)))
    return (
      <section className="card">
        <h1>This space is for your moderation team</h1>
        <p>Your account does not have access to this page.</p>
      </section>
    );
  return <Outlet />;
}
