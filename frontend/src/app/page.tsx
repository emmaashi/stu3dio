"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createNewProject } from "@/data/projectData";
import { listDemos } from "@/data/demos";
import { HP_POSTER } from "@/data/hpFilm";
import {
  getRecents,
  recordRecent,
  removeRecent,
  isDemoHidden,
  setDemoHidden,
  type RecentProject,
} from "@/lib/recents";
import { Icon } from "@/components/studio/Icon";
import { cn } from "@/lib/utils";

type View = "recents" | "drafts" | "trash";

type Card = {
  id: string;
  title: string;
  description: string;
  meta: string;
  poster?: string;
  demo?: boolean;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>("recents");
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [hiddenDemoIds, setHiddenDemoIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; card: Card } | null>(
    null
  );

  useEffect(() => {
    setRecents(getRecents());
    setHiddenDemoIds(
      listDemos().filter((d) => isDemoHidden(d.id)).map((d) => d.id)
    );
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  function deleteCard(card: Card) {
    if (card.demo) {
      setDemoHidden(card.id, true);
      setHiddenDemoIds((prev) =>
        prev.includes(card.id) ? prev : [...prev, card.id]
      );
    } else {
      removeRecent(card.id);
      setRecents(getRecents());
    }
    setMenu(null);
  }

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
      recordRecent({ id: project.id, title: project.title, summary: "", draft: true });
      router.push(`/studio?project=${project.id}`);
    } catch {
      setError("Couldn't create a film. Try reloading.");
      setCreating(false);
    }
  }

  function open(c: Card) {
    if (!c.demo) recordRecent({ id: c.id, title: c.title, draft: true });
    router.push(`/studio?project=${c.id}`);
  }

  function openMenuAt(clientX: number, clientY: number, card: Card) {
    // keep the menu inside the viewport
    const x = Math.min(clientX, window.innerWidth - 168);
    const y = Math.min(clientY, window.innerHeight - 110);
    setMenu({ x, y, card });
  }

  const demoCards: Card[] = listDemos()
    .filter((d) => !hiddenDemoIds.includes(d.id))
    .map((d) => ({
      id: d.id,
      title: d.project.title,
      description: d.project.summary,
      meta: "Demo film",
      poster: d.poster,
      demo: true,
    }));
  const recentCards: Card[] = recents.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.summary?.trim() || "Draft — not started yet.",
    meta: `Edited ${relativeTime(r.updatedAt)}`,
    // Mock turns every film into Harry Potter, so fall back to the HP poster
    // for any draft that hasn't captured its own thumbnail yet.
    poster: r.poster ?? HP_POSTER,
  }));

  const cards: Card[] =
    view === "trash"
      ? []
      : view === "drafts"
      ? recentCards
      : [...demoCards, ...recentCards];

  const navItems: { id: View; label: string; icon: string }[] = [
    { id: "recents", label: "Recents", icon: "clock" },
    { id: "drafts", label: "Drafts", icon: "drafts" },
    { id: "trash", label: "Trash", icon: "trash" },
  ];

  const VIEW_META: Record<View, { title: string; sub: string }> = {
    recents: { title: "Recents", sub: "Pick up where you left off." },
    drafts: { title: "Drafts", sub: "Films you've started." },
    trash: { title: "Trash", sub: "Films you've deleted." },
  };
  const meta = VIEW_META[view];

  return (
    <div className="grid grid-cols-[248px_1fr] h-screen bg-surface-0 text-ink">
      {/* Sidebar */}
      <aside className="flex flex-col gap-[18px] px-4 py-5 border-r border-hair bg-surface-1">
        <div className="px-1.5 pt-1 pb-0.5">
          <span className="text-[19px] font-extrabold tracking-[-.01em] text-ink">
            STU<em className="not-italic text-accent">3</em>DIO
          </span>
        </div>
        <button
          className="flex items-center gap-[11px] px-[11px] py-[9px] rounded-[10px] text-sm font-semibold text-left text-accent-ink bg-[linear-gradient(180deg,color-mix(in_oklab,var(--accent)_92%,#fff_8%),var(--accent))] transition-[filter] duration-200 hover:brightness-105 disabled:opacity-70 disabled:cursor-default"
          onClick={createFilm}
          disabled={creating}
        >
          <Icon name="plus" size={16} />
          <span>{creating ? "Creating…" : "New film"}</span>
        </button>
        <nav className="flex flex-col gap-0.5 mt-0.5">
          {navItems.map((n) => (
            <button
              key={n.id}
              className={cn(
                "flex items-center gap-[11px] px-[11px] py-[9px] rounded-[10px] text-sm font-medium text-left transition-colors duration-200",
                view === n.id
                  ? "bg-glass-2 text-ink"
                  : "text-ink-2 hover:bg-glass hover:text-ink"
              )}
              onClick={() => setView(n.id)}
            >
              <Icon name={n.icon} size={17} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="scroll overflow-y-auto pt-10 pb-[72px] px-[clamp(20px,4vw,56px)]">
        <div className="max-w-[1200px] mx-auto">
          {error && (
            <div className="mt-4 px-[14px] py-[10px] rounded-[10px] text-[13px] text-[#ffb4b4] bg-[rgba(255,80,80,.08)] border border-[rgba(255,80,80,.25)]">
              {error}
            </div>
          )}

          <header className="mb-[26px]">
            <h1 className="text-2xl font-bold tracking-[-.02em] text-ink">
              {meta.title}
            </h1>
            <p className="mt-1.5 text-sm text-ink-3">{meta.sub}</p>
          </header>

          {cards.length === 0 ? (
            <div className="px-1 py-7 text-sm text-ink-3">
              {view === "trash"
                ? "Trash is empty."
                : "No films yet — start one with New film."}
            </div>
          ) : (
            <div className="grid gap-x-[22px] gap-y-6 grid-cols-[repeat(auto-fill,minmax(252px,1fr))]">
              {cards.map((c) => (
                <div
                  key={c.id}
                  className="group flex flex-col text-left overflow-hidden rounded-[12px] cursor-pointer bg-surface-1 border border-hair transition-all duration-200 ease-cine hover:-translate-y-[3px] hover:border-white/20 hover:shadow-[0_16px_36px_-18px_rgba(0,0,0,.75)]"
                  role="button"
                  tabIndex={0}
                  onClick={() => open(c)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openMenuAt(e.clientX, e.clientY, c);
                  }}
                >
                  <div className="relative aspect-[16/10] bg-surface-2 overflow-hidden">
                    {c.poster ? (
                      <img
                        src={c.poster}
                        alt={c.title}
                        draggable={false}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-ink-4 bg-surface-2 [background-image:radial-gradient(120%_130%_at_50%_0%,rgba(255,255,255,.05),transparent_62%)]">
                        <Icon name="film" size={24} />
                      </div>
                    )}
                    <button
                      className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-btn text-white bg-black/45 border border-white/[.18] backdrop-blur-md opacity-0 -translate-y-0.5 transition-[opacity,transform] duration-200 group-hover:opacity-100 group-hover:translate-y-0 hover:bg-black/65"
                      aria-label="More"
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        openMenuAt(r.right - 4, r.bottom + 4, c);
                      }}
                    >
                      <Icon name="dots" size={16} />
                    </button>
                  </div>
                  <div className="px-[15px] pt-[13px] pb-[15px] border-t border-hair-2">
                    <div className="text-[15px] font-semibold tracking-[-.01em] text-ink truncate">
                      {c.title}
                    </div>
                    <div className="mt-1.5 text-[13px] leading-normal text-ink-2 min-h-[38px] line-clamp-2">
                      {c.description}
                    </div>
                    <div className="mt-2.5 text-xs text-ink-4">{c.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {menu && (
          <>
            <div
              className="fixed inset-0 z-[79]"
              onClick={() => setMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu(null);
              }}
            />
            <motion.div
              className="fixed z-[80] min-w-[160px] p-[5px] rounded-[10px] bg-glass-2 border border-hair shadow-[0_18px_44px_rgba(0,0,0,.5)] backdrop-blur-xl origin-top-left"
              style={{ left: menu.x, top: menu.y }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.12, ease: [0.22, 0.61, 0.36, 1] }}
            >
              <button
                className="flex w-full items-center gap-[9px] px-[11px] py-2 rounded-[6px] text-[13px] text-left text-ink hover:bg-glass"
                onClick={() => {
                  open(menu.card);
                  setMenu(null);
                }}
              >
                <Icon name="play" size={14} />
                <span>Open</span>
              </button>
              <button
                className="flex w-full items-center gap-[9px] px-[11px] py-2 rounded-[6px] text-[13px] text-left text-[#ff7a7a] hover:bg-[rgba(255,90,90,.1)]"
                onClick={() => deleteCard(menu.card)}
              >
                <Icon name="trash" size={14} />
                <span>Delete</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
