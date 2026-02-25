# Rebuild Checklist

Delete everything and rebuild from memory. Follow these steps in order.

---

## Phase 1: Project Setup

- [ ] Create a new Vite + React + TypeScript project
- [ ] Install dependencies: `convex`, `openai`
- [ ] Run `npx convex init` or `npx convex dev --once --configure=new`
- [ ] Authenticate with Convex (browser login or deploy key)

## Phase 2: Schema

- [ ] Create `convex/schema.ts`
- [ ] Define `jobLogs` table with fields:
  - `prompt` (string, required)
  - `status` (union: pending | running | completed | failed)
  - `result` (optional string)
  - `model` (string)
  - `duration` (optional string)
- [ ] Remember: `_id` and `_creationTime` are automatic in Convex

## Phase 3: Backend Functions

- [ ] Create `convex/logs.ts` with:
  - `list` query — returns all jobs ordered by creation time descending
  - `get` query — returns a single job by ID
  - `create` internal mutation — inserts a new job with "running" status
  - `updateStatus` internal mutation — patches job status, result, duration
  - `seed` mutation — inserts sample data if table is empty
- [ ] Create `convex/ai.ts` with:
  - Mark file with `"use node"` directive (enables Node.js runtime for external API calls)
  - `runJob` action that:
    1. Calls `ctx.runMutation(internal.logs.create)` to create the job
    2. Calls OpenRouter API (via OpenAI SDK) with the prompt
    3. Calls `ctx.runMutation(internal.logs.updateStatus)` with result
    4. Handles errors gracefully (catches and persists failure status)

## Phase 4: Deploy Backend

- [ ] Set environment variables in Convex:
  - `AI_INTEGRATIONS_OPENROUTER_BASE_URL`
  - `AI_INTEGRATIONS_OPENROUTER_API_KEY`
- [ ] Run `npx convex deploy` or `npx convex dev`
- [ ] Verify functions appear in Convex dashboard

## Phase 5: Frontend

- [ ] Set `VITE_CONVEX_URL` environment variable
- [ ] Wrap app in `ConvexProvider` with `ConvexReactClient`
- [ ] Build the home page with:
  - `useQuery(api.logs.list)` for real-time job list
  - `useAction(api.ai.runJob)` for job submission
  - Stats bar showing total/completed/running/failed counts
  - Form with textarea and submit button
  - Job cards with expandable results
  - Status badges (completed = green, running = amber, failed = red)
  - Loading state when `jobs === undefined`
  - Empty state with "Load Samples" button calling `useMutation(api.logs.seed)`

## Phase 6: Verify

- [ ] Submit a test prompt
- [ ] Verify job appears immediately with "Running" status
- [ ] Verify job updates to "Completed" with result (no page refresh)
- [ ] Open in two browser tabs — verify both update simultaneously
- [ ] Test error handling (submit empty prompt)

## Phase 7: Documentation

- [ ] Write LEARNING.md explaining the three Convex primitives
- [ ] Write AGENT_BRIDGE.md showing evolution to agent system
- [ ] Write this REBUILD_CHECKLIST.md

---

## Key Concepts to Remember

1. **Queries are read-only** — they power subscriptions
2. **Mutations are transactional** — they modify data atomically
3. **Actions handle side effects** — API calls, then `runMutation` to persist
4. **`"use node"` directive** — required for actions that use Node.js APIs
5. **`internal` vs `api`** — internal functions can't be called from the client
6. **`_creationTime`** — auto-added by Convex, don't add to indexes
7. **Real-time is automatic** — `useQuery` subscribes, mutations trigger updates
8. **No cache invalidation** — Convex handles this entirely

---

## Common Mistakes

- Forgetting `"use node"` at the top of action files that use npm packages
- Adding `_creationTime` to index definitions (it's automatic)
- Trying to access `ctx.db` from an action (use `ctx.runMutation` instead)
- Using `api.*` for internal mutations called from actions (use `internal.*`)
- Not setting Convex environment variables for API keys used in actions
- Caching `useQuery` results in `useState` (breaks real-time)
