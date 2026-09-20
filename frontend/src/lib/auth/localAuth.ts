import {
  normalizeEmail,
  normalizeUsername,
  validateSignUp,
  type AuthClient,
  type AuthUser,
} from "./types";

/**
 * Browser-local accounts for the offline demo. Nothing leaves this browser;
 * passwords are stored as a SHA-256 digest so a glance at storage shows none.
 */
type StoredAccount = AuthUser & { passwordHash: string; createdAt: string };

const ACCOUNTS_KEY = "stu3dio.auth.accounts.v1";
const SESSION_KEY = "stu3dio.auth.session.v1";

const isBrowser = () => typeof window !== "undefined";

function readAccounts(): StoredAccount[] {
  if (!isBrowser()) return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(ACCOUNTS_KEY) || "[]",
    );
    return Array.isArray(parsed) ? (parsed as StoredAccount[]) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

async function digest(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const bytes = await subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  }
  // Test environments without WebCrypto: a stable non-cryptographic fallback.
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `plain-${hash.toString(16)}`;
}

function publicUser(account: StoredAccount): AuthUser {
  return {
    id: account.id,
    email: account.email,
    username: account.username,
    displayName: account.displayName,
  };
}

export function createLocalAuthClient(): AuthClient {
  const listeners = new Set<(user: AuthUser | null) => void>();
  const current = (): AuthUser | null => {
    if (!isBrowser()) return null;
    const id = window.localStorage.getItem(SESSION_KEY);
    const account = readAccounts().find((item) => item.id === id);
    return account ? publicUser(account) : null;
  };
  const setSession = (id: string | null) => {
    if (!isBrowser()) return;
    if (id) window.localStorage.setItem(SESSION_KEY, id);
    else window.localStorage.removeItem(SESSION_KEY);
    const user = current();
    listeners.forEach((listener) => listener(user));
  };

  return {
    mode: "local",
    async getUser() {
      return current();
    },
    onChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    async signUp(input) {
      const invalid = validateSignUp(input);
      if (invalid) return invalid;
      const email = normalizeEmail(input.email);
      const username = normalizeUsername(input.username);
      const accounts = readAccounts();
      if (accounts.some((account) => account.email === email))
        return {
          ok: false,
          field: "email",
          error: "An account with this email already exists. Sign in instead.",
        };
      if (accounts.some((account) => account.username === username))
        return {
          ok: false,
          field: "username",
          error: "That username is taken.",
        };
      const account: StoredAccount = {
        id: globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}`,
        email,
        username,
        displayName: username,
        passwordHash: await digest(input.password),
        createdAt: new Date().toISOString(),
      };
      writeAccounts([...accounts, account]);
      setSession(account.id);
      return { ok: true, user: publicUser(account) };
    },
    async signIn(input) {
      const identifier = input.identifier.trim().toLowerCase();
      const account = readAccounts().find(
        (item) => item.email === identifier || item.username === identifier,
      );
      if (!account || account.passwordHash !== (await digest(input.password)))
        return {
          ok: false,
          field: "password",
          error: "That email or password is not right.",
        };
      setSession(account.id);
      return { ok: true, user: publicUser(account) };
    },
    async signOut() {
      setSession(null);
    },
    async updateEmail(email) {
      const user = current();
      if (!user) return { ok: false, error: "You are signed out." };
      const next = normalizeEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next))
        return {
          ok: false,
          field: "email",
          error: "Enter a valid email address.",
        };
      const accounts = readAccounts();
      if (
        accounts.some(
          (account) => account.email === next && account.id !== user.id,
        )
      )
        return {
          ok: false,
          field: "email",
          error: "Another account already uses this email.",
        };
      writeAccounts(
        accounts.map((account) =>
          account.id === user.id ? { ...account, email: next } : account,
        ),
      );
      const updated = current()!;
      listeners.forEach((listener) => listener(updated));
      return { ok: true, user: updated };
    },
    async updatePassword(currentPassword, nextPassword) {
      const user = current();
      if (!user) return { ok: false, error: "You are signed out." };
      if (nextPassword.length < 8)
        return {
          ok: false,
          field: "password",
          error: "Use at least 8 characters.",
        };
      const accounts = readAccounts();
      const account = accounts.find((item) => item.id === user.id)!;
      if (account.passwordHash !== (await digest(currentPassword)))
        return {
          ok: false,
          field: "password",
          error: "Your current password is not right.",
        };
      const passwordHash = await digest(nextPassword);
      writeAccounts(
        accounts.map((item) =>
          item.id === user.id ? { ...item, passwordHash } : item,
        ),
      );
      return { ok: true, user };
    },
  };
}
