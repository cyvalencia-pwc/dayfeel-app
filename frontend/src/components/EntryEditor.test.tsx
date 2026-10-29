import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosHeaders } from "axios";
import { content } from "../api/client";
import { EntryEditor } from "./EntryEditor";
import { CrisisScreen } from "./CrisisScreen";
import { useCrisis } from "../store/crisis";
test("entry crisis response blocks continuation until the support screen is acknowledged", async () => {
  const original = content.defaults.adapter;
  const saved = vi.fn();
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  content.defaults.adapter = async (config) => ({
    config,
    status: 201,
    statusText: "Created",
    headers: new AxiosHeaders(),
    data: {
      entry: { _id: "entry-1" },
      streak: 1,
      support: {
        crisisDetected: true,
        message: "You deserve support. Reach out to someone you trust.",
        resources: [
          {
            name: "Support directory",
            url: "https://example.org",
            region: "GLOBAL",
          },
        ],
      },
    },
  });
  try {
    render(
      <QueryClientProvider client={client}>
        <EntryEditor onSaved={saved} />
        <CrisisScreen />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Angry" }));
    await user.type(
      screen.getByLabelText("What would you like to put into words?"),
      "Today feels overwhelming.",
    );
    await user.click(screen.getByRole("button", { name: "Save entry" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("You deserve support. Reach out to someone you trust."),
    ).toBeInTheDocument();
    expect(saved).not.toHaveBeenCalled();
    await user.keyboard("[Escape]");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /I’ve read this/ }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith("entry-1"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  } finally {
    content.defaults.adapter = original;
    useCrisis.setState({ queue: [] });
    client.clear();
  }
});
