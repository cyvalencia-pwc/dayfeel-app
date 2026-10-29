import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { content } from "../api/client";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "../store/auth";
import { handleCrisis } from "../store/crisis";
import { refreshAccess } from "../api/client";
import { ChatWindow, MessageBubble } from "./ChatWindow";
import type { C } from "../types";
type Ack = {
  ok: boolean;
  data?: C["CommunityCreated"];
  error?: { code: string; message: string };
};
export function ChatRoom({ circleId }: { circleId: string }) {
  const token = useAuth((s) => s.tokens?.accessToken);
  const ref = useRef<Socket>();
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<C["ChatMessage"][]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const client = useQueryClient();
  const history = useInfiniteQuery({
    queryKey: ["circle-chat", circleId],
    enabled: joined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => content.get<C["ChatHistory"]>(`/circles/${circleId}/chat/messages`, { params: { cursor: pageParam } }).then(r => r.data),
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const visible = [...new Map([
    ...(history.data?.pages.flatMap(p => p.messages) ?? []), ...messages,
  ].map(m => [m.id, m])).values()].filter(m => !removed.includes(m.id)).sort((a, b) => a.id.localeCompare(b.id));
  const [aliases, setAliases] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!token) return;
    setMessages([]);
    setRemoved([]);
    const socket = io((import.meta.env.VITE_SOCKET_URL || "") + "/chat", {
      auth: { token },
    });
    ref.current = socket;
    let refreshed = false;
    socket.on("connect", () => {
      socket
        .timeout(10000)
        .emit("room:join", { circleId }, (err: Error | null, ack: Ack) => {
          if (err || !ack?.ok) {
            setError(
              "This room is unavailable. Check your membership and try again.",
            );
            return;
          }
          setJoined(true);
          void client.invalidateQueries({ queryKey: ["circle-chat", circleId] });
          setError("");
        });
    });
    socket.on("disconnect", (reason) => {
      setJoined(false);
      if (reason === "io server disconnect" && !refreshed) {
        refreshed = true;
        void refreshAccess().catch(() => {});
      }
    });
    socket.on("connect_error", (e) => {
      setError("Couldn’t connect to this room.");
      if (!refreshed && /authentication/i.test(e.message)) {
        refreshed = true;
        void refreshAccess().catch(() => {});
      }
    });
    socket.on("error", () =>
      setError(
        "Your request could not be completed. Check your membership or pause before trying again.",
      ),
    );
    socket.on("message:new", (m: C["ChatMessage"]) => {
      if (m.circleId === circleId)
        setMessages((ms) =>
          ms.some((v) => v.id === m.id) ? ms : [...ms, m],
        );
    });
    socket.on("message:removed", ({ id }: { id: string }) => {
      setRemoved(ids => [...ids, id]);
      setMessages(ms => ms.filter(m => m.id !== id));
    });
    socket.on("presence", ({ aliases: present }: { aliases: string[] }) =>
      setAliases(present),
    );
    socket.on("typing", ({ authorAlias }: { authorAlias: string }) => {
      setTyping(authorAlias + " is writing…");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setTyping(""), 3000);
    });
    return () => {
      socket.emit("room:leave", { circleId });
      socket.disconnect();
      clearTimeout(timer.current);
      setJoined(false);
    };
  }, [token, circleId]);
  async function send(text: string) {
    setBusy(true);
    setError("");
    try {
      const ack = (await ref
        .current!.timeout(15000)
        .emitWithAck("message:send", { circleId, text })) as Ack;
      if (!ack.ok) throw new Error();
      await handleCrisis(ack.data);
      if (ack.data?.content.status === "HELD")
        setError("Your message is waiting for moderator review.");
    } catch {
      setError(
        "We couldn’t confirm delivery. Check the chat before sending again.",
      );
      throw new Error("Delivery uncertain");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <p role="status">
        {joined
          ? "Connected · " + aliases.length + " aliases present"
          : "Connecting to your circle…"}
      </p>
      <p className="muted">{aliases.join(" · ")}</p>
      {error && <p role="alert">{error}</p>}
      <ChatWindow
        onSend={send}
        busy={busy}
        disabled={!joined}
        onTyping={() => ref.current?.emit("typing", { circleId })}
      >
        {history.isFetching && <p role="status">Loading messages…</p>}
        {history.isError && <p role="alert">Could not load chat history. <button onClick={() => void history.refetch()}>Try again</button></p>}
        {history.hasNextPage && <button className="secondary" disabled={history.isFetching} onClick={() => void history.fetchNextPage()}>Load older messages</button>}
        {visible.map((m) => (
          <MessageBubble key={m.id} author={m.own ? "You" : m.authorAlias} text={m.text} createdAt={m.createdAt} own={m.own} />
        ))}
      </ChatWindow>
      <p role="status">{typing}</p>
      <p className="muted">
        Messages are saved and visible to circle members.
      </p>
    </section>
  );
}
