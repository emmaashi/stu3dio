"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import WorkspaceBrand from "@/components/studio/WorkspaceBrand";
import { CURRENT_USER, initialsFor } from "@/lib/account";
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
  const user = CURRENT_USER;
  const [settings, setSettings] = useState<GenerationSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(getGenerationSettings());
  }, []);

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
            <p>Email and password changes arrive with sign-in.</p>
            <div className="account-identity">
              <span
                className="account-avatar account-avatar--large"
                aria-hidden="true"
              >
                {initialsFor(user)}
              </span>
              <div>
                <strong>{user.name}</strong>
                <span>@{user.username}</span>
                <span>{user.email}</span>
              </div>
            </div>
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
