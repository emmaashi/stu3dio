import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { getRecents, getTrashed, recordRecent } from "@/lib/recents";

const { push, createProject } = vi.hoisted(() => ({
  push: vi.fn(),
  createProject: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/data/projectData", () => ({ createNewProject: createProject }));

describe("Film library", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal(
      "matchMedia",
      vi
        .fn()
        .mockImplementation((query) => ({
          matches: false,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
        })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uses the lowercase workspace logo and direct links into the canvas", () => {
    render(<Home />);
    expect(
      screen.getByRole("button", { name: "Stu3dio library" }),
    ).toHaveTextContent("stu3dio");
    expect(
      screen.getByRole("link", { name: "Open Echo Hunter" }),
    ).toHaveAttribute("href", "/studio?project=demo-echo-hunter-001");
    expect(screen.getByRole("button", { name: /Recents/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("searches stories and recovers from an empty result", () => {
    render(<Home />);
    fireEvent.change(screen.getByLabelText("Search films"), {
      target: { value: "megacity" },
    });
    expect(
      screen.getByRole("link", { name: "Open Echo Hunter" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open Tears of Steel" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search films"), {
      target: { value: "does not exist" },
    });
    expect(screen.getByText("No films found.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear search" })[0]);
    expect(
      screen.getByRole("link", { name: "Open Tears of Steel" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search films")).toHaveFocus();
  });

  it("restores a removed sample film through Trash", () => {
    render(<Home />);
    fireEvent.click(
      screen.getByRole("button", { name: "Options for Echo Hunter" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to trash" }));
    expect(
      screen.queryByRole("link", { name: "Open Echo Hunter" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Trash/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Restore Echo Hunter" }),
    );
    expect(screen.getByText("Nothing in the trash.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Recents/ }));
    expect(
      screen.getByRole("link", { name: "Open Echo Hunter" }),
    ).toBeInTheDocument();
  });

  it("preserves all draft metadata when moving to Trash and restoring", () => {
    recordRecent({
      id: "draft-one",
      title: "Signal",
      summary: "A distant message",
      poster: "/signal.png",
      draft: true,
    });
    const original = getRecents()[0];
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Options for Signal" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to trash" }));
    expect(getTrashed()).toEqual([original]);
    expect(getRecents()).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /Trash/ }));
    fireEvent.click(screen.getByRole("button", { name: "Restore Signal" }));
    expect(getRecents()).toEqual([original]);
    expect(getTrashed()).toEqual([]);
  });

  it("can retry project creation and opens the new canvas", async () => {
    createProject
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ id: "created-film", title: "Untitled film" });
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "New film" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn’t create a film",
    );
    fireEvent.click(screen.getByRole("button", { name: "New film" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/studio?project=created-film"),
    );
    expect(getRecents()[0]).toMatchObject({
      id: "created-film",
      title: "Untitled film",
      draft: true,
    });
  });
});
