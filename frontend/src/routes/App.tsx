import { Routes, Route } from "react-router-dom";
import { Layout } from "../components/Layout";
import { RouteGuard } from "./guards";
import { CrisisScreen } from "../components/CrisisScreen";
import { AuthPage } from "../pages/AuthPage";
import { OnboardingPage } from "../pages/OnboardingPage";
import { DashboardPage } from "../pages/DashboardPage";
import {
  JournalPage,
  JournalEditorPage,
  JournalDetailPage,
} from "../pages/JournalPage";
import { CompanionPage } from "../pages/CompanionPage";
import {
  CirclesPage,
  CircleFeedPage,
  PostDetailPage,
} from "../pages/CirclesPage";
import { ChatPage } from "../pages/ChatPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ModeratorPage, ReportDetailPage } from "../pages/ModeratorPage";
import { AdminPage } from "../pages/AdminPage";
import { Link } from "react-router-dom";
export function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="login" element={<AuthPage />} />
          <Route path="register" element={<AuthPage register />} />
          <Route element={<RouteGuard onboarding />}>
            <Route path="onboarding" element={<OnboardingPage />} />
          </Route>
          <Route element={<RouteGuard />}>
            <Route index element={<DashboardPage />} />
            <Route path="journal" element={<JournalPage />} />
            <Route path="journal/new" element={<JournalEditorPage />} />
            <Route path="journal/:id" element={<JournalDetailPage />} />
            <Route path="companion" element={<CompanionPage />} />
            <Route path="circles" element={<CirclesPage />} />
            <Route path="circles/:id" element={<CircleFeedPage />} />
            <Route path="circles/:id/chat" element={<ChatPage />} />
            <Route path="posts/:id" element={<PostDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route element={<RouteGuard roles={["MODERATOR", "ADMIN"]} />}>
              <Route path="moderator" element={<ModeratorPage />} />
              <Route
                path="moderator/reports/:id"
                element={<ReportDetailPage />}
              />
            </Route>
            <Route element={<RouteGuard roles={["ADMIN"]} />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <>
                <h1>A little off the path</h1>
                <Link to="/">Back to today</Link>
              </>
            }
          />
        </Route>
      </Routes>
      <CrisisScreen />
    </>
  );
}
