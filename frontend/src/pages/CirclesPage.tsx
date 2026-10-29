import { useState } from "react";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "react-router-dom";
import { circlesApi } from "../api/circles";
import { postsApi } from "../api/posts";
import { usePosts, queryClient } from "../hooks/queries";
import { PostCard, PostComposer, ReactionBar } from "../components/PostCard";
import { ErrorNotice, Loading, Empty, PageTitle } from "../components/Feedback";
import { ConfirmDialog, Modal } from "../components/ConfirmDialog";
import { useUI } from "../store/ui";
export function CirclesPage() {
  const [page, setPage] = useState(0);
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ["circles", page],
    queryFn: () => circlesApi.list(page),
  });
  const join = useMutation({
    mutationFn: circlesApi.join,
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ["circles"] });
      nav("/circles/" + id);
    },
  });
  return (
    <>
      <PageTitle title="Find a little connection">
        Share experiences, offer kindness, and feel less alone.
      </PageTitle>
      <ErrorNotice error={q.error || join.error} />
      {q.isPending ? (
        <Loading />
      ) : (
        <div className="card-grid">
          {q.data?.map((c) => (
            <article className="card" key={c.id}>
              <span className="circle-symbol" aria-hidden="true">
                ◌
              </span>
              <h2>{c.name}</h2>
              <p>A shared space to listen and be heard.</p>
              <div className="actions">
                {c.joined ? (
                  <>
                    <span className="muted">Joined</span>
                    <Link to={"/circles/" + c.id}>Open feed</Link>
                  </>
                ) : (
                  <button
                    onClick={() => join.mutate(c.id)}
                    disabled={join.isPending}
                  >
                    Join circle
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="actions">
        <button
          className="secondary"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          Previous circles
        </button>
        <button
          className="secondary"
          disabled={!q.data || q.data.length < 20}
          onClick={() => setPage(page + 1)}
        >
          More circles
        </button>
      </div>
    </>
  );
}
export function CircleFeedPage() {
  const nav = useNavigate();
  const { id = "" } = useParams();
  const q = usePosts(id);
  const circle = useQuery({
    queryKey: ["circle", id],
    queryFn: () => circlesApi.find(id),
    enabled: !!id,
  });
  const [held, setHeld] = useState(false);
  const leave = useMutation({
    mutationFn: () => circlesApi.leave(id),
    onSuccess: () => {
      useUI.getState().announce("You have left the circle.");
      void queryClient.invalidateQueries({ queryKey: ["circles"] });
      nav("/circles");
    },
  });
  return (
    <>
      <PageTitle title={circle.data ? `${circle.data.name} Circle` : "Circle"}>
        A shared space for everyday experiences.
      </PageTitle>
      <div className="actions">
        <Link to={"/circles/" + id + "/chat"}>Enter live chat</Link>
        <button
          className="text-button"
          onClick={() => leave.mutate()}
          disabled={leave.isPending}
        >
          Leave circle
        </button>
      </div>
      <ErrorNotice error={leave.error} />
      <PostComposer
        onPost={async (text) => {
          const r = await postsApi.create(id, text);
          setHeld(r.content.status === "HELD");
          await queryClient.invalidateQueries({ queryKey: ["posts", id] });
        }}
      />
      {held && (
        <p role="status">
          Your post is waiting for a moderator’s review and isn’t visible to the
          circle yet.
        </p>
      )}
      <ErrorNotice error={q.error} />
      {q.isPending ? (
        <Loading />
      ) : q.data?.pages.flatMap((p) => p.posts).length ? (
        q.data.pages
          .flatMap((p) => p.posts)
          .map((post) => <PostCard key={post.id} post={post} />)
      ) : (
        !q.error && (
          <Empty>No posts yet. There’s room for your voice here.</Empty>
        )
      )}
      {q.hasNextPage && (
        <button
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          More posts
        </button>
      )}
    </>
  );
}
export function PostDetailPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState("SPAM");
  const report = useMutation({
    mutationFn: () => reporting === "post" ? postsApi.report(id, reason) : postsApi.reportComment(reporting!, reason),
    onSuccess: () => { setReporting(null); void queryClient.invalidateQueries({ queryKey: ["reports"] }); },
  });
  const q = useQuery({
    queryKey: ["post", id],
    queryFn: () => postsApi.get(id),
  });
  const comments = useInfiniteQuery({
    queryKey: ["comments", id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => postsApi.comments(id, pageParam),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const remove = useMutation({
    mutationFn: () =>
      confirm === "post"
        ? postsApi.remove(id)
        : postsApi.removeComment(confirm!),
    onSuccess: () => {
      if (confirm === "post") nav("/circles/" + q.data?.circleId);
      else void comments.refetch();
      setConfirm(null);
    },
  });
  if (q.isPending) return <Loading />;
  if (!q.data) return <ErrorNotice error={q.error} />;
  return (
    <>
      <PageTitle title="A shared moment" />
      <article className="card">
        <p className="eyebrow">{q.data.authorAlias}</p>
        <p className="preserve entry-body">{q.data.text}</p>
        <ReactionBar postId={id} />
        {!q.data.own && <button className="text-button" onClick={() => { report.reset(); setReporting("post"); }}>Report post</button>}
        {report.isSuccess && <p role="status">Your report was submitted to this circle’s moderation queue.</p>}
        {q.data.own && <button className="text-button" onClick={() => setConfirm("post")}>
          Delete my post
        </button>}
        <p className="muted">Only the author can delete this post.</p>
      </article>
      <h2>Kind words</h2>
      {reporting && <Modal title={reporting === "post" ? "Report post" : "Report comment"} onCancel={() => { if (!report.isPending) setReporting(null); }}>
        <form className="stack" onSubmit={e => { e.preventDefault(); report.mutate(); }}>
          <label htmlFor="report-reason">Reason</label>
          <select id="report-reason" value={reason} onChange={e => setReason(e.target.value)} disabled={report.isPending}>
            <option value="SPAM">Spam or unwanted content</option>
            <option value="HARASSMENT">Harassment or unkind interaction</option>
            <option value="UNSAFE">Safety concern</option>
            <option value="OTHER">Other concern</option>
          </select>
          <ErrorNotice error={report.error} />
          <button disabled={report.isPending}>{report.isPending ? "Submitting…" : "Submit report"}</button>
        </form>
      </Modal>}
      <ErrorNotice error={comments.error} />
      {comments.data?.pages
        .flatMap((p) => p.comments)
        .map((c) => (
          <article className="card" key={c.id}>
            <strong>{c.authorAlias}</strong>
            {!c.own && <button className="text-button" onClick={() => { report.reset(); setReporting(c.id); }}>Report comment</button>}
            <p className="preserve">{c.text}</p>
            {c.own && <button className="text-button" onClick={() => setConfirm(c.id)}>
              Delete my comment
            </button>}
          </article>
        ))}
      {comments.hasNextPage && (
        <button onClick={() => void comments.fetchNextPage()}>
          More comments
        </button>
      )}
      <PostComposer
        label="Leave a supportive comment"
        onPost={async (text) => {
          const r = await postsApi.comment(id, text);
          if (r.content.status === "HELD")
            useUI
              .getState()
              .announce("Your comment is waiting for moderator review.");
          await comments.refetch();
        }}
      />
      {confirm && (
        <ConfirmDialog
          title="Delete your contribution?"
          onCancel={() => setConfirm(null)}
          onConfirm={() => remove.mutate()}
          busy={remove.isPending}
        >
          <p>
            This removes your words. Only an author can delete their
            contribution.
          </p>
          <ErrorNotice error={remove.error} />
        </ConfirmDialog>
      )}
    </>
  );
}
