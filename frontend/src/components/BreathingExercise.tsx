import { useEffect, useState } from "react";
export function BreathingExercise() {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(false);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setPhase((p) => !p), 4000);
    return () => clearInterval(t);
  }, [running]);
  return (
    <section className="card exercise">
      <h2>A gentle breathing pause</h2>
      <p>
        If it feels comfortable, breathe at your own pace. You can stop anytime.
      </p>
      <div
        className={"breath-circle " + (running ? "running" : "")}
        aria-hidden="true"
      />
      <p role="status">
        {running
          ? phase
            ? "Breathe out gently"
            : "Breathe in gently"
          : "Begin when you’re ready"}
      </p>
      <button
        className="secondary"
        onClick={() => {
          setPhase(false);
          setRunning(!running);
        }}
      >
        {running ? "Stop exercise" : "Begin exercise"}
      </button>
    </section>
  );
}
export function ExerciseCard({
  title,
  steps,
}: {
  title: string;
  steps: string[];
}) {
  return (
    <details className="card">
      <summary>{title}</summary>
      <ol>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </details>
  );
}
