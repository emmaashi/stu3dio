"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  ArrowUpRight,
  Clock3,
  FileText,
  Film,
  FolderOpen,
  LoaderCircle,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { createNewProject } from "@/data/projectData";
import { listDemos } from "@/films";
import {
  getRecents,
  getTrashed,
  recordRecent,
  trashRecent,
  restoreRecent,
  deleteTrashedForever,
  isDemoHidden,
  setDemoHidden,
  type RecentProject,
} from "@/lib/recents";
import WorkspaceBrand from "@/components/studio/WorkspaceBrand";
import "./library.css";

type View = "recents" | "drafts" | "trash";
type Card = {
  id: string;
  title: string;
  description: string;
  meta: string;
  poster?: string;
  demo?: boolean;
};
const VIEWS = [
  { id: "recents", label: "Recents", icon: Clock3 },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "trash", label: "Trash", icon: Trash2 },
] as const;
const VIEW_COPY: Record<
  View,
  { title: string; subtitle: string; empty: string; hint: string }
> = {
  recents: {
    title: "Recents",
    subtitle: "",
    empty: "Room for your next story.",
    hint: "Start a film with a character, a scene, or just an idea.",
  },
  drafts: {
    title: "Drafts",
    subtitle: "",
    empty: "Every film starts with an idea.",
    hint: "Create a film and build its world on the canvas.",
  },
  trash: {
    title: "Trash",
    subtitle: "Restore a film to bring it back to your library.",
    empty: "Nothing in the trash.",
    hint: "Films you remove from your library will appear here.",
  },
};
function relativeTime(iso: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (!Number.isFinite(minutes) || minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>("recents");
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [trashed, setTrashed] = useState<RecentProject[]>([]);
  const [hiddenDemoIds, setHiddenDemoIds] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; card: Card } | null>(
    null,
  );
  // Permanent delete asks for a second click on the same menu item.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  function refresh() {
    setRecents(getRecents());
    setTrashed(getTrashed());
    setHiddenDemoIds(
      listDemos()
        .filter((demo) => isDemoHidden(demo.id))
        .map((demo) => demo.id),
    );
  }
  useEffect(() => {
    refresh();
    const compact = window.matchMedia("(max-width: 900px)");
    const resize = () => setSidebarOpen(!compact.matches);
    resize();
    compact.addEventListener("change", resize);
    window.addEventListener("storage", refresh);
    return () => {
      compact.removeEventListener("change", resize);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        menuTrigger.current?.focus();
      }
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [menu]);

  async function createFilm() {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createNewProject({
        title: "Untitled film",
        summary: "",
        plot: "",
      });
      recordRecent({
        id: project.id,
        title: project.title,
        summary: "",
        draft: true,
      });
      router.push(`/studio?project=${project.id}`);
    } catch {
      setError("Couldn’t create a film. Please try again.");
      setCreating(false);
    }
  }
  function visit(card: Card) {
    if (!card.demo) recordRecent({ id: card.id, title: card.title });
  }
  function changeView(next: View) {
    setView(next);
    setQuery("");
    setMenu(null);
    if (window.innerWidth <= 900) setSidebarOpen(false);
  }
  function openMenuAt(x: number, y: number, card: Card, trigger: HTMLElement) {
    menuTrigger.current = trigger;
    setConfirmDelete(false);
    setMenu({
      x: Math.max(8, Math.min(x, window.innerWidth - 190)),
      y: Math.max(8, Math.min(y, window.innerHeight - 108)),
      card,
    });
  }
  function moveToTrash(card: Card) {
    try {
      if (card.demo) setDemoHidden(card.id, true);
      else trashRecent(card.id);
      refresh();
      setMenu(null);
    } catch {
      setError("Couldn’t move this film to the trash. Please try again.");
    }
  }
  function restore(card: Card) {
    try {
      if (card.demo) setDemoHidden(card.id, false);
      else restoreRecent(card.id);
      refresh();
      setMenu(null);
    } catch {
      setError("Couldn’t restore this film. Please try again.");
    }
  }
  function deleteForever(card: Card) {
    try {
      deleteTrashedForever(card.id);
      refresh();
      setMenu(null);
    } catch {
      setError("Couldn’t delete this film. Please try again.");
    }
  }
  const demos: Card[] = listDemos().map((demo) => ({
    id: demo.id,
    title: demo.project.title,
    description: demo.project.summary,
    meta: `${demo.completeStatus.scenes.length} scenes · ${demo.completeStatus.frames.length} shots`,
    poster: demo.poster,
    demo: true,
  }));
  const asCard = (recent: RecentProject): Card => ({
    id: recent.id,
    title: recent.title,
    description: recent.summary?.trim() || "A story waiting to take shape.",
    meta: `Edited ${relativeTime(recent.updatedAt)}`,
    poster: recent.poster,
  });
  const collections: Record<View, Card[]> = {
    recents: [
      ...recents.map(asCard),
      ...demos.filter((demo) => !hiddenDemoIds.includes(demo.id)),
    ],
    drafts: recents.filter((recent) => recent.draft !== false).map(asCard),
    trash: [
      ...trashed.map(asCard),
      ...demos.filter((demo) => hiddenDemoIds.includes(demo.id)),
    ],
  };
  const cards = collections[view].filter((card) =>
    `${card.title} ${card.description}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const copy = VIEW_COPY[view];

  return (
    <MotionConfig reducedMotion="user">
      <div className="studio-workspace library-workspace">
        <header className="studio-header">
          <WorkspaceBrand
            onClick={() => changeView("recents")}
            label="Stu3dio library"
          />
          <span className="studio-header-divider" />
          <span className="studio-project-title">Library</span>
          <div className="studio-header-actions">
            <button
              className="studio-preview-button library-new-film"
              onClick={() => void createFilm()}
              disabled={creating}
            >
              {creating ? (
                <LoaderCircle className="library-spin" size={13} />
              ) : (
                <Plus size={14} />
              )}
              <span>{creating ? "Creating…" : "New film"}</span>
            </button>
          </div>
        </header>
        <div className="studio-body">
          {sidebarOpen && (
            <>
              <button
                className="library-sidebar-scrim"
                aria-label="Close library navigation"
                onClick={() => setSidebarOpen(false)}
              />
              <aside
                className="studio-outline library-sidebar"
                aria-label="Library navigation"
              >
                <div className="studio-outline-top">
                  <span>Your workspace</span>
                  <button
                    className="studio-icon-button"
                    aria-label="Hide library navigation"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <PanelLeftClose size={14} />
                  </button>
                </div>
                <nav aria-label="Films">
                  {VIEWS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      aria-current={view === id ? "page" : undefined}
                      onClick={() => changeView(id)}
                    >
                      <Icon size={15} />
                      <span>{label}</span>
                      <small>{collections[id].length}</small>
                    </button>
                  ))}
                </nav>
              </aside>
            </>
          )}
          <main className="studio-main library-main">
            <div className="library-toolbar">
              <div className="library-toolbar-title">
                {!sidebarOpen && (
                  <button
                    className="studio-icon-button"
                    aria-label="Show library navigation"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <PanelLeftOpen size={15} />
                  </button>
                )}
                <h1>{copy.title}</h1>
                <span className="library-film-count">
                  {collections[view].length}{" "}
                  {collections[view].length === 1 ? "film" : "films"}
                </span>
              </div>
              <label className="library-search">
                <Search size={13} />
                <input
                  ref={searchRef}
                  aria-label="Search films"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a film…"
                />
                {query && (
                  <button
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </label>
            </div>
            <div className="library-scroll">
              {error && (
                <div className="library-error" role="alert">
                  <span>{error}</span>
                  <button
                    aria-label="Dismiss error"
                    onClick={() => setError(null)}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {(query || copy.subtitle) && (
                <p className="library-intro">
                  {query
                    ? `${cards.length} ${cards.length === 1 ? "film" : "films"} matching “${query}”`
                    : copy.subtitle}
                </p>
              )}
              {cards.length ? (
                <div className="library-grid">
                  {cards.map((card) => (
                    <article
                      className="library-film-card"
                      key={card.id}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        openMenuAt(
                          event.clientX,
                          event.clientY,
                          card,
                          event.currentTarget.querySelector<HTMLElement>(
                            "button",
                          )!,
                        );
                      }}
                    >
                      {view === "trash" ? (
                        <div className="library-film-content">
                          <FilmCardContent card={card} />
                          <button
                            className="library-restore"
                            onClick={() => restore(card)}
                            aria-label={`Restore ${card.title}`}
                          >
                            <RotateCcw size={12} />
                            Restore film
                          </button>
                        </div>
                      ) : (
                        <Link
                          className="library-film-content"
                          href={`/studio?project=${encodeURIComponent(card.id)}`}
                          aria-label={`Open ${card.title}`}
                          onClick={() => visit(card)}
                        >
                          <FilmCardContent card={card} />
                        </Link>
                      )}
                      <button
                        className="library-card-menu"
                        aria-label={`Options for ${card.title}`}
                        aria-expanded={menu?.card.id === card.id}
                        onClick={(event) => {
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          openMenuAt(
                            rect.right - 180,
                            rect.bottom + 6,
                            card,
                            event.currentTarget,
                          );
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="library-empty">
                  {query ? (
                    <Search size={24} />
                  ) : view === "trash" ? (
                    <Trash2 size={24} />
                  ) : (
                    <Film size={26} />
                  )}
                  <h2>{query ? "No films found." : copy.empty}</h2>
                  <p>
                    {query
                      ? "Try another title or a detail from your story."
                      : copy.hint}
                  </p>
                  {query ? (
                    <button
                      onClick={() => {
                        setQuery("");
                        searchRef.current?.focus();
                      }}
                    >
                      Clear search
                    </button>
                  ) : (
                    view !== "trash" && (
                      <button
                        onClick={() => void createFilm()}
                        disabled={creating}
                      >
                        <Plus size={14} />
                        New film
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
        <AnimatePresence>
          {menu && (
            <>
              <div
                className="library-menu-scrim"
                onClick={() => setMenu(null)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu(null);
                }}
              />
              <motion.div
                ref={menuRef}
                role="menu"
                aria-label={`Actions for ${menu.card.title}`}
                className="library-menu"
                style={{ left: menu.x, top: menu.y }}
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                onKeyDown={(event) => {
                  const buttons = Array.from(
                    menuRef.current?.querySelectorAll<HTMLButtonElement>(
                      "button",
                    ) || [],
                  );
                  const index = buttons.indexOf(
                    document.activeElement as HTMLButtonElement,
                  );
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    buttons[
                      (index +
                        (event.key === "ArrowDown" ? 1 : buttons.length - 1)) %
                        buttons.length
                    ]?.focus();
                  }
                  if (event.key === "Tab") setMenu(null);
                }}
              >
                {view === "trash" ? (
                  <>
                    <button role="menuitem" onClick={() => restore(menu.card)}>
                      <RotateCcw size={14} />
                      Restore film
                    </button>
                    {/* Sample films are hidden rather than stored, so there is
                        nothing to purge — restoring one always brings it back. */}
                    {!menu.card.demo &&
                      (confirmDelete ? (
                        <button
                          role="menuitem"
                          className="library-menu-danger library-menu-confirm"
                          onClick={() => deleteForever(menu.card)}
                        >
                          <TriangleAlert size={14} />
                          Delete forever
                        </button>
                      ) : (
                        <button
                          role="menuitem"
                          className="library-menu-danger"
                          onClick={() => setConfirmDelete(true)}
                        >
                          <Trash2 size={14} />
                          Delete permanently
                        </button>
                      ))}
                  </>
                ) : (
                  <>
                    <button
                      role="menuitem"
                      onClick={() => {
                        visit(menu.card);
                        router.push(`/studio?project=${menu.card.id}`);
                        setMenu(null);
                      }}
                    >
                      <FolderOpen size={14} />
                      Open canvas
                      <ArrowUpRight size={12} />
                    </button>
                    <button
                      role="menuitem"
                      className="library-menu-danger"
                      onClick={() => moveToTrash(menu.card)}
                    >
                      <Trash2 size={14} />
                      Move to trash
                    </button>
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function FilmCardContent({ card }: { card: Card }) {
  return (
    <>
      <div className="library-film-cover">
        {card.poster ? (
          <img src={card.poster} alt="" draggable={false} />
        ) : (
          <div className="library-film-placeholder">
            <Film size={24} />
          </div>
        )}
      </div>
      <div className="library-film-caption">
        <h2>{card.title}</h2>
        <p>{card.description}</p>
      </div>
    </>
  );
}
