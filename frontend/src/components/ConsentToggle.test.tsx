import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ConsentToggle } from "./ConsentToggle";
test("consent starts off and can be deliberately enabled and withdrawn", async () => {
  function Harness() {
    const [value, setValue] = useState(false);
    return (
      <ConsentToggle
        label="Companion memory"
        description="Optional context"
        checked={value}
        onChange={setValue}
      />
    );
  }
  render(<Harness />);
  const control = screen.getByRole("switch", { name: "Companion memory" });
  expect(control).not.toBeChecked();
  expect(control).toHaveAccessibleDescription("Optional context");
  const user = userEvent.setup();
  await user.tab();
  await user.keyboard("[Space]");
  expect(control).toBeChecked();
  await user.keyboard("[Space]");
  expect(control).not.toBeChecked();
});
