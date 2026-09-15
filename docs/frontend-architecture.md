# Frontend Architecture — REST + SSE

## The Call Chain

Every user action flows through four layers before hitting the backend.

```mermaid
flowchart TD
    subgraph UI["UI Layer"]
        PAGE["app/page.tsx\n3D studio homepage"]
        OVERLAY["PagesOverlay\nroutes to active page"]
        C2["Character2Page\nScript & characters"]
        C3["Character3Page\nImage generation"]
        C4["Character4Page\nDirector chat"]
    end

    subgraph HOOKS["Hook Layer"]
        UBI["useBackendIntegration()\nbundles all hooks below"]
        UP["useProject()"]
        UD["useDirector()"]
        US["useScript()"]
        UPD["useProjectData()"]
    end

    subgraph DATA["Data Layer — module singletons"]
        PD["projectData.ts\norchestrates project workflows"]
        DD["directorData.ts\nmanages conversation state"]
        CD["characterData.ts\ncharacter & scene state"]
        SD["scriptData.ts\nscript enhancement"]
    end

    subgraph API["api.ts — all HTTP calls live here\nbase: localhost:3001"]
        PA["projectApi\n/api/projects"]
        DA["directorApi\n/api/director"]
        JA["jobApi\n/api/jobs"]
        ESM["EventSourceManager\n/api/events (SSE)"]
    end

    PAGE -->|user clicks 'Step onto set'| OVERLAY
    OVERLAY --> C2 & C3 & C4

    C2 -->|useProject · useScript · useProjectData| UBI
    C3 -->|useProject · useProjectData| UBI
    C4 -->|useDirector · useProject| UBI

    UBI --> UP & UD & US & UPD
    UP & US & UPD --> PD
    UD --> DD
    PD --> CD & SD

    PD --> PA
    DD --> DA
    CD & SD --> JA

    PA & DA & JA -->|REST| BE[("⚙️ Backend\n:3001")]
    ESM -->|SSE keep-alive| BE
    BE -->|pushes job events| ESM
```

---

## REST vs SSE

```mermaid
sequenceDiagram
    participant Page
    participant api.ts
    participant Backend as Backend :3001

    note over Page,Backend: REST — fire and get a response
    Page->>Backend: POST /api/jobs/character-generation
    Backend-->>Page: { job_id: "abc" }

    note over Page,Backend: SSE — backend pushes when the job finishes
    Page->>Backend: GET /api/events/project/:id/characters  (open connection)
    Backend-->>Page: character_complete  { image_url, name, ... }
    Backend-->>Page: batch_progress      { done: 2, total: 5 }
    Backend-->>Page: project_ready       { ... }
```

SSE means the frontend never polls — the backend notifies it the moment a job completes.

---

## The Three Production Workflows

```mermaid
flowchart LR
    D["1️⃣ Director Chat\nDevelop the story\nPOST /api/director/converse"]
    C["2️⃣ Generate Assets\nCharacters → Scenes → Frames\nPOST /api/jobs/character-generation\nPOST /api/jobs/scene-generation"]
    V["3️⃣ Assemble Video\nConfirm & stitch everything\nPOST /api/projects/:id/confirm-video"]

    D --> C --> V
```

---

## Key Files at a Glance

| File | Role |
|---|---|
| `utils/api.ts` | Single source of all `fetch()` calls; exports `projectApi`, `directorApi`, `jobApi`, `contentApi`, `EventSourceManager` |
| `hooks/useBackendIntegration.ts` | Main hook consumed by pages; bundles project, director, script, data, and image-editing hooks |
| `data/projectData.ts` | Top-level workflow orchestrator; on `setActiveProject` it loads conversations, script, and characters in parallel |
| `store/backendStore.ts` | Zustand store holding `apiBaseUrl`, `projectId`, `conversationId` globally |
| `data/characterData.ts` | Holds character/scene state; calls `jobApi` to kick off generation jobs |
