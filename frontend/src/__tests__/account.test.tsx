import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountMenu from "@/components/account/AccountMenu";
import LoginPage from "@/app/login/page";
import { createLocalAuthClient } from "@/lib/auth/localAuth";
import { setAuthClientForTests } from "@/lib/auth";
import { useAuthStore } from "@/store/useAuthStore";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("accounts UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
    setAuthClientForTests(createLocalAuthClient());
    useAuthStore.setState({ status: "loading", user: null, mode: "local" });
  });

  it("shows a Guest pill whose menu offers Sign in when nobody is signed in", async () => {
    render(<AccountMenu />);
    expect(await screen.findByText("Guest")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitem", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.queryByRole("menuitem", { name: "Sign out" })).toBeNull();
  });

  it("creates an account from the sign-in page and shows it in the sidebar menu", async () => {
    render(<LoginPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Create account", pressed: false }),
    );
    fireEvent.change(screen.getByLabelText(/^Email/), {
      target: { value: "emma@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Username/), {
      target: { value: "emma" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), {
      target: { value: "password1" },
    });
    fireEvent.submit(screen.getByLabelText(/^Password/).closest("form")!);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(useAuthStore.getState().user?.username).toBe("emma");

    render(<AccountMenu />);
    expect(await screen.findByText("emma")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() =>
      expect(useAuthStore.getState().status).toBe("signed-out"),
    );
    expect(await screen.findByText("Guest")).toBeInTheDocument();
  });

  it("explains a duplicate email instead of creating a second account", async () => {
    await createLocalAuthClient().signUp({
      email: "emma@example.com",
      username: "emma",
      password: "password1",
    });
    await createLocalAuthClient().signOut();
    render(<LoginPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Create account", pressed: false }),
    );
    fireEvent.change(screen.getByLabelText(/^Email/), {
      target: { value: "emma@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Username/), {
      target: { value: "emma2" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), {
      target: { value: "password1" },
    });
    fireEvent.submit(screen.getByLabelText(/^Password/).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /already exists/,
    );
    expect(push).not.toHaveBeenCalled();
  });
});
