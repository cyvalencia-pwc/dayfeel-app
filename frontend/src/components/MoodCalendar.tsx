import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { moodApi } from "../api/mood";
import { localMonth, dateLabel } from "../utils/format";
import { moodLabels } from "./MoodPicker";
import { moodColors } from "./MoodFace";
import { ErrorNotice, Loading } from "./Feedback";
export function MoodCalendar() {
  const [month, setMonth] = useState(localMonth());
  const q = useQuery({
    queryKey: ["mood", "calendar", month],
    queryFn: () => moodApi.calendar(month),
  });
  const [year, m] = month.split("-").map(Number);
  const length = new Date(year, m, 0).getDate();
  const offset = (new Date(year, m - 1, 1).getDay() + 6) % 7;
  return (
    <section className="card">
      <h2>A month at a glance</h2>
      <label htmlFor="calendar-month">Month</label>
      <input
        id="calendar-month"
        type="month"
        required
        value={month}
        onChange={(e) => {
          if (e.target.value) setMonth(e.target.value);
        }}
      />
      <ErrorNotice error={q.error} />
      {q.isPending ? (
        <Loading />
      ) : (
        <>
          <div className="calendar" aria-label="Mood calendar">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={"day" + i} aria-hidden="true">
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={"blank" + i} />
            ))}
            {Array.from({ length }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, "0")}`;
              const day = q.data?.days.find((d) => d.date === date);
              return (
                <span
                  key={date}
                  tabIndex={0}
                  className="calendar-day"
                  style={day ? { backgroundColor: moodColors[day.moodScore - 1] } : undefined}
                  aria-label={`${dateLabel(date)}: ${day ? moodLabels[day.moodScore - 1] : "No check-in"}`}
                  title={day ? moodLabels[day.moodScore - 1] : "No check-in"}
                >
                  {i + 1}
                  {day && <small>{day.moodScore}</small>}
                </span>
              );
            })}
          </div>
          <ul className="mood-legend" aria-label="Check-in color legend">
            {moodLabels.map((label, index) => (
              <li key={label}>
                <span className="mood-legend-swatch" style={{ backgroundColor: moodColors[index] }} aria-hidden="true" />
                <span>{index + 1} · {label}</span>
              </li>
            ))}
            <li>
              <span className="mood-legend-swatch" aria-hidden="true" />
              <span>No check-in</span>
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
