# AI Job Logger — Convex

> A real-time AI job execution logger built with **Convex**, **React**, and **OpenRouter**. Demonstrates Convex queries, mutations, actions, and live data synchronisation without any manual WebSocket setup.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Data Flow](#data-flow)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Convex Deployment](#convex-deployment)
- [Available Scripts](#available-scripts)
- [Further Reading](#further-reading)

---

## Overview

AI Job Logger lets you submit natural-language prompts to an LLM and watch their execution status update in real-time — no page refresh, no polling. Every connected client sees the job board update the instant a job is created, progresses, completes, or fails.

The project is intentionally minimal: it is a teaching tool for understanding how **Convex** replaces a traditional REST + WebSocket + database stack with a single reactive backend.

---

## Key Features

| Feature | Description |
|---|---|
| **Real-time job board** | All connected clients update instantly via Convex query subscriptions |
| **Prompt submission** | Submit any text prompt; a job is created and executed immediately |
| **Live status tracking** | Jobs move through `running → completed / failed` with elapsed time |
| **Stats dashboard** | Live counts of total, completed, running, and failed jobs |
| **Expandable job cards** | Click any card to read the full LLM response |
| **Seed data** | One-click seeding to populate sample jobs for demonstration |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Wouter (routing) |
| **UI** | shadcn/ui, Radix UI primitives, Tailwind CSS, Framer Motion |
| **Backend / DB** | [Convex](https://convex.dev) — queries, mutations, actions, built-in database |
| **AI** | OpenRouter API (`meta-llama/llama-3.3-70b-instruct` by default) via the OpenAI-compatible SDK |
| **Real-time** | Convex subscription system (automatic — no WebSocket boilerplate) |
| **Dev server** | Express 5 + Vite middleware (development only) |
| **Type safety** | TypeScript 5.6, Zod, drizzle-zod |
| **Forms** | React Hook Form + `@hookform/resolvers` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (React)                       │
│                                                             │
│   ┌──────────────┐     useQuery()      ┌─────────────────┐  │
│   │  Job Board   │◄────────────────────│  Convex Client  │  │
│   │  (home.tsx)  │                     │  (ConvexProvider│  │
│   │              │─────useAction()────►│   + hooks)      │  │
│   └──────────────┘                     └────────┬────────┘  │
└────────────────────────────────────────────────┼────────────┘
                                                  │ HTTPS / WebSocket
                                    ┌─────────────▼────────────┐
                                    │      Convex Cloud         │
                                    │                           │
                                    │  ┌──────────────────────┐ │
                                    │  │   convex/logs.ts      │ │
                                    │  │  • list  (query)      │ │
                                    │  │  • get   (query)      │ │
                                    │  │  • create (internal)  │ │
                                    │  │  • updateStatus (int) │ │
                                    │  │  • seed  (mutation)   │ │
                                    │  └──────────────────────┘ │
                                    │                           │
                                    │  ┌──────────────────────┐ │
                                    │  │   convex/ai.ts        │ │
                                    │  │  • runJob (action)    │ │
                                    │  └──────────┬───────────┘ │
                                    │             │             │
                                    │  ┌──────────▼───────────┐ │
                                    │  │  Convex Database      │ │
                                    │  │  (jobLogs table)      │ │
                                    │  └──────────────────────┘ │
                                    └──────────────┬────────────┘
                                                   │ OpenAI-compatible API
                                       ┌───────────▼───────────┐
                                       │     OpenRouter API     │
                                       │  (LLM inference)       │
                                       └───────────────────────┘
```

### Key Architectural Decisions

- **Convex replaces PostgreSQL + REST API + WebSockets** — the database, server functions, and real-time transport are all provided by a single Convex deployment.
- **Express is dev-only** — `server/index.ts` exists solely to serve the Vite dev server in the Replit environment. In production, the React app is served as static files.
- **Actions run in Node.js** — `convex/ai.ts` is annotated "use node" so it can call the OpenRouter API using the Node.js OpenAI SDK. Queries and mutations run in Convex's lighter V8 runtime.
- **Internal mutations** — `create` and `updateStatus` are `internalMutation`s, meaning they can only be called from other Convex functions (the `runJob` action), never directly from the client.

---

## Data Model

### `jobLogs` table

```typescript
// convex/schema.ts
defineTable({
  prompt:   v.string(),                                              // The user's input prompt
  status:   v.union(
              v.literal("pending"),
              v.literal("running"),
              v.literal("completed"),
              v.literal("failed")
            ),
  result:   v.optional(v.string()),                                  // LLM response (set on completion/failure)
  model:    v.string(),                                              // Model identifier, e.g. "meta-llama/llama-3.3-70b-instruct"
  duration: v.optional(v.string()),                                  // Wall-clock time, e.g. "2.3s"
})
```

> Convex automatically adds `_id` (a typed document ID) and `_creationTime` (epoch ms) to every document.

---

## Data Flow

```
User types prompt
       │
       ▼
useAction(api.ai.runJob)
       │
       ▼
[convex/ai.ts — runJob action]
  1. ctx.runMutation(internal.logs.create)
     → inserts jobLog with status="running"
     → ALL useQuery(api.logs.list) subscribers update instantly ✨
       │
       ▼
  2. Call OpenRouter API (LLM inference)
       │
       ├─► success → ctx.runMutation(internal.logs.updateStatus, { status: "completed", result, duration })
       │                → subscribers update instantly ✨
       │
       └─► failure → ctx.runMutation(internal.logs.updateStatus, { status: "failed", result: errorMsg, duration })
                       → subscribers update instantly ✨
```

---

## Project Structure

```
ai-job-logger-convex/
├── convex/                          # Convex backend (deployed to Convex Cloud)
│   ├── schema.ts                    # Table definitions & type validators
│   ├── logs.ts                      # Queries (list, get) + Mutations (seed) + Internal mutations (create, updateStatus)
│   ├── ai.ts                        # Action: runJob — calls OpenRouter, orchestrates mutations
│   ├── tsconfig.json                # TypeScript config for Convex runtime
│   └── _generated/                  # Auto-generated API bindings (do not edit)
│       ├── api.ts
│       ├── server.ts
│       └── dataModel.d.ts
│
├── client/                          # React frontend
│   └── src/
│       ├── App.tsx                  # ConvexProvider + Wouter router
│       ├── pages/
│       │   └── home.tsx             # Main dashboard: job list, submit form, stats
│       ├── components/ui/           # shadcn/ui component library
│       ├── hooks/
│       │   └── use-toast.ts         # Toast notification hook
│       └── lib/
│           └── queryClient.ts       # TanStack Query client (legacy, not used by Convex)
│
├── server/                          # Express dev server (development / Replit only)
│   ├── index.ts                     # Entry point: registers routes, starts server
│   ├── routes.ts                    # Express route registration
│   ├── vite.ts                      # Vite dev middleware
│   ├── static.ts                    # Static file serving for production
│   ├── storage.ts                   # (Stub — data lives in Convex)
│   └── replit_integrations/         # Replit-specific integration helpers
│
├── shared/                          # Code shared between client and server
│
├── docs/                            # Supplementary documentation
│   ├── LEARNING.md                  # Convex concepts tutorial
│   ├── AGENT_BRIDGE.md              # Agent system evolution guide
│   └── REBUILD_CHECKLIST.md         # Steps to rebuild the project from scratch
│
├── script/
│   └── build.ts                     # Production build script (esbuild + Vite)
│
├── components.json                  # shadcn/ui configuration
├── drizzle.config.ts                # Drizzle ORM config (legacy — DB is now Convex)
├── tailwind.config.ts               # Tailwind CSS configuration
├── tsconfig.json                    # Root TypeScript configuration
├── vite.config.ts                   # Vite build configuration
└── package.json
```

---

## Environment Variables

### Convex environment variables
Set these in your Convex deployment using `npx convex env set KEY VALUE`:

| Variable | Description |
|---|---|
| `AI_INTEGRATIONS_OPENROUTER_BASE_URL` | OpenRouter API base URL (e.g. `https://openrouter.ai/api/v1`) |
| `AI_INTEGRATIONS_OPENROUTER_API_KEY` | Your OpenRouter API key |

### Local / shell environment variables

| Variable | Description |
|---|---|
| `CONVEX_URL` | Convex deployment URL (set automatically by `npx convex dev`) |
| `VITE_CONVEX_URL` | Frontend-accessible Convex URL (consumed by Vite) |
| `CONVEX_DEPLOY_KEY` | Required for non-interactive / CI deployments |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Convex](https://dashboard.convex.dev) account (free tier is sufficient)
- An [OpenRouter](https://openrouter.ai) API key

### 1. Clone and install

```bash
git clone https://github.com/gwho/ai-job-logger-convex.git
cd ai-job-logger-convex
npm install
```

### 2. Initialise Convex

```bash
npx convex dev
```

This will:
- Prompt you to log in to Convex (first time only)
- Create a new Convex project and provision a deployment
- Write `CONVEX_URL` and `VITE_CONVEX_URL` to a local `.env.local` file
- Watch `convex/` for changes and hot-deploy functions automatically

### 3. Set OpenRouter credentials

```bash
npx convex env set AI_INTEGRATIONS_OPENROUTER_BASE_URL https://openrouter.ai/api/v1
npx convex env set AI_INTEGRATIONS_OPENROUTER_API_KEY sk-or-...
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

### 5. (Optional) Seed sample data

Click the **"Seed Data"** button in the dashboard, or call the mutation directly from the Convex dashboard.

---

## Convex Deployment

Deploy all Convex functions to production:

```bash
npx convex deploy
```

For CI / non-interactive environments, set `CONVEX_DEPLOY_KEY` and run:

```bash
npx convex deploy --cmd 'npm run build'
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Express + Vite dev server with hot reload |
| `npm run build` | Build client (Vite) and server (esbuild) for production |
| `npm start` | Run the production build |
| `npm run check` | TypeScript type-check (`tsc --noEmit`) |
| `npm run db:push` | Push Drizzle schema (legacy — not used; schema lives in Convex) |

---

## Further Reading

| Document | Description |
|---|---|
| [`docs/LEARNING.md`](docs/LEARNING.md) | Deep-dive tutorial on Convex concepts used in this project |
| [`docs/AGENT_BRIDGE.md`](docs/AGENT_BRIDGE.md) | How to evolve this into a multi-agent system |
| [`docs/REBUILD_CHECKLIST.md`](docs/REBUILD_CHECKLIST.md) | Step-by-step guide to rebuild this project from memory |
| [Convex docs](https://docs.convex.dev) | Official Convex documentation |
| [OpenRouter docs](https://openrouter.ai/docs) | Available models and API reference |

---

## License

MIT
