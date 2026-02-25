# AI Job Logger

A real-time AI job execution logger demonstrating Convex queries, mutations, actions, and live data synchronization.

## Architecture

- **Frontend**: React + Vite with Convex React hooks, shadcn/ui, Tailwind CSS
- **Backend**: Convex (queries, mutations, actions)
- **Database**: Convex built-in database (replaces PostgreSQL)
- **AI**: OpenRouter via Replit AI Integrations (meta-llama/llama-3.3-70b-instruct)
- **Real-time**: Convex subscription system (automatic, no WebSocket setup needed)

## Key Features

- Submit AI prompts and monitor job execution in real-time
- Automatic UI updates via Convex query subscriptions
- Job status tracking (pending, running, completed, failed)
- Stats dashboard with live counts
- Expandable job cards showing full AI responses

## Project Structure

```
├── convex/
│   ├── schema.ts            # Convex table definitions
│   ├── logs.ts              # Query (list) + Mutations (create, updateStatus, seed)
│   ├── ai.ts                # Action (runJob) — calls OpenRouter API
│   ├── tsconfig.json        # TypeScript config for Convex
│   └── _generated/          # Auto-generated types and API bindings
├── client/src/
│   ├── App.tsx              # ConvexProvider + Router setup
│   ├── pages/home.tsx       # Main dashboard page
│   ├── hooks/use-toast.ts   # Toast notifications
│   └── lib/queryClient.ts   # (Legacy — not used by Convex)
├── server/
│   ├── index.ts             # Express server (Vite dev serving only)
│   └── vite.ts              # Vite middleware
├── docs/
│   ├── LEARNING.md          # Convex concepts tutorial
│   ├── AGENT_BRIDGE.md      # Agent system evolution guide
│   └── REBUILD_CHECKLIST.md # Steps to rebuild from memory
```

## Data Flow

1. User submits prompt → `useAction(api.ai.runJob)` is called
2. Action creates job record via `ctx.runMutation(internal.logs.create)` with "running" status
3. All `useQuery(api.logs.list)` subscribers get instant update (job appears)
4. Action calls OpenRouter API for LLM response
5. Action updates job via `ctx.runMutation(internal.logs.updateStatus)`
6. All subscribers get instant update (job shows completed with result)

## Environment Variables

- `CONVEX_URL`: Convex deployment URL
- `CONVEX_DEPLOY_KEY`: For deploying functions from CI/non-interactive environments
- `VITE_CONVEX_URL`: Frontend-accessible Convex URL
- `AI_INTEGRATIONS_OPENROUTER_BASE_URL`: Set in Convex env vars
- `AI_INTEGRATIONS_OPENROUTER_API_KEY`: Set in Convex env vars

## Convex Deployment

Deploy functions: `npx convex deploy`
Set env vars: `npx convex env set KEY VALUE`
