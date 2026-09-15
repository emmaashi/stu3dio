# AI Film Studio Backend

A high-performance backend for AI-powered film production featuring hierarchical content generation, async job processing, and real-time streaming capabilities.

## Features

- 🎬 **Hierarchical Content Generation**: Characters → Scenes → Frames → Videos
- 🤖 **AI-Powered Creation**: Gemini 2.5 Flash for images/text, fal.ai for videos
- 🏭 **Background Job Processing**: BullMQ + Redis for scalable task management
- 📡 **Director Agent**: Real-time streaming AI guidance
- 💾 **Media Storage**: Supabase Storage for generated images, references, and video
- 📚 **API Documentation**: Swagger UI integration
- 🧪 **Test Interface**: Built-in HTML testing tools

## Tech Stack

- **Runtime**: Bun
- **Server**: Fastify + CORS + Swagger
- **Queue**: BullMQ + Redis
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **AI**: Gemini 2.5 Flash, fal.ai, FFmpeg

## Quick Start

1. **Install Dependencies**:
   ```bash
   bun install
   ```

2. **Environment Setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Start Development Server**:
   ```bash
   bun run dev
   ```

4. **Access the Application**:
   - **Server**: http://localhost:5000
   - **API Docs**: http://localhost:5000/docs
   - **Test Interface**: http://localhost:5000/test/test.html

## Environment Variables

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Redis
REDIS_URL=redis://localhost:6379

# AI Services
GEMINI_API_KEYS=key1,key2,key3  # Comma-separated for cycling
FAL_KEY=your_fal_ai_key

# Server
PORT=5000
NODE_ENV=development
```

## Project Structure

```
src/
├── ai/              # AI service integrations
│   ├── gemini.ts    # Gemini API with key cycling
│   ├── fal.ts       # fal.ai video generation
│   └── ffmpeg.ts    # Video processing
├── models/          # Zod schemas
├── routes/          # API endpoints
├── utils/           # Database, context, storage, and queue utilities
├── workers/         # Background job processors
├── public/          # HTML test interfaces
└── index.ts         # Main server entry
```

## API Endpoints

### Projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PATCH /api/projects/:id` - Update project

### Jobs
- `POST /api/jobs/character-generation` - Generate characters
- `POST /api/jobs/scene-generation` - Generate scenes
- `POST /api/jobs/video-generation` - Generate videos
- `POST /api/jobs/video-stitching` - Stitch videos
- `GET /api/jobs/:id/status` - Check job status
- `GET /api/queues/status` - Queue overview

### Director Agent
- `POST /api/director/stream` - AI guidance streaming
- `GET /api/director/pages` - Available page contexts

## Canvas integration

The creative canvas is a view and control surface over the same production
architecture. It does not maintain a separate generation pipeline.

- A whole-film, overview, or planning prompt creates an agent run through
  `POST /api/projects/:projectId/agent-runs`. The Redis-backed orchestration
  worker acts as the director, streams progress and approval checkpoints, and
  fans approved work out to the character, scene, frame, video, and stitching
  workers.
- A selected character, scene, or shot creates a focused `image-editing` job.
  Before editing, the worker rebuilds context from Postgres. Character edits
  inherit the project, cast, and objects; scene and shot edits also inherit the
  current scene.
- Canvas selections are sent as focus hints so the director knows what the user
  is discussing. Project, character, object, and scene facts are always rebuilt
  from the database before an AI call, so browser state cannot replace the
  authoritative story context.
- Generated images and videos remain in Supabase Storage, while their URLs and
  descriptive metadata stay attached to the corresponding database entities.
  Later scenes, frames, and edits therefore reuse the same visual references and
  hierarchical context.

This preserves the original flow—director → orchestration → specialized
workers—while allowing users to prompt, select, annotate, and iterate directly
on the canvas.

## Workflow

1. **Create Project** → Set up basic project info
2. **Generate Characters** → AI creates character images & descriptions (requires confirmation)
3. **Generate Scenes** → Auto-creates scenes with plot details
4. **Generate Frames** → Auto-creates video prompts per scene
5. **Generate Videos** → Auto-creates videos from frames
6. **Stitch Final Video** → Combines all videos into final output

## Development

- **Hot Reload**: `bun run dev`
- **Build**: `bun run build`
- **Start**: `bun run start`

## Architecture Highlights

- **API Key Cycling**: Prevents rate limits with multiple Gemini keys
- **Hierarchical Jobs**: Auto-triggers dependent tasks
- **Streaming Director**: Real-time AI guidance with function calls
- **Context Inheritance**: Lower levels know about parent data
- **Confirmation System**: User approval for character generation
- **Error Recovery**: Automatic retry logic with exponential backoff
