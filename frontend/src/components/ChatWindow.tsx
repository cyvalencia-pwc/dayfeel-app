import { useState, type ReactNode } from "react";
export function MessageBubble({
  author,
  text,
  own = false,
  createdAt,
}: {
  author: string;
  text: string;
  own?: boolean;
  createdAt?: string;
}) {
  return (
    <article className={"message " + (own ? "own" : "")}>
      <strong>{author}</strong>
      {createdAt && <time className="muted" dateTime={createdAt} style={{ display: "block", fontSize: "0.75rem" }}>{new Date(createdAt).toLocaleString()}</time>}
      <p className="preserve">{text}</p>
    </article>
  );
}
export function ChatWindow({
  children,
  onSend,
  busy = false,
  disabled = false,
  maxLength = 5000,
  onTyping,
}: {
  children: ReactNode;
  onSend: (text: string) => Promise<void>;
  busy?: boolean;
  disabled?: boolean;
  maxLength?: number;
  onTyping?: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="chat-window">
      <div
        className="message-log"
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
      >
        {children}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = text.trim();
          if (value && !busy)
            void onSend(value)
              .then(() => setText(""))
              .catch(() => {});
        }}
        className="chat-compose"
      >
        <label htmlFor="chat-message">Your message</label>
        <textarea
          id="chat-message"
          required
          rows={3}
          maxLength={maxLength}
          value={text}
          disabled={disabled || busy}
          onChange={(e) => {
            setText(e.target.value);
            onTyping?.();
          }}
        />
        <button disabled={disabled || busy || !text.trim()}>
          {busy ? "Sending…" : "Send message"}
        </button>
      </form>
    </div>
  );
}
