import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApprovalCard, ConversationNav, LoadingState, PromptBar } from "@/components/beautiful-ui";
import { agentRunFixture } from "@/test/agentFixtures";

describe("Beautiful UI production primitives", () => {
  afterEach(() => vi.useRealTimers());

  it("submits controlled approval values", () => {
    const approve = vi.fn();
    render(<ApprovalCard approval={agentRunFixture.approval!} onApprove={approve} onRevise={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByDisplayValue("Signal"), { target: { value: "Signal from Tomorrow" } });
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(approve).toHaveBeenCalledWith(expect.objectContaining({ title: "Signal from Tomorrow" }));
  });

  it("locks approval actions while submitting", () => {
    render(<ApprovalCard approval={agentRunFixture.approval!} busy onApprove={vi.fn()} onRevise={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /approve/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });

  it("uses the centered summary row for assembly approvals", () => {
    const { container } = render(<ApprovalCard approval={{
      ...agentRunFixture.approval!,
      id: "approval-assembly",
      kind: "assembly",
      title: "Assemble the final film?",
      fields: [],
      values: { clips: 8, runtime_seconds: 64, aspect_ratio: "16:9", audio: "generated" },
    }} onApprove={vi.fn()} onRevise={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("8 clips · 64 seconds")).toBeInTheDocument();
    expect(container.querySelector(".agent-approval__body--assembly")).toBeInTheDocument();
  });

  it("derives elapsed loading time from the supplied start timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:05.000Z"));
    render(<LoadingState label="Planning" startedAt="2026-08-28T12:00:00.000Z" />);
    expect(screen.getByText("5.0s")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("6.0s")).toBeInTheDocument();
  });

  it("supports typed multi-select approval fields", () => {
    const approve = vi.fn();
    render(<ApprovalCard approval={{
      ...agentRunFixture.approval!,
      fields: [{ id: "tones", label: "Tones", type: "multi-select", required: true, options: ["Noir", "Intimate"] }],
      values: { tones: [] },
    }} onApprove={approve} onRevise={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Noir" }));
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(approve).toHaveBeenCalledWith({ tones: ["Noir"] });
  });

  it("uploads prompt references and includes them on submit", async () => {
    const send = vi.fn();
    const upload = vi.fn().mockResolvedValue({ id: "ref-1", name: "look.png", url: "https://cdn.test/look.png", mime_type: "image/png", size: 12 });
    const { container } = render(<PromptBar onUploadAttachment={upload} onSend={send} />);
    const file = new File(["reference"], "look.png", { type: "image/png" });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await screen.findByText("look.png");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Use this lighting language" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Send prompt" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Send prompt" }));
    expect(send).toHaveBeenCalledWith("Use this lighting language", [expect.objectContaining({ id: "ref-1" })]);
  });

  it("uses the compact source menu without an enter-to-send hint", () => {
    render(<PromptBar onSend={vi.fn()} />);
    expect(screen.queryByText(/enter to send/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add attachments and project context" }));
    expect(screen.getByRole("listbox", { name: "Project sources" })).toBeInTheDocument();
    expect(screen.getByText("Add reference image")).toBeInTheDocument();
  });

  it("supports a plain selected-asset edit composer", () => {
    const send = vi.fn();
    const { container } = render(<PromptBar allowExtras={false} onSend={send} />);
    expect(screen.queryByRole("button", { name: "Add attachments and project context" })).not.toBeInTheDocument();
    expect(container.querySelector(".agent-prompt-row--plain")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move the camera closer" } });
    fireEvent.click(screen.getByRole("button", { name: "Send prompt" }));
    expect(send).toHaveBeenCalledWith("Move the camera closer", []);
  });

  it("prefills an editable prompt from a starter suggestion", () => {
    render(<PromptBar suggestions={["A quiet character drama"]} onSend={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "A quiet character drama" }));
    expect(screen.getByRole("textbox")).toHaveValue("A quiet character drama");
  });

  it("renders removable linked-asset context in the shared prompt bar", () => {
    const unlink = vi.fn();
    render(<PromptBar
      contexts={[{ id: "lead", label: "The Lead", onClear: unlink }]}
      onSend={vi.fn()}
    />);
    expect(screen.getByText("The Lead")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unlink The Lead" }));
    expect(unlink).toHaveBeenCalledOnce();
  });

  it("renders controlled film conversation navigation", () => {
    const select = vi.fn();
    render(<ConversationNav
      open
      activeId="opening"
      conversations={[{ id: "opening", title: "Explore the opening", updatedLabel: "Yesterday" }]}
      onClose={vi.fn()}
      onNewConversation={vi.fn()}
      onSelect={select}
    />);
    const conversation = screen.getByRole("button", { name: /explore the opening/i });
    expect(conversation).toHaveAttribute("aria-current", "page");
    fireEvent.click(conversation);
    expect(select).toHaveBeenCalledWith("opening");
  });
});
