import { useId } from "react";
import type { C } from "../types";
import { dateLabel } from "../utils/format";
import { moodLabels } from "./MoodPicker";
export function MoodTrendChart({ days }: { days: C["MoodLog"][] }) {
  const id = useId();
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const from = sorted.length ? Date.parse(sorted[0].date) : 0;
  const span = sorted.length
    ? Date.parse(sorted[sorted.length - 1].date) - from
    : 0;
  const x = (day: C["MoodLog"]) =>
    span ? 48 + ((Date.parse(day.date) - from) / span) * 484 : 290;
  const y = (m: number) => 190 - (m - 1) * 40;
  return (
    <section className="card">
      <h2 id={id}>Your mood over time</h2>
      <p className="muted">A little perspective, without a target to reach.</p>
      {!sorted.length ? (
        <p>No check-ins yet. Start whenever you’re ready.</p>
      ) : (
        <>
          <svg
            role="img"
            aria-labelledby={id}
            viewBox="0 0 580 230"
            className="trend"
          >
            <desc>
              Recorded mood scores from 1 to 5. A table with every value
              follows.
            </desc>
            {[1, 2, 3, 4, 5].map((m) => (
              <g key={m}>
                <line x1="42" x2="545" y1={y(m)} y2={y(m)} stroke="#e4d9bd" />
                <text x="18" y={y(m) + 5}>
                  {m}
                </text>
              </g>
            ))}
            <polyline
              fill="none"
              stroke="#806019"
              strokeWidth="3"
              points={sorted.map((d) => `${x(d)},${y(d.moodScore)}`).join(" ")}
            />
            {sorted.map((d) => (
              <circle
                key={d.date}
                cx={x(d)}
                cy={y(d.moodScore)}
                r="5"
                fill="#806019"
              />
            ))}
            <text x="48" y="222">
              {sorted[0].date}
            </text>
            <text textAnchor="end" x="532" y="222">
              {sorted[sorted.length - 1].date}
            </text>
          </svg>
          <details>
            <summary>View check-ins as a table</summary>
            <table>
              <caption>Recorded mood check-ins</caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mood</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr key={d.date}>
                    <td>{dateLabel(d.date)}</td>
                    <td>
                      {d.moodScore} — {moodLabels[d.moodScore - 1]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
