import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { circlesApi } from "../api/circles";
import { moderationApi } from "../api/moderation";
import { Modal } from "../components/ConfirmDialog";
import { ErrorNotice, Loading, PageTitle } from "../components/Feedback";
import { dateLabel } from "../utils/format";
import { useUI } from "../store/ui";
import type { I } from "../types";
export function ModeratorPage() {
  const [circle, setCircle] = useState("");
  const [page, setPage] = useState(0);
  const circles = useQuery({
    queryKey: ["circles", "moderator"],
    queryFn: () => circlesApi.list(),
  });
  const reports = useQuery({
    queryKey: ["reports", circle, page],
    enabled: !!circle,
    queryFn: () => moderationApi.reports(circle, page),
  });
  return (
    <>
      <PageTitle title="Care for your community">
        Review each report thoughtfully and within your scope.
      </PageTitle>
      <label>
        Circle{" "}
        <select
          value={circle}
          onChange={(e) => {
            setCircle(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Choose a circle</option>
          {circles.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <ErrorNotice error={circles.error || reports.error} />
      {circle && reports.isPending ? (
        <Loading />
      ) : (
        reports.data?.map((r) => (
          <article className="card" key={r.id}>
            <p className="eyebrow">
              {dateLabel(r.createdAt)} ·{" "}
              {r.source === "AI" ? "Automated review" : "Member report"}
            </p>
            <h2>
              <Link to={"/moderator/reports/" + r.id}>
                {r.reason === "UNSAFE"
                  ? "Safety concern"
                  : r.reason === "HARASSMENT"
                    ? "Unkind interaction"
                    : r.reason === "SPAM"
                      ? "Unwanted content"
                      : "Other concern"}
              </Link>
            </h2>
          </article>
        ))
      )}
      {reports.data?.length === 0 && <p>No reports in this page.</p>}
      <div className="actions">
        <button disabled={!page} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <button
          disabled={reports.data?.length !== 20}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
export function ReportDetailPage() {
  const { id = "" } = useParams();
  const q = useQuery({
    queryKey: ["report", id],
    queryFn: () => moderationApi.report(id),
  });
  const [dialog, setDialog] = useState(false);
  const reported = useQuery({ queryKey: ["reported-content", id], queryFn: () => moderationApi.content(id), enabled: !!q.data?.contentId });
  const [action, setAction] = useState<I["Moderation"]["action"]>("MUTE");
  const [until, setUntil] = useState("");
  const [durationError, setDurationError] = useState("");
  const act = useMutation({
    mutationFn: () =>
      moderationApi.act(q.data!.circleId, {
        targetId: q.data!.targetId,
        action,
        ...(action === "MUTE" || action === "BAN"
          ? { until: new Date(until).toISOString() }
          : {}),
        ...(q.data!.contentId ? { contentId: q.data!.contentId } : {}),
      }),
    onSuccess: () => {
      setDialog(false);
      useUI.getState().announce("The moderation action has been recorded.");
    },
  });
  if (q.isPending) return <Loading />;
  if (!q.data) return <ErrorNotice error={q.error} />;
  return (
    <>
      <PageTitle title="Review a report" />
      <section className="card">
        <p>
          Category:{" "}
          {q.data.reason === "UNSAFE"
            ? "Safety concern"
            : q.data.reason.toLowerCase()}
        </p>
        <p>Source: {q.data.source}</p>
        <p>Reported {dateLabel(q.data.createdAt)}</p>
        <p className="muted">
          Only reported community content is shown. Private journal and
          companion text is never available here.
        </p>
        {q.data.contentId && (
          <p>
            Content reference: <code>{q.data.contentId}</code>
          </p>
        )}
        {q.data.contentId && <section aria-label="Reported content">
          <h2>Reported {reported.data?.kind ?? "content"}</h2>
          {reported.isPending ? <Loading /> : reported.isError ? <ErrorNotice error={reported.error} /> : reported.data ? <>
            <strong>{reported.data.authorAlias}</strong>
            <p className="muted">{dateLabel(reported.data.createdAt)} · {reported.data.status}</p>
            <p className="preserve">{reported.data.text}</p>
          </> : <p>This content is no longer available.</p>}
        </section>}
        <button onClick={() => setDialog(true)}>Choose an action</button>
      </section>
      {dialog && (
        <Modal title="Moderation action" onCancel={() => setDialog(false)}>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (action === "MUTE" || action === "BAN") {
                const expiry = new Date(until).getTime();
                const now = Date.now();
                if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 365 * 86400000) {
                  setDurationError("Choose an expiry in the future, no more than 365 days from now. Times use your device’s local timezone.");
                  return;
                }
              }
              setDurationError("");
              act.mutate();
            }}
          >
            <label>
              Action
              <select
                value={action}
                onChange={(e) =>
                  setAction(e.target.value as I["Moderation"]["action"])
                }
              >
                <option value="MUTE">Pause posting</option>
                <option value="BAN">Restrict circle access</option>
                <option value="UNBAN">Restore circle access</option>
                {q.data.contentId && (
                  <option value="REMOVE_CONTENT">
                    Remove reported content
                  </option>
                )}
              </select>
            </label>
            {(action === "MUTE" || action === "BAN") && (
              <label>
                Until
                <input
                  type="datetime-local"
                  required
                  value={until}
                  onChange={(e) => { setUntil(e.target.value); setDurationError(""); act.reset(); }}
                />
              </label>
            )}
            <p>
              The server checks your authority and the target’s role before
              applying this action.
            </p>
            <ErrorNotice error={act.error} />
            {durationError && <p role="alert">{durationError}</p>}
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setDialog(false)}
              >
                Cancel
              </button>
              <button disabled={act.isPending}>Apply action</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
