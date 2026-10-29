import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MoodPicker } from "./MoodPicker";
test("mood choices are labelled and keyboard navigable", async () => {
  function Harness() {
    const [value, setValue] = useState<number | null>(null);
    return <MoodPicker value={value} onChange={setValue} />;
  }
  render(<Harness />);
  const user = userEvent.setup();
  await user.tab();
  expect(screen.getByRole("radio", { name: "Sad" })).toHaveFocus();
  await user.keyboard("[ArrowRight]");
  expect(screen.getByRole("radio", { name: "Angry" })).toBeChecked();
  expect(screen.getAllByRole("radio")).toHaveLength(5);
});
