import { useState } from "react";
import { useQuery, useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { companionApi } from "../api/companion";
import { queryClient } from "../hooks/queries";
import { ChatWindow, MessageBubble } from "../components/ChatWindow";
import {
  BreathingExercise,
  ExerciseCard,
} from "../components/BreathingExercise";
import { Disclaimer } from "../components/Disclaimer";
import { ErrorNotice, PageTitle } from "../components/Feedback";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { reflectionText } from "../utils/format";
export function CompanionPage() {
  const [id, setId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");
  const list = useQuery({
    queryKey: ["companion"],
    queryFn: companionApi.list,
  });
  const exercises = useQuery({
    queryKey: ["exercises"],
    queryFn: companionApi.exercises,
  });
  const messages = useInfiniteQuery({
    queryKey: ["companion", id],
    enabled: !!id,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => companionApi.messages(id, pageParam),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const create = useMutation({
    mutationFn: companionApi.create,
    onSuccess: (d) => {
      setId(d.id);
      setRenaming(false);
      void queryClient.invalidateQueries({ queryKey: ["companion"] });
    },
  });
  const send = useMutation({
    mutationFn: (text: string) => companionApi.send(id, text),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["companion"] }),
  });
  const rename = useMutation({
    mutationFn: (input: { id: string; title: string }) =>
      companionApi.rename(input.id, input.title),
    onSuccess: () => {
      setRenaming(false);
      void queryClient.invalidateQueries({ queryKey: ["companion"] });
    },
  });
  const remove = useMutation({
    mutationFn: () => companionApi.remove(id),
    onSuccess: () => {
      setConfirm(false);
      setId("");
      void queryClient.invalidateQueries({ queryKey: ["companion"] });
    },
  });
  return (
    <>
      <PageTitle title="A little company">
        A space to explore a thought, or simply pause.
      </PageTitle>
      <Disclaimer />
      <div className="two-columns">
        <section className="card">
          <div className="actions">
            <label>
              Conversation{" "}
              <select
                value={id}
                onChange={(e) => {
                  setId(e.target.value);
                  setRenaming(false);
                  rename.reset();
                  send.reset();
                }}
              >
                <option value="">Choose a conversation</option>
                {list.data?.conversations.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => create.mutate()} disabled={create.isPending}>
              New conversation
            </button>
          </div>
          <ErrorNotice
            error={list.error || create.error || messages.error || send.error}
          />
          {id ? (
            <>
              {renaming ? (
                <form
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (title.trim())
                      rename.mutate({ id, title: title.trim() });
                  }}
                >
                  <label htmlFor="conversation-title">Conversation name</label>
                  <input
                    id="conversation-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    required
                    autoFocus
                  />
                  <div className="actions">
                    <button disabled={rename.isPending || !title.trim()}>
                      Save name
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setRenaming(false)}
                    >
                      Cancel
                    </button>
                  </div>
                  <ErrorNotice error={rename.error} />
                </form>
              ) : (
                <button
                  className="text-button"
                  onClick={() => {
                    setTitle(
                      list.data?.conversations.find((c) => c._id === id)
                        ?.title ?? "",
                    );
                    rename.reset();
                    setRenaming(true);
                  }}
                >
                  Rename conversation
                </button>
              )}
              {messages.hasNextPage && (
                <button
                  className="secondary"
                  onClick={() => void messages.fetchNextPage()}
                >
                  Earlier messages
                </button>
              )}
              <ChatWindow
                busy={send.isPending}
                onSend={async (text) => {
                  await send.mutateAsync(text);
                }}
                maxLength={20000}
              >
                {messages.data?.pages
                  .flatMap((p) => p.messages)
                  .sort(
                    (a, b) =>
                      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
                      a._id.localeCompare(b._id),
                  )
                  .map((m) => (
                    <MessageBubble
                      key={m._id}
                      author={
                        m.role === "USER"
                          ? "You"
                          : m.role === "CRISIS"
                            ? "A moment for support"
                            : "DayFeel companion"
                      }
                      text={
                        m.role === "ASSISTANT" ? reflectionText(m.text) : m.text
                      }
                      own={m.role === "USER"}
                    />
                  ))}
              </ChatWindow>
              <button className="text-button" onClick={() => setConfirm(true)}>
                Delete conversation
              </button>
              <p className="muted">
                If sending fails, check the conversation before trying again.
                Your words may already be saved.
              </p>
            </>
          ) : (
            <p>Start a conversation whenever you’re ready.</p>
          )}
        </section>
        <aside className="stack">
          <BreathingExercise />
          {exercises.data?.exercises.map((e) => (
            <ExerciseCard key={e.id} title={e.title} steps={e.steps} />
          ))}
        </aside>
      </div>
      {confirm && (
        <ConfirmDialog
          title="Delete this conversation?"
          onCancel={() => setConfirm(false)}
          onConfirm={() => remove.mutate()}
          busy={remove.isPending}
        >
          <p>Its messages cannot be restored.</p>
          <ErrorNotice error={remove.error} />
        </ConfirmDialog>
      )}
    </>
  );
}
