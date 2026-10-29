import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMoodSummary, queryClient } from "../hooks/queries";
import { moodApi } from "../api/mood";
import { MoodPicker } from "../components/MoodPicker";
import { MoodTrendChart } from "../components/MoodTrendChart";
import { ErrorNotice, Loading, PageTitle } from "../components/Feedback";
import { timezone } from "../utils/format";
import { useUI } from "../store/ui";
import type { Range } from "../types";
export function DashboardPage() {
  const [mood, setMood] = useState<number | null>(null);
  const [range, setRange] = useState<Range>("7d");
  const summary = useMoodSummary(range);
  const save = useMutation({
    mutationFn: () =>
      moodApi.save({ moodScore: mood!, timezone: timezone(), tags: [] }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mood"] });
      useUI
        .getState()
        .announce(
          "Your check-in is saved. Thank you for making a little room for yourself.",
        );
    },
  });
  return (
    <>
      <PageTitle eyebrow="Your daily pause" title="A moment for you">
        You can start small. That’s enough.
      </PageTitle>
      <div className="dashboard-grid">
        <section className="card checkin">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mood) save.mutate();
            }}
          >
            <MoodPicker value={mood} onChange={setMood} />
            <div className="actions">
              <button disabled={!mood || save.isPending}>
                {save.isPending ? "Saving…" : "Save check-in"}
              </button>
              <Link to="/journal/new">Put it into words</Link>
            </div>
            <ErrorNotice error={save.error} />
          </form>
        </section>
        <section className="card warm">
          <p className="eyebrow">Making room</p>
          <p className="stat">
            {summary.data?.streak ?? "—"} <span>days</span>
          </p>
          <p>
            of recent check-ins. A missed day is simply a new place to begin.
          </p>
        </section>
      </div>
      <div className="section-head">
        <h2>A little perspective</h2>
        <label>
          Time range{" "}
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
          >
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
          </select>
        </label>
      </div>
      <ErrorNotice error={summary.error} />
      {summary.isPending ? (
        <Loading />
      ) : (
        summary.data && <MoodTrendChart days={summary.data.days} />
      )}
    </>
  );
}
