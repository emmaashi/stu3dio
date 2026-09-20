import { beforeEach, describe, expect, it } from "vitest";
import { createLocalAuthClient } from "@/lib/auth/localAuth";
import { initialsFor, validateSignUp } from "@/lib/auth";

describe("browser-local accounts", () => {
  beforeEach(() => window.localStorage.clear());

  it("creates an account, signs in by email or username, and signs out", async () => {
    const auth = createLocalAuthClient();
    const created = await auth.signUp({
      email: "Emma@Example.com",
      username: "Emma_S",
      password: "correct horse",
    });
    expect(created).toMatchObject({
      ok: true,
      user: { email: "emma@example.com", username: "emma_s" },
    });
    expect(await auth.getUser()).toMatchObject({ username: "emma_s" });

    await auth.signOut();
    expect(await auth.getUser()).toBeNull();

    expect(
      await auth.signIn({ identifier: "emma_s", password: "correct horse" }),
    ).toMatchObject({ ok: true });
    expect(
      await auth.signIn({ identifier: "emma@example.com", password: "wrong" }),
    ).toMatchObject({
      ok: false,
      field: "password",
    });
    expect(
      window.localStorage.getItem("stu3dio.auth.accounts.v1"),
    ).not.toContain("correct horse");
  });

  it("refuses duplicate emails and usernames", async () => {
    const auth = createLocalAuthClient();
    await auth.signUp({
      email: "one@example.com",
      username: "one",
      password: "password1",
    });
    expect(
      await auth.signUp({
        email: "ONE@example.com",
        username: "two",
        password: "password1",
      }),
    ).toMatchObject({
      ok: false,
      field: "email",
    });
    expect(
      await auth.signUp({
        email: "two@example.com",
        username: "one",
        password: "password1",
      }),
    ).toMatchObject({
      ok: false,
      field: "username",
    });
  });

  it("validates sign-up input and updates credentials", async () => {
    expect(
      validateSignUp({
        email: "nope",
        username: "ok_name",
        password: "password1",
      })?.field,
    ).toBe("email");
    expect(
      validateSignUp({
        email: "a@b.co",
        username: "No Spaces",
        password: "password1",
      })?.field,
    ).toBe("username");
    expect(
      validateSignUp({ email: "a@b.co", username: "fine", password: "short" })
        ?.field,
    ).toBe("password");
    expect(
      initialsFor({
        displayName: "Emma Shi",
        username: "emma",
        email: "e@x.co",
      }),
    ).toBe("ES");
    expect(
      initialsFor({ displayName: "", username: "thom", email: "t@x.co" }),
    ).toBe("TH");

    const auth = createLocalAuthClient();
    await auth.signUp({
      email: "a@b.co",
      username: "abc",
      password: "password1",
    });
    expect(await auth.updateEmail("new@b.co")).toMatchObject({
      ok: true,
      user: { email: "new@b.co" },
    });
    expect(await auth.updatePassword("wrong", "password2")).toMatchObject({
      ok: false,
    });
    expect(await auth.updatePassword("password1", "password2")).toMatchObject({
      ok: true,
    });
    await auth.signOut();
    expect(
      await auth.signIn({ identifier: "new@b.co", password: "password2" }),
    ).toMatchObject({ ok: true });
  });
});
