import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatBox } from "./ChatBox";

afterEach(() => {
  vi.restoreAllMocks();
});

test("sends a message and renders the user message and the reply", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ reply: "gm anon", persona: "x" }), { status: 200 }),
  );

  render(<ChatBox agentId="agent-1" />);

  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "wen moon" } });
  fireEvent.click(screen.getByRole("button", { name: /send/i }));

  expect(await screen.findByText("wen moon")).toBeInTheDocument();
  expect(await screen.findByText("gm anon")).toBeInTheDocument();
});

test("shows a friendly notice when the API returns 503", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: "chat not configured: set ANTHROPIC_API_KEY" }), {
      status: 503,
    }),
  );

  render(<ChatBox agentId="agent-1" />);

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "hi" } });
  fireEvent.click(screen.getByRole("button", { name: /send/i }));

  await waitFor(() => {
    expect(screen.getByText(/chat coming online/i)).toBeInTheDocument();
  });
});
