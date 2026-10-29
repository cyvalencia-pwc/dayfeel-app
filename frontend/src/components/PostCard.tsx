import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { postsApi } from "../api/posts";
import type { C } from "../types";
import { ErrorNotice } from "./Feedback";
import { dateLabel } from "../utils/format";
import { ReactionIcon } from "./ReactionIcon";
export function ReactionBar({ postId }: { postId: string }) {
  const client = useQueryClient();
  const key = ["reactions", postId];
  const saved = useQuery({ queryKey: key, queryFn: () => postsApi.reactions(postId) });
  const react = useMutation({
    mutationFn: (type: C["ReactionInput"]["type"]) =>
      postsApi.react(postId, type),
    onSuccess: (data) => {
      client.setQueryData(key, data);
      void client.invalidateQueries({ queryKey: key });
    },
  });
  return (
    <>
      <div className="reactions" aria-label="Supportive reactions">
        {(["support", "hug", "relate", "helpful"] as const).map((type) => (
          <button
            className="secondary"
            key={type}
            aria-pressed={saved.data?.reaction === type}
            disabled={react.isPending || saved.isPending || saved.isError}
            onClick={() => react.mutate(saved.data?.reaction === type ? null : type)}
          >
            <ReactionIcon type={type} />
            <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
            <span>{saved.data?.counts[type] ?? 0}</span>
          </button>
        ))}
      </div>
      <ErrorNotice error={react.error} />
      <ErrorNotice error={saved.error} />
    </>
  );
}
export function PostCard({ post }: { post: C["CommunityContent"] }) {
  return (
    <article className="card">
      <p className="eyebrow">
        {post.authorAlias} · {dateLabel(post.createdAt)}
      </p>
      <p className="preserve">{post.text}</p>
      <Link to={"/posts/" + post.id}>Read and respond</Link>
      <ReactionBar postId={post.id} />
    </article>
  );
}
export function PostComposer({
  onPost,
  label = "Share with your circle",
}: {
  onPost: (text: string) => Promise<void>;
  label?: string;
}) {
  const [text, setText] = useState("");
  const post = useMutation({
    mutationFn: () => onPost(text.trim()),
    onSuccess: () => setText(""),
  });
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) post.mutate();
      }}
    >
      <label htmlFor="post-text">{label}</label>
      <textarea
        id="post-text"
        rows={4}
        required
        maxLength={10000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={post.isPending}
      />
      <p className="muted">
        Your alias is shown. Please leave out names and personal details.
      </p>
      <ErrorNotice error={post.error} />
      <button disabled={post.isPending || !text.trim()}>
        {post.isPending ? "Sharing…" : "Share"}
      </button>
    </form>
  );
}
