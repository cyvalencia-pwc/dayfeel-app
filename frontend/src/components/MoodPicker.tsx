import { useId } from "react";
import { MoodFace } from "./MoodFace";
export const moodLabels = ["Sad", "Angry", "Stressed", "Calm", "Happy"];
export function MoodPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (score: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset disabled={disabled} className="mood-picker">
      <legend>How does today feel?</legend>
      <div className="mood-options">
        {moodLabels.map((label, i) => (
          <label key={label} className={value === i + 1 ? "selected" : ""}>
            <input
              type="radio"
              name={id}
              value={i + 1}
              checked={value === i + 1}
              onChange={() => onChange(i + 1)}
            />
            <MoodFace score={i + 1} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
