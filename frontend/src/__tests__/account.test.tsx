import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AccountMenu from "@/components/account/AccountMenu";
import SettingsPage from "@/app/settings/page";
import { initialsFor } from "@/lib/account";
import { getGenerationSettings } from "@/lib/settings";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("account UI (mocked user)", () => {
  it("shows the signed-in pill with a Settings menu and an inert Sign out", () => {
    render(<AccountMenu />);
    expect(screen.getByText("Emma Shi")).toBeInTheDocument();
    expect(screen.getByText("ES")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeDisabled();
  });

  it("derives initials from a name or a handle", () => {
    expect(initialsFor({ name: "Emma Shi", username: "emmashi" })).toBe("ES");
    expect(initialsFor({ name: "", username: "thom_k" })).toBe("TK");
  });

  it("saves generation defaults from the settings page", () => {
    window.localStorage.clear();
    render(<SettingsPage />);
    expect(screen.getByText("Emma Shi")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Aspect ratio"), {
      target: { value: "9:16" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(getGenerationSettings().aspectRatio).toBe("9:16");
    expect(screen.getByText("Saved.")).toBeInTheDocument();
  });
});
