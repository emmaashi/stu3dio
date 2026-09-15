import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import FilmPlayer from "@/components/FilmPlayer";

vi.mock("@/hooks/useHls", () => ({ useHls: vi.fn() }));
const play = vi.fn().mockResolvedValue(undefined);
const pause = vi.fn();
const load = vi.fn();

describe("FilmPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperties(HTMLMediaElement.prototype, {
      play: { configurable: true, value: play },
      pause: { configurable: true, value: pause },
      load: { configurable: true, value: load },
      duration: { configurable: true, get: () => 100 },
    });
  });
  afterEach(() => vi.useRealTimers());

  it("plays from the compact controls and removes the center overlay during playback", () => {
    const { container } = render(<FilmPlayer src="test.mp4" />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(play).toHaveBeenCalledOnce();
    fireEvent.play(container.querySelector("video")!);
    expect(screen.getAllByRole("button", { name: "Pause" })).toHaveLength(1);
    expect(
      screen.queryByLabelText("Play video overlay"),
    ).not.toBeInTheDocument();
  });

  it("keeps secondary actions behind one menu and persists playback speed", () => {
    const { container } = render(<FilmPlayer src="test.mp4" />);
    expect(screen.queryByLabelText("Playback speed")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Download video" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Playback options" }));
    fireEvent.change(screen.getByLabelText("Playback speed"), {
      target: { value: "0.5" },
    });
    expect(window.localStorage.getItem("filmRate")).toBe("0.5");
    expect(container.querySelector("video")!.playbackRate).toBe(0.5);
    fireEvent.keyDown(screen.getByLabelText("Playback speed"), {
      key: "Escape",
    });
    expect(screen.queryByLabelText("Playback speed")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Playback options" }),
    ).toHaveFocus();
  });

  it("scopes playback shortcuts to the focused player", () => {
    const { container } = render(
      <>
        <textarea aria-label="Story draft" />
        <FilmPlayer src="test.mp4" />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText("Film player"), { code: "Space" });
    expect(play).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByLabelText("Story draft"), { code: "Space" });
    expect(play).toHaveBeenCalledOnce();
    fireEvent.loadedMetadata(container.querySelector("video")!);
    fireEvent.keyDown(screen.getByLabelText("Film player"), {
      code: "ArrowRight",
    });
    expect(container.querySelector("video")!.currentTime).toBe(5);
  });

  it("preserves volume across mute and unmute", () => {
    const { container } = render(<FilmPlayer src="test.mp4" />);
    fireEvent.change(screen.getByLabelText("Volume"), {
      target: { value: "0.35" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(container.querySelector("video")!.muted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
    expect(container.querySelector("video")!.muted).toBe(false);
    expect(container.querySelector("video")!.volume).toBe(0.35);
  });

  it("seeks with the scrubber and reports playback time", () => {
    const { container } = render(<FilmPlayer src="test.mp4" />);
    fireEvent.loadedMetadata(container.querySelector("video")!);
    fireEvent.change(screen.getByLabelText("Video progress"), {
      target: { value: "42" },
    });
    expect(container.querySelector("video")!.currentTime).toBe(42);
    expect(screen.getByLabelText("Video progress")).toHaveAttribute(
      "aria-valuetext",
      "0:42 of 1:40",
    );
  });

  it("keeps the media element mounted so retry can reload it", async () => {
    const { container } = render(<FilmPlayer src="test.mp4" />);
    const video = container.querySelector("video")!;
    fireEvent.error(video);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This video couldn’t load.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(load).toHaveBeenCalledOnce();
    expect(container.querySelector("video")).toBe(video);
    fireEvent.canPlay(video);
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });

  it("fades the controls during playback and reveals them on pointer movement", () => {
    vi.useFakeTimers();
    const { container } = render(<FilmPlayer src="test.mp4" />);
    const player = screen.getByLabelText("Film player");
    fireEvent.play(container.querySelector("video")!);
    act(() => vi.advanceTimersByTime(2500));
    expect(player.className).toContain("idle");
    fireEvent.pointerMove(player);
    expect(player.className).not.toContain("idle");
    fireEvent.click(screen.getByRole("button", { name: "Playback options" }));
    act(() => vi.advanceTimersByTime(2500));
    expect(player.className).not.toContain("idle");
  });

  it("closes the preview with Escape and restores the launcher's focus", () => {
    const close = vi.fn();
    const launcher = document.createElement("button");
    document.body.appendChild(launcher);
    launcher.focus();
    const view = render(
      <FilmPlayer src="test.mp4" title="Signal" onClose={close} />,
    );
    expect(screen.getByRole("button", { name: "Close player" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Close player" }), {
      key: "Escape",
    });
    expect(close).toHaveBeenCalledOnce();
    view.unmount();
    expect(launcher).toHaveFocus();
    launcher.remove();
  });

  it("shows an honest empty state without a nonfunctional refresh action", () => {
    render(<FilmPlayer src={null} />);
    expect(screen.getByText("Film not available")).toBeInTheDocument();
    expect(screen.getByText("No video source provided")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Refresh Link" }),
    ).not.toBeInTheDocument();
  });

  it("preserves embedded film playback without duplicate controls", () => {
    const { container } = render(
      <FilmPlayer
        src="https://www.youtube.com/embed/example"
        title="Signal"
        autoplay
      />,
    );
    expect(screen.getByTitle("Signal")).toHaveAttribute(
      "src",
      expect.stringContaining("autoplay=1"),
    );
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByLabelText("Video progress")).not.toBeInTheDocument();
  });
});
