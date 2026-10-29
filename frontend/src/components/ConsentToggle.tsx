import { useId } from "react";
export function ConsentToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="consent-row">
      <div>
        <label htmlFor={id}>{label}</label>
        <p id={id + "-hint"}>{description}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-describedby={id + "-hint"}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
    </div>
  );
}
