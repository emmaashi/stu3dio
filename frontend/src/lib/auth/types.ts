export type AuthUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
};

export type AuthResult =
  | { ok: true; user: AuthUser }
  | {
      ok: false;
      error: string;
      field?: "identifier" | "email" | "username" | "password";
    };

export type AuthFailure = Extract<AuthResult, { ok: false }>;

export type SignUpInput = { email: string; username: string; password: string };
export type SignInInput = { identifier: string; password: string };

/**
 * One interface for accounts, with two implementations: Supabase when the
 * project is configured, and a browser-local store otherwise so the UI works
 * offline exactly like the rest of the demo.
 */
export interface AuthClient {
  readonly mode: "supabase" | "local";
  getUser(): Promise<AuthUser | null>;
  onChange(callback: (user: AuthUser | null) => void): () => void;
  signUp(input: SignUpInput): Promise<AuthResult>;
  signIn(input: SignInInput): Promise<AuthResult>;
  signOut(): Promise<void>;
  updateEmail(email: string): Promise<AuthResult>;
  updatePassword(
    currentPassword: string,
    nextPassword: string,
  ): Promise<AuthResult>;
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateSignUp(input: SignUpInput): AuthFailure | null {
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, field: "email", error: "Enter a valid email address." };
  if (!USERNAME_PATTERN.test(username))
    return {
      ok: false,
      field: "username",
      error:
        "Usernames are 3–24 characters: lowercase letters, numbers, underscores.",
    };
  if (input.password.length < 8)
    return {
      ok: false,
      field: "password",
      error: "Use at least 8 characters.",
    };
  return null;
}

export function initialsFor(
  user: Pick<AuthUser, "displayName" | "username" | "email">,
) {
  const source = user.displayName || user.username || user.email;
  const parts = source
    .replace(/[@_.-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}
