"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import WorkspaceBrand from "@/components/studio/WorkspaceBrand";
import { useAuth } from "@/components/account/useAuth";
import type { AuthResult } from "@/lib/auth";
import {
  ASPECT_OPTIONS,
  RUNTIME_OPTIONS,
  getGenerationSettings,
  saveGenerationSettings,
  type GenerationSettings,
} from "@/lib/settings";
import "../account.css";

export default function SettingsPage() {
  const router = useRouter();
  const { status, user, updateEmail, updatePassword } = useAuth();

  const [email, setEmail] = useState("");
  const [emailResult, setEmailResult] = useState<AuthResult | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [passwordResult, setPasswordResult] = useState<AuthResult | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [settings, setSettings] = useState<GenerationSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) setEmail(user.email);
  }, [user]);
  useEffect(() => {
    setSettings(getGenerationSettings());
  }, []);

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setEmailBusy(true);
    setEmailResult(await updateEmail(email));
    setEmailBusy(false);
  }
  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setPasswordBusy(true);
    const outcome = await updatePassword(currentPassword, nextPassword);
    setPasswordResult(outcome);
    if (outcome.ok) {
      setCurrentPassword("");
      setNextPassword("");
    }
    setPasswordBusy(false);
  }
  function submitSettings(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    saveGenerationSettings(settings);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="studio-workspace account-page">
      <header className="studio-header">
        <WorkspaceBrand
          onClick={() => router.push("/")}
          label="Stu3dio library"
        />
        <span className="studio-header-divider" />
        <span className="studio-project-title">Settings</span>
      </header>
      <main>
        <section
          className="account-panel account-panel--wide"
          aria-labelledby="settings-heading"
        >
          <p>
            <Link href="/">
              <ArrowLeft size={12} /> Back to library
            </Link>
          </p>
          <h1 id="settings-heading">Settings</h1>
          <p>Your account and the defaults every new film starts from.</p>

          <div className="account-section">
            <h2>Account</h2>
            {status === "loading" ? (
              <p>Loading…</p>
            ) : !user ? (
              <p>
                <Link href="/login">Sign in</Link> to manage your email and
                password.
              </p>
            ) : (
              <>
                <form className="account-form" onSubmit={submitEmail}>
                  <div className="account-row">
                    <label
                      className="account-field"
                      data-invalid={
                        emailResult && !emailResult.ok ? "true" : undefined
                      }
                    >
                      <span>Email</span>
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      className="account-submit account-submit--quiet"
                      disabled={emailBusy || email === user.email}
                    >
                      {emailBusy && (
                        <LoaderCircle size={14} className="animate-spin" />
                      )}
                      Update email
                    </button>
                  </div>
                  {emailResult && !emailResult.ok && (
                    <div className="account-error" role="alert">
                      {emailResult.error}
                    </div>
                  )}
                  {emailResult?.ok && (
                    <span className="account-success">Email updated.</span>
                  )}
                </form>
                <form
                  className="account-form"
                  onSubmit={submitPassword}
                  style={{ marginTop: 16 }}
                >
                  <div className="account-grid">
                    <label className="account-field">
                      <span>Current password</span>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(event) =>
                          setCurrentPassword(event.target.value)
                        }
                        required
                      />
                    </label>
                    <label
                      className="account-field"
                      data-invalid={
                        passwordResult && !passwordResult.ok
                          ? "true"
                          : undefined
                      }
                    >
                      <span>New password</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={nextPassword}
                        onChange={(event) =>
                          setNextPassword(event.target.value)
                        }
                        required
                        minLength={8}
                      />
                    </label>
                  </div>
                  {passwordResult && !passwordResult.ok && (
                    <div className="account-error" role="alert">
                      {passwordResult.error}
                    </div>
                  )}
                  {passwordResult?.ok && (
                    <span className="account-success">Password updated.</span>
                  )}
                  <div>
                    <button
                      type="submit"
                      className="account-submit account-submit--quiet"
                      disabled={
                        passwordBusy || !currentPassword || !nextPassword
                      }
                    >
                      {passwordBusy && (
                        <LoaderCircle size={14} className="animate-spin" />
                      )}
                      Update password
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          <form
            className="account-section account-form"
            onSubmit={submitSettings}
          >
            <div>
              <h2>Generation</h2>
              <p>
                Your own model keys and the defaults for a new film. Keys stay
                in this browser and are never uploaded.
              </p>
            </div>
            {settings && (
              <>
                <div className="account-grid">
                  <label className="account-field">
                    <span>Gemini API key</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={settings.geminiKey}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          geminiKey: event.target.value,
                        })
                      }
                      placeholder="AIza…"
                    />
                  </label>
                  <label className="account-field">
                    <span>fal.ai key</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={settings.falKey}
                      onChange={(event) =>
                        setSettings({ ...settings, falKey: event.target.value })
                      }
                      placeholder="key_id:secret"
                    />
                  </label>
                </div>
                <div className="account-grid">
                  <label className="account-field">
                    <span>Default runtime</span>
                    <select
                      value={settings.runtimeSeconds}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          runtimeSeconds: Number(event.target.value),
                        })
                      }
                    >
                      {RUNTIME_OPTIONS.map((seconds) => (
                        <option key={seconds} value={seconds}>
                          {seconds < 60
                            ? `${seconds}s`
                            : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}{" "}
                          · {seconds / 8} shots
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="account-field">
                    <span>Aspect ratio</span>
                    <select
                      value={settings.aspectRatio}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          aspectRatio: event.target
                            .value as GenerationSettings["aspectRatio"],
                        })
                      }
                    >
                      {ASPECT_OPTIONS.map((ratio) => (
                        <option key={ratio} value={ratio}>
                          {ratio}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div>
                  <button type="submit" className="account-submit">
                    Save settings
                  </button>
                  {saved && (
                    <span
                      className="account-success"
                      style={{ marginLeft: 12 }}
                    >
                      Saved.
                    </span>
                  )}
                </div>
              </>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}
