<img width="1466" height="715" alt="Stu3dio canvas" src="https://github.com/user-attachments/assets/8fa41523-1ccc-4844-8742-219d4fa8a8d8" />

# Stu3dio

An agentic AI film studio: you direct from a canvas, and a crew of specialized agents turns one prompt into a cast, scenes and parallel 8-second clips, stitched into a finished short.

**First Place @ Hack the North**, Canada's largest hackathon · [Devpost](https://devpost.com/software/vibe-director)

<img width="1082" height="647" alt="Stu3dio shot storyboard" src="https://github.com/user-attachments/assets/6616b476-f0be-4a6f-bc22-2ecda5d61fae" />

## How it works

```
prompt → planner agent → job queue ─┬→ shot 1 ─┐
                                    ├→ shot 2 ─┼→ stitch → film
                                    └→ shot N ─┘
                                       ↓
                            Postgres rows + Storage files

film ──"edit one shot"──→ back to the queue
```

You describe a film. A planning agent turns that into a plot, a cast and a shot
list, pausing for your approval before anything expensive runs. Every unit of
work then becomes a background job: image workers render the cast references and
a still per shot, video workers turn each still into an 8-second clip, and a
stitching worker concatenates them into the final cut. Editing one shot
re-enters the same pipeline for that shot alone.

Nothing generates inside an HTTP request — one clip takes about a minute, so the
API validates, enqueues, and returns a job id while the canvas watches progress.

### Keeping one film out of many clips

Eight independently generated clips drift apart unless something carries the
story between them. A film here is a tree, and each job is told only about the
levels above it:

```
plot                    → a character job sees just this
  + cast                → a prop job sees plot + cast
    + props             → a scene job sees plot + cast + props
      + this one scene  → a shot job sees all that + its own scene
```

Context is rebuilt from Postgres on every job rather than held in memory, so job
order and worker identity don't matter. And a shot doesn't get the whole cast:
generated prose embeds stable entity tokens like `<|character_<uuid>|>`, which
the shot job parses back out to inject only the characters it actually mentions —
along with **their reference images**, so the new still matches the established
look instead of re-interpreting a text description.

## Features

- **Canvas workspace** — the film as a graph of cast, scene and shot cards you
  can select, refine and regenerate, built on React Flow.
- **Agent runs with approval gates** — one prompt drives the whole production,
  stopping at the concept, the production plan and final assembly so a wrong
  plot is a ten-second correction instead of a four-minute one.
- **Live run transcript** — assistant messages, activities, per-task progress
  and approvals stream over SSE from an append-only event log, replayable with
  `Last-Event-ID` so a refresh mid-render rebuilds the whole transcript.
- **Hierarchical context + reference tokens** — the consistency mechanism above.
- **Parallel shot generation** — nine typed queues with per-type priority,
  retries and concurrency; the shots of a film render at the same time rather
  than one after another.
- **Scribble-to-edit** — draw on a still and describe the change; the edit runs
  as its own job and only that shot regenerates.
- **Shot previews as clip windows** — a shot plays its own 8 seconds of the cut,
  with the scrubber and duration describing the shot rather than the film.
- **Film assembly** — FFmpeg concatenation with stream copy, no re-encode.
- **Two offline demo films** — the canvas runs the full pipeline with no backend,
  no API keys and no spend, which is also how the UI is tested.

## Architecture

| Layer | What runs there |
|---|---|
| Frontend | Next.js 15 (App Router, Turbopack), React 19, Zustand, TanStack Query, Tailwind v4, Radix/shadcn, React Flow canvas, Fabric.js scribble editor |
| API | Bun + Fastify, Zod-validated, Swagger at `/docs` |
| Queues | BullMQ on Redis — nine queues, plus job status hashes and the agent-run event log |
| Workers | Orchestration, image, LLM, video and stitching workers in the same process |
| Models | Gemini 2.0 Flash (text + structured JSON), Gemini 2.5 Flash Image, fal.ai `nano-banana` and Veo 3 fast (8s, 720p, 16:9, with audio) |
| Storage | Supabase Postgres for entities and JSONB metadata, Supabase Storage for media, local FFmpeg for assembly |

Deeper writeups live in [`docs/BACKEND_ARCHITECTURE.md`](docs/BACKEND_ARCHITECTURE.md)
— data model, job lifecycle, the three context mechanisms, provider fallbacks —
and [`docs/frontend-architecture.md`](docs/frontend-architecture.md).

## Running locally

Requires [Bun](https://bun.sh), [pnpm](https://pnpm.io), Redis and FFmpeg.

```bash
# Redis (or run it however you like)
docker run -d --name stu3dio-redis -p 6379:6379 redis:7-alpine

# Backend — http://localhost:5000, docs at /docs, health at /health
cd backend && bun install && bun src/index.ts

# Frontend — http://localhost:3000
cd frontend && pnpm install && pnpm dev
```

`backend/.env` needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY` and
`FAL_KEY`; the server exits at startup without them. `REDIS_HOST`/`REDIS_PORT`
default to `localhost:6379`, and `PORT` defaults to `5000` — on macOS that port
belongs to the AirPlay Receiver, so `PORT=8000` is usually easier. Point the
frontend at whichever you choose with `NEXT_PUBLIC_API_URL` in
`frontend/.env.local`.

### No keys? Use the demo films

The frontend falls back to an in-memory mock whenever the backend is
unreachable, or with `NEXT_PUBLIC_MOCK=1`. Both demo films then walk the full
pipeline — concept, cast, scenes, shots, assembly — with no spend.

The Tears of Steel demo plays from a local file that is deliberately not
committed. Generate it once:

```bash
cd frontend && mkdir -p public/films && ffmpeg \
  -i https://upload.wikimedia.org/wikipedia/commons/c/cb/Tears_of_Steel_1080p.webm \
  -vf scale=-2:720 -c:v libx264 -crf 24 -preset veryfast -c:a aac -b:a 128k \
  -movflags +faststart public/films/tears-of-steel-720p.mp4
```

### Tests

```bash
cd frontend && pnpm test:run   # vitest
cd backend && bun test
```

## Demo media

The demo films are real films, not generated by this project — the canvas shows
the pipeline against footage with real people in every node. Credits and
licences are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Team

Built at Hack the North 2025 by [Jeff Lu](https://github.com/Jeff15321),
William Zeng, [Emma Shi](https://github.com/emmaashi) and Martin Sit.
