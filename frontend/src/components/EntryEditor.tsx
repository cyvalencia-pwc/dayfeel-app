import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { journalApi } from "../api/journal";
import { MoodPicker } from "./MoodPicker";
import { ErrorNotice } from "./Feedback";
import { timezone } from "../utils/format";
import { invalidateJournal } from "../hooks/queries";
import type { C } from "../types";
export function EntryEditor({
  entry,
  onSaved,
}: {
  entry?: C["JournalEntry"];
  onSaved: (id: string) => void;
}) {
  const [text, setText] = useState(entry?.text ?? "");
  const [mood, setMood] = useState<number | null>(entry?.moodScore ?? null);
  const [tags, setTags] = useState(entry?.tags?.join(", ") ?? "");
  const save = useMutation({
    mutationFn: () => {
      const input = {
        text: text.trim(),
        moodScore: mood!,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        timezone: timezone(),
        region: "GLOBAL",
      };
      return entry
        ? journalApi.update(entry._id, input)
        : journalApi.create(input);
    },
    onSuccess: async (data) => {
      await invalidateJournal();
      onSaved(data.entry._id);
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (mood && text.trim()) save.mutate();
      }}
      className="stack"
    >
      <MoodPicker value={mood} onChange={setMood} disabled={save.isPending} />
      <label htmlFor="entry-text">What would you like to put into words?</label>
      <textarea
        id="entry-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={20000}
        required
        rows={8}
        placeholder="A moment, a thought, or just a few words…"
        disabled={save.isPending}
      />
      <label htmlFor="entry-tags">
        Tags <span className="muted">(optional, separated by commas)</span>
      </label>
      <input
        id="entry-tags"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        disabled={save.isPending}
      />
      <p className="muted">
        This space is yours. You can change or delete an entry later.
      </p>
      <ErrorNotice error={save.error} />
      <button disabled={!mood || !text.trim() || save.isPending}>
        {save.isPending ? "Saving your words…" : "Save entry"}
      </button>
    </form>
  );
}
