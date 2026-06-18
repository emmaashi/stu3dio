# System Architecture

## Content Hierarchy

Everything in the project flows down this hierarchy. Each level is generated from the one above it and inherits its context.

```mermaid
flowchart LR
    P["🎬 Project\nplot · summary"]
    CH["🧑 Characters\nimage + bio"]
    S["🎞 Scenes\nscript + still\n(writing unit)"]
    F["🖼 Frames\nVeo3 prompt + still\n(generation unit)"]
    V["🎥 Video clips\n8s mp4 per frame"]
    FIN["🏁 Final Film\nFFmpeg stitch"]

    P --> CH
    P --> S
    S --> F
    F --> V
    V --> FIN

    CH -.->|"visual reference\nfor scenes + frames"| S
    CH -.->|"visual reference\nfor scenes + frames"| F
```

---

## Full Stack Overview

```mermaid
flowchart LR
    subgraph Frontend["Frontend (Next.js)"]
        UI["Pages & Hooks"]
        API["api.ts"]
    end

    subgraph Backend["Backend (Fastify + Bun)"]
        ROUTES["Routes\n/projects  /director  /jobs"]
        QUEUE["Job Queue\n(BullMQ + Redis)"]
        WORKERS["Workers\nimage · llm · video · stitch"]
        AI["AI Layer\nGemini · fal.ai · FFmpeg"]
    end

    subgraph Storage["Storage"]
        PG[("Postgres\nentities + metadata")]
        ST[("Supabase Storage\nimages + videos")]
        RD[("Redis\njob status + chat memory")]
    end

    UI --> API
    API -->|REST| ROUTES
    ROUTES --> QUEUE
    ROUTES --> PG
    QUEUE --> WORKERS
    WORKERS --> AI
    AI --> ST
    WORKERS --> PG
    QUEUE <--> RD
    ROUTES <--> RD
```

---

## Production Pipeline

```mermaid
flowchart TD
    A["1️⃣  Director Chat\nMulti-turn conversation in Redis\nPlot + characters locked to Postgres on completion"]

    B["2️⃣  Character Generation\nGemini writes bio + generates image\nStored in Postgres + Supabase Storage"]

    subgraph cascade["3️⃣  Scene → Frame → Video — auto-cascades"]
        S["Scene jobs\nGemini writes script\nembeds character tokens in prose"]
        F["Frame jobs × N\nGemini scoped to this scene\n+ referenced characters' images only"]
        V["Video jobs × N\nfal.ai Veo3 → 8s mp4 per frame"]
        S -->|triggerFrameGeneration| F
        F -->|triggerVideoGeneration| V
    end

    C["4️⃣  Confirm & Stitch\nFFmpeg joins all clips in frame_order\nFinal mp4 → Supabase"]

    A --> B --> cascade --> C
```

---

## Context Inheritance — How Coherence Is Maintained

Each level only loads the context it needs. The reference token system ensures frames only pull in the characters actually present in their scene — not every character in the project.

```mermaid
flowchart TD
    P["🎬 Project\nplot · summary"]
    C["🧑 Characters\n+ project plot"]
    S["🎞 Scenes\n+ characters + objects\n+ character images → Gemini"]
    F["🖼 Frames\n+ THIS scene only (not all scenes)\n+ only token-referenced characters' images"]

    P -->|inherited by| C
    C -->|inherited by| S
    S -->|inherited by| F

    TOKEN["🔖 How token filtering works\n① Scene LLM writes '<|character_uuid|>' in prose\n② Regex extracts those IDs from saved scene text\n③ Only those characters' images fetched + sent to Gemini"]

    F -->|"drives"| TOKEN

    style P fill:#1a1a2e,color:#fff
    style C fill:#16213e,color:#fff
    style S fill:#0f3460,color:#fff
    style F fill:#533483,color:#fff
    style TOKEN fill:#e94560,color:#fff
```
