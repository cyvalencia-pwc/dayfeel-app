import type { I } from "../types";
import { ConsentToggle } from "./ConsentToggle";
export function ConsentFields({
  value,
  onChange,
  disabled,
}: {
  value: I["Consent"];
  onChange: (value: I["Consent"]) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {(
        [
          [
            "companionMemory",
            "Companion memory",
            "Let the companion use recent mood patterns for context.",
          ],
        ] as const
      ).map(([key, label, description]) => (
        <ConsentToggle
          key={key}
          label={label}
          description={description}
          checked={value[key]}
          onChange={(checked) => onChange({ ...value, [key]: checked })}
          disabled={disabled}
        />
      ))}
      <p className="muted">
        These choices start off. You can change them anytime in Settings. Safety
        checks still run when you write.
      </p>
    </>
  );
}
