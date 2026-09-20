// The signed-in user, hard-coded until real sign-in lands. The sidebar pill
// and the settings page read from here so the UI is in place today and the
// auth backend can slot in behind it later.

export type AccountUser = {
  name: string;
  username: string;
  email: string;
};

export const CURRENT_USER: AccountUser = {
  name: "Emma Shi",
  username: "emmashi",
  email: "emma@stu3dio.app",
};

export function initialsFor(user: Pick<AccountUser, "name" | "username">) {
  const source = user.name || user.username;
  const parts = source
    .replace(/[@_.-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}
