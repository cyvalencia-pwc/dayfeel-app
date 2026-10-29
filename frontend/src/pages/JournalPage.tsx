import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useJournal, invalidateJournal } from "../hooks/queries";
import { journalApi } from "../api/journal";
import { EntryEditor } from "../components/EntryEditor";
import { MoodCalendar } from "../components/MoodCalendar";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorNotice, Loading, Empty, PageTitle } from "../components/Feedback";
import { dateLabel } from "../utils/format";
import { moodLabels } from "../components/MoodPicker";
export function JournalPage() {
  const [before, setBefore] = useState<string>();
  const q = useJournal({ before, limit: 20 });
  return (
    <>
      <PageTitle title="Your journal">
        A private place for whatever today holds.
      </PageTitle>
      <Link className="button" to="/journal/new">
        Write an entry
      </Link>
      <div className="two-columns">
        <section className="stack">
          <ErrorNotice error={q.error} />
          {q.isPending ? (
            <Loading />
          ) : q.data?.entries.length ? (
            q.data.entries.map((e) => (
              <article className="card" key={e._id}>
                <p className="eyebrow">
                  {dateLabel(e.createdAt)} · {moodLabels[e.moodScore - 1]}
                </p>
                <h2>
                  <Link to={"/journal/" + e._id}>
                    {e.text.slice(0, 90)}
                    {e.text.length > 90 ? "…" : ""}
                  </Link>
                </h2>
                <p>{e.tags?.join(" · ")}</p>
              </article>
            ))
          ) : (
            <Empty>
              No entries yet. A sentence is a lovely place to start.
            </Empty>
          )}
          <div className="actions">
            {before && (
              <button
                className="secondary"
                onClick={() => setBefore(undefined)}
              >
                Newest entries
              </button>
            )}
            {q.data?.entries.length === 20 && (
              <button
                onClick={() => setBefore(q.data!.entries.at(-1)!.createdAt)}
              >
                Older entries
              </button>
            )}
          </div>
        </section>
        <MoodCalendar />
      </div>
    </>
  );
}
export function JournalEditorPage() {
  const nav = useNavigate();
  return (
    <>
      <PageTitle title="What’s on your mind?">
        There’s no right way to fill this page.
      </PageTitle>
      <section className="card narrow">
        <EntryEditor onSaved={(id) => nav("/journal/" + id)} />
      </section>
    </>
  );
}
export function JournalDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({
    queryKey: ["journal", id],
    queryFn: () => journalApi.get(id),
  });
  const remove = useMutation({
    mutationFn: () => journalApi.remove(id),
    onSuccess: async () => {
      await invalidateJournal();
      nav("/journal");
    },
  });
  if (q.isPending) return <Loading />;
  if (!q.data) return <ErrorNotice error={q.error} />;
  const e = q.data;
  return (
    <>
      <PageTitle title="A page from your day">
        {dateLabel(e.createdAt)}
      </PageTitle>
      <section className="card narrow">
        {editing ? (
          <EntryEditor
            entry={e}
            onSaved={() => {
              setEditing(false);
              void q.refetch();
            }}
          />
        ) : (
          <>
            <p className="eyebrow">{moodLabels[e.moodScore - 1]}</p>
            <p className="preserve entry-body">{e.text}</p>
            <div className="actions">
              <button className="secondary" onClick={() => setEditing(true)}>
                Edit entry
              </button>
              <button className="text-button" onClick={() => setConfirm(true)}>
                Delete entry
              </button>
            </div>
          </>
        )}
      </section>
      {confirm && (
        <ConfirmDialog
          title="Delete this entry?"
          onCancel={() => setConfirm(false)}
          onConfirm={() => remove.mutate()}
          busy={remove.isPending}
        >
          <p>
            This entry cannot be restored. Your separate mood check-in will
            remain.
          </p>
          <ErrorNotice error={remove.error} />
        </ConfirmDialog>
      )}
    </>
  );
}
