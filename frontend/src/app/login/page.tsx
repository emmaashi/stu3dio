"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import WorkspaceBrand from "@/components/studio/WorkspaceBrand";
import { useAuth } from "@/components/account/useAuth";
import type { AuthResult } from "@/lib/auth";
import "../account.css";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { mode: authMode, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setResult(null);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const outcome =
        mode === "signin"
          ? await signIn({ identifier, password })
          : await signUp({ email, username, password });
      setResult(outcome);
      if (outcome.ok) router.push("/");
    } finally {
      setBusy(false);
    }
  }

  const error = result && !result.ok ? result : null;
  const invalid = (field: string) =>
    error?.field === field ? "true" : undefined;

  return (
    <div className="studio-workspace account-page">
      <header className="studio-header">
        <WorkspaceBrand
          onClick={() => router.push("/")}
          label="Stu3dio library"
        />
        <span className="studio-header-divider" />
        <span className="studio-project-title">
          {mode === "signin" ? "Sign in" : "Create account"}
        </span>
      </header>
      <main>
        <section className="account-panel" aria-labelledby="account-heading">
          <h1 id="account-heading">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p>
            {mode === "signin"
              ? "Your films, your cast, your cuts. Pick up where you left off."
              : "One account for every film you make here."}
          </p>
          <div
            className="account-tabs"
            role="group"
            aria-label="Sign in or create account"
          >
            <button
              type="button"
              aria-pressed={mode === "signin"}
              onClick={() => switchMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={mode === "signup"}
              onClick={() => switchMode("signup")}
            >
              Create account
            </button>
          </div>
          <form className="account-form" onSubmit={submit} noValidate>
            {mode === "signin" ? (
              <label
                className="account-field"
                data-invalid={invalid("identifier")}
              >
                <span>Email or username</span>
                <input
                  name="identifier"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                />
              </label>
            ) : (
              <>
                <label
                  className="account-field"
                  data-invalid={invalid("email")}
                >
                  <span>Email</span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
                <label
                  className="account-field"
                  data-invalid={invalid("username")}
                >
                  <span>Username</span>
                  <input
                    name="username"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                  />
                  <small>
                    Lowercase letters, numbers and underscores. 3–24 characters.
                  </small>
                </label>
              </>
            )}
            <label className="account-field" data-invalid={invalid("password")}>
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={mode === "signup" ? 8 : undefined}
              />
              {mode === "signup" && <small>At least 8 characters.</small>}
            </label>
            {error && (
              <div className="account-error" role="alert">
                {error.error}
              </div>
            )}
            <button type="submit" className="account-submit" disabled={busy}>
              {busy && <LoaderCircle size={14} className="animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <p className="account-mode">
            {authMode === "local"
              ? "Accounts are stored in this browser until Supabase is configured."
              : "Accounts are managed by Supabase."}{" "}
            <Link href="/">Continue without an account</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
