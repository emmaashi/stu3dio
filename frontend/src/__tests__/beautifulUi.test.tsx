import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApprovalCard,
  ConversationNav,
  FilmReadyCard,
  InsightCards,
  LoadingState,
  ProductionProgress,
  PromptBar,
  ScenePlanField,
} from "@/components/beautiful-ui";
import { groupProductionTasks } from "@/lib/productionProgress";
import { agentRunFixture } from "@/test/agentFixtures";

describe("Beautiful UI production primitives", () => {
  afterEach(() => vi.useRealTimers());

  it("submits controlled approval values", () => {
    const approve = vi.fn();
    render(
      <ApprovalCard
        approval={agentRunFixture.approval!}
        onApprove={approve}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("Signal"), {
      target: { value: "Signal from Tomorrow" },
    });
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(approve).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Signal from Tomorrow" }),
    );
  });

  it("reports edited values so a revision typed elsewhere carries them", () => {
    const onValuesChange = vi.fn();
    render(
      <ApprovalCard
        approval={agentRunFixture.approval!}
        onApprove={vi.fn()}
        onCancel={vi.fn()}
        onValuesChange={onValuesChange}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("Signal"), {
      target: { value: "Signal from Tomorrow" },
    });
    expect(onValuesChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Signal from Tomorrow" }),
    );
    expect(
      screen.queryByRole("button", { name: /request changes/i }),
    ).not.toBeInTheDocument();
  });

  it("adjusts planned shot counts and durations from the scene plan", () => {
    const onChange = vi.fn();
    render(
      <ScenePlanField
        id="plan"
        scenes={[
          {
            id: "a",
            title: "The bridge",
            target_frames: 1,
            duration: 8,
            detailed_plot: "Open wide.",
          },
          {
            id: "b",
            title: "The hand",
            target_frames: 3,
            duration: 24,
            detailed_plot: "Close in.",
          },
        ]}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("2 scenes · 4 shots · 32s")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "More shots" })[0]);
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "a", target_frames: 2, duration: 16 }),
      expect.objectContaining({ id: "b", target_frames: 3 }),
    ]);
    expect(
      screen.getAllByRole("button", { name: "Fewer shots" })[0],
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /The hand/ }));
    expect(screen.getByDisplayValue("Close in.")).toBeInTheDocument();
  });

  it("shows production progress as grouped counts, never percentages", () => {
    const running = groupProductionTasks([
      {
        id: "c1",
        label: "Design Thom",
        phase: "assets",
        job_type: "character-generation",
        status: "completed",
        progress: 100,
      },
      {
        id: "video-batch",
        label: "Render video clips",
        phase: "videos",
        job_type: "video-generation",
        status: "running",
        progress: 16,
        completed: 3,
        total: 19,
      },
    ]);
    const { rerender } = render(<ProductionProgress groups={running} active />);
    expect(screen.getByRole("button", { name: /Clips 3\/19/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Render video clips")).toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();

    const done = groupProductionTasks([
      {
        id: "c1",
        label: "Design Thom",
        phase: "assets",
        job_type: "character-generation",
        status: "completed",
        progress: 100,
      },
      {
        id: "video-batch",
        label: "Render video clips",
        phase: "videos",
        job_type: "video-generation",
        status: "completed",
        progress: 100,
        completed: 19,
        total: 19,
      },
    ]);
    rerender(
      <ProductionProgress
        groups={done}
        active={false}
        startedAt="2026-08-28T12:00:00.000Z"
        finishedAt="2026-08-28T12:02:32.000Z"
      />,
    );
    const toggle = screen.getByRole("button", { name: /19 clips rendered/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("2:32")).toBeInTheDocument();

    const failed = groupProductionTasks([
      {
        id: "bad",
        label: "Design Celia",
        phase: "assets",
        job_type: "character-generation",
        status: "failed",
        progress: 0,
        detail: "Provider timeout",
      },
    ]);
    rerender(<ProductionProgress groups={failed} active={false} />);
    expect(screen.getByText("Provider timeout")).toBeInTheDocument();
  });

  it("presents the finished film as a poster with one Play", () => {
    const onPlay = vi.fn();
    const data = {
      title: "Your film is ready",
      artifact_url: "https://cdn/final.mp4",
      metrics: [
        { label: "Clips", value: 19 },
        { label: "Runtime", value: "152s" },
        { label: "Format", value: "16:9" },
      ],
    };
    const { container, rerender } = render(
      <FilmReadyCard data={data} title="Tears of Steel" onPlay={onPlay} />,
    );
    expect(screen.getByText("19 clips · 2:32 · 16:9")).toBeInTheDocument();
    expect(screen.getByText("Tears of Steel")).toBeInTheDocument();
    expect(container.querySelector("video")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Play film" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Play Tears of Steel" }),
    );
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledWith("https://cdn/final.mp4");
    rerender(
      <FilmReadyCard
        data={data}
        poster="https://cdn/poster.jpg"
        onPlay={onPlay}
      />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn/poster.jpg",
    );
    expect(container.querySelector("video")).toBeNull();
  });

  it("renders a media-less insight as a single line", () => {
    const { container } = render(
      <InsightCards
        data={{
          title: "Production ready",
          metrics: [
            { label: "Scenes", value: 10 },
            { label: "Clips", value: 19 },
          ],
        }}
      />,
    );
    expect(screen.getByText("Production ready")).toBeInTheDocument();
    expect(screen.getByText("10 scenes · 19 clips")).toBeInTheDocument();
    expect(container.querySelector(".agent-insight__metrics")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("locks approval actions while submitting", () => {
    render(
      <ApprovalCard
        approval={agentRunFixture.approval!}
        busy
        onApprove={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /approve/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });

  it("uses the centered summary row for assembly approvals", () => {
    const { container } = render(
      <ApprovalCard
        approval={{
          ...agentRunFixture.approval!,
          id: "approval-assembly",
          kind: "assembly",
          title: "Assemble the final film?",
          fields: [],
          values: {
            clips: 8,
            runtime_seconds: 64,
            aspect_ratio: "16:9",
            audio: "generated",
          },
        }}
        onApprove={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("8 clips · 64 seconds")).toBeInTheDocument();
    expect(
      container.querySelector(".agent-approval__body--assembly"),
    ).toBeInTheDocument();
  });

  it("derives elapsed loading time from the supplied start timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:05.000Z"));
    render(
      <LoadingState label="Planning" startedAt="2026-08-28T12:00:00.000Z" />,
    );
    expect(screen.getByText("5.0s")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("6.0s")).toBeInTheDocument();
  });

  it("supports typed multi-select approval fields", () => {
    const approve = vi.fn();
    render(
      <ApprovalCard
        approval={{
          ...agentRunFixture.approval!,
          fields: [
            {
              id: "tones",
              label: "Tones",
              type: "multi-select",
              required: true,
              options: ["Noir", "Intimate"],
            },
          ],
          values: { tones: [] },
        }}
        onApprove={approve}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Noir" }));
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(approve).toHaveBeenCalledWith({ tones: ["Noir"] });
  });

  it("uploads prompt references and includes them on submit", async () => {
    const send = vi.fn();
    const upload = vi.fn().mockResolvedValue({
      id: "ref-1",
      name: "look.png",
      url: "https://cdn.test/look.png",
      mime_type: "image/png",
      size: 12,
    });
    const { container } = render(
      <PromptBar onUploadAttachment={upload} onSend={send} />,
    );
    const file = new File(["reference"], "look.png", { type: "image/png" });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    await screen.findByText("look.png");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Use this lighting language" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send prompt" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send prompt" }));
    expect(send).toHaveBeenCalledWith("Use this lighting language", [
      expect.objectContaining({ id: "ref-1" }),
    ]);
  });

  it("uses the compact source menu without an enter-to-send hint", () => {
    render(<PromptBar onSend={vi.fn()} />);
    expect(screen.queryByText(/enter to send/i)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add attachments and project context",
      }),
    );
    expect(
      screen.getByRole("listbox", { name: "Project sources" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Add reference image")).toBeInTheDocument();
  });

  it("supports a plain selected-asset edit composer", () => {
    const send = vi.fn();
    const { container } = render(
      <PromptBar allowExtras={false} onSend={send} />,
    );
    expect(
      screen.queryByRole("button", {
        name: "Add attachments and project context",
      }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".agent-prompt-row--plain"),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Move the camera closer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send prompt" }));
    expect(send).toHaveBeenCalledWith("Move the camera closer", []);
  });

  it("prefills an editable prompt from a starter suggestion", () => {
    render(
      <PromptBar suggestions={["A quiet character drama"]} onSend={vi.fn()} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "A quiet character drama" }),
    );
    expect(screen.getByRole("textbox")).toHaveValue("A quiet character drama");
  });

  it("renders removable linked-asset context in the shared prompt bar", () => {
    const unlink = vi.fn();
    render(
      <PromptBar
        contexts={[{ id: "lead", label: "The Lead", onClear: unlink }]}
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByText("The Lead")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unlink The Lead" }));
    expect(unlink).toHaveBeenCalledOnce();
  });

  it("renders controlled film conversation navigation", () => {
    const select = vi.fn();
    render(
      <ConversationNav
        open
        activeId="opening"
        conversations={[
          {
            id: "opening",
            title: "Explore the opening",
            updatedLabel: "Yesterday",
          },
        ]}
        onClose={vi.fn()}
        onSelect={select}
      />,
    );
    const conversation = screen.getByRole("button", {
      name: /explore the opening/i,
    });
    expect(conversation).toHaveAttribute("aria-current", "page");
    fireEvent.click(conversation);
    expect(select).toHaveBeenCalledWith("opening");
  });

  it("filters mentions and accepts a keyboard choice without submitting the draft", () => {
    const send = vi.fn();
    render(
      <PromptBar
        onSend={send}
        contextOptions={[
          { id: "lead", label: "The Lead", kind: "character" },
          { id: "echo", label: "Echo", kind: "character" },
        ]}
      />,
    );
    const prompt = screen.getByRole("textbox");
    fireEvent.change(prompt, { target: { value: "Revise @Ec" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(prompt, { key: "Enter" });
    expect(prompt).toHaveValue("Revise @Echo ");
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.keyDown(prompt, { key: "Enter" });
    expect(send).toHaveBeenCalledWith("Revise @Echo", []);
  });

  it("dismisses the context picker when clicking outside", () => {
    render(<PromptBar onSend={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add attachments and project context",
      }),
    );
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps independent unfinished drafts when switching between assets and the film", () => {
    const send = vi.fn();
    const { rerender } = render(<PromptBar draftKey="film" onSend={send} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Continue the story" },
    });
    rerender(<PromptBar draftKey="character" onSend={send} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Give her a red coat" },
    });
    rerender(<PromptBar draftKey="film" onSend={send} />);
    expect(screen.getByRole("textbox")).toHaveValue("Continue the story");
    rerender(<PromptBar draftKey="character" onSend={send} />);
    expect(screen.getByRole("textbox")).toHaveValue("Give her a red coat");
  });
});
