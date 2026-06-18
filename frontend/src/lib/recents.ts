// localStorage-backed list of recently-opened / created films.
// The mock backend is in-memory (resets on reload), so this just lets the
// dashboard show a persistent "Recents"/"Drafts" list of project entries.

export type RecentProject = {
  id: string;
  title: string;
  summary?: string; // one-sentence description
  poster?: string; // thumbnail image URL for the library card
  updatedAt: string; // ISO
  createdAt: string; // ISO
  draft?: boolean; // user-created (vs the pinned demo)
};

const KEY = "stu3dio.recents.v1";
const isBrowser = () => typeof window !== "undefined";

export function getRecents(): RecentProject[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentProject[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

function save(list: RecentProject[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / serialization errors */
  }
}

// Insert or update an entry, bumping updatedAt to now.
export function recordRecent(entry: {
  id: string;
  title: string;
  summary?: string;
  poster?: string;
  draft?: boolean;
}): void {
  if (!isBrowser()) return;
  const now = new Date().toISOString();
  const list = getRecents();
  const existing = list.find((r) => r.id === entry.id);
  if (existing) {
    existing.title = entry.title || existing.title;
    if (entry.summary !== undefined) existing.summary = entry.summary;
    if (entry.poster !== undefined) existing.poster = entry.poster;
    existing.updatedAt = now;
    if (entry.draft !== undefined) existing.draft = entry.draft;
  } else {
    list.push({
      id: entry.id,
      title: entry.title || "Untitled film",
      summary: entry.summary,
      poster: entry.poster,
      createdAt: now,
      updatedAt: now,
      draft: entry.draft ?? true,
    });
  }
  save(list);
}

export function removeRecent(id: string): void {
  if (!isBrowser()) return;
  save(getRecents().filter((r) => r.id !== id));
}

// Pinned demos live outside the recents list; allow hiding each one by id.
const DEMO_HIDDEN_KEY = "stu3dio.demoHidden.v2";
function hiddenDemoSet(): Set<string> {
  if (!isBrowser()) return new Set();
  try {
    const raw = window.localStorage.getItem(DEMO_HIDDEN_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
export function isDemoHidden(id: string): boolean {
  return hiddenDemoSet().has(id);
}
export function setDemoHidden(id: string, v: boolean): void {
  if (!isBrowser()) return;
  const set = hiddenDemoSet();
  if (v) set.add(id);
  else set.delete(id);
  window.localStorage.setItem(DEMO_HIDDEN_KEY, JSON.stringify([...set]));
}
